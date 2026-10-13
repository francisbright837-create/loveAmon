const crypto = require("crypto");
const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");

// Real-time signalling for one-to-one voice and video calls.
// The call itself (sound and picture) goes directly between the two phones (WebRTC);
// this file only introduces them to each other and keeps track of who is busy.

const RING_MS = Number(process.env.CALL_RING_MS) || 45 * 1000;
const isId = (id) => typeof id === "string" && id.length === 24 && mongoose.Types.ObjectId.isValid(id);
const room = (uid) => "user:" + uid;
const fmt = (secs) => Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0");

module.exports = function setupCalls(io) {
  const calls = new Map();       // callId -> { id, caller, callee, kind, state, answeredAt, timer }
  const inCall = new Map();      // userId -> callId (someone can only be in one call)
  const lastInvite = new Map();  // userId -> time of their last call attempt

  const isOnline = (uid) => {
    const r = io.sockets.adapter.rooms.get(room(uid));
    return !!(r && r.size > 0);
  };

  // you can only call people you have chatted with or matched with
  async function mayCall(a, b) {
    const talked = await Message.exists({ $or: [{ sender: a, receiver: b }, { sender: b, receiver: a }] });
    if (talked) return true;
    return !!(await User.exists({ _id: a, matches: b }));
  }

  // leaves a line in the chat: "Missed voice call", "Video call · 2:31" ...
  async function logCall(call, status, seconds) {
    const label = call.kind === "video" ? "video" : "voice";
    const icon = call.kind === "video" ? "🎥" : "📞";
    const Label = label[0].toUpperCase() + label.slice(1);
    let text, read = true;
    if (status === "ended") text = icon + " " + Label + " call · " + fmt(seconds || 0);
    else if (status === "missed") { text = icon + " Missed " + label + " call"; read = false; }
    else if (status === "declined") text = icon + " " + Label + " call declined";
    else return;
    try {
      await Message.create({ sender: call.caller, receiver: call.callee, kind: "call", text, read });
    } catch (err) {
      console.error("Could not log call:", err.message);
    }
  }

  function finish(call) {
    clearTimeout(call.timer);
    calls.delete(call.id);
    if (inCall.get(call.caller) === call.id) inCall.delete(call.caller);
    if (inCall.get(call.callee) === call.id) inCall.delete(call.callee);
  }

  function endActive(call, by, socket) {
    const other = by === call.caller ? call.callee : call.caller;
    io.to(room(other)).emit("call:ended", { callId: call.id });
    if (socket) socket.to(room(by)).emit("call:ended", { callId: call.id });   // my other tabs/devices
    const seconds = call.answeredAt ? Math.round((Date.now() - call.answeredAt) / 1000) : 0;
    finish(call);
    logCall(call, "ended", seconds);
  }

  function cancelRinging(call, socket) {
    io.to(room(call.callee)).emit("call:cancelled", { callId: call.id });
    if (socket) socket.to(room(call.caller)).emit("call:cancelled", { callId: call.id });
    finish(call);
    logCall(call, "missed");
  }

  io.on("connection", (socket) => {
    const me = socket.userId;
    if (!me) return;
    socket.join(room(me));

    socket.on("call:invite", async (payload, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        const { to, kind } = payload || {};
        if (!isId(to) || String(to) === String(me) || (kind !== "audio" && kind !== "video")) {
          return reply({ ok: false, reason: "invalid" });
        }
        const now = Date.now();
        if (now - (lastInvite.get(me) || 0) < 2000) return reply({ ok: false, reason: "slow-down" });
        lastInvite.set(me, now);
        if (inCall.has(me)) return reply({ ok: false, reason: "you-are-busy" });
        if (!(await mayCall(me, to))) return reply({ ok: false, reason: "not-allowed" });

        const call = { id: crypto.randomUUID(), caller: me, callee: to, kind, state: "ringing", answeredAt: 0, timer: null };
        if (!isOnline(to)) { logCall(call, "missed"); return reply({ ok: false, reason: "offline" }); }
        if (inCall.has(to)) return reply({ ok: false, reason: "busy" });
        if (inCall.has(me)) return reply({ ok: false, reason: "you-are-busy" });

        calls.set(call.id, call);
        inCall.set(me, call.id);
        inCall.set(to, call.id);
        call.timer = setTimeout(() => {                       // nobody picked up
          if (call.state !== "ringing") return;
          io.to(room(call.caller)).to(room(call.callee)).emit("call:missed", { callId: call.id });
          finish(call);
          logCall(call, "missed");
        }, RING_MS);

        const who = await User.findById(me).select("name profilePicture").lean();
        io.to(room(to)).emit("call:incoming", {
          callId: call.id,
          kind,
          from: { id: String(me), name: who ? who.name : "Someone", profilePicture: (who && who.profilePicture) || "" }
        });
        reply({ ok: true, callId: call.id });
      } catch (err) {
        console.error("Call invite error:", err);
        reply({ ok: false, reason: "error" });
      }
    });

    socket.on("call:accept", ({ callId } = {}) => {
      const call = calls.get(callId);
      if (!call || String(call.callee) !== String(me) || call.state !== "ringing") return;
      call.state = "active";
      call.answeredAt = Date.now();
      clearTimeout(call.timer);
      io.to(room(call.caller)).emit("call:accepted", { callId });
      socket.to(room(me)).emit("call:taken", { callId });     // stop ringing on my other tabs/devices
    });

    socket.on("call:reject", ({ callId } = {}) => {
      const call = calls.get(callId);
      if (!call || String(call.callee) !== String(me) || call.state !== "ringing") return;
      io.to(room(call.caller)).emit("call:rejected", { callId });
      socket.to(room(me)).emit("call:taken", { callId });
      finish(call);
      logCall(call, "declined");
    });

    socket.on("call:cancel", ({ callId } = {}) => {
      const call = calls.get(callId);
      if (!call || String(call.caller) !== String(me) || call.state !== "ringing") return;
      cancelRinging(call, socket);
    });

    // offers, answers and network details are passed straight to the other person
    socket.on("call:signal", ({ callId, data } = {}) => {
      const call = calls.get(callId);
      if (!call || call.state !== "active" || !data || typeof data !== "object") return;
      const mine = String(me);
      if (mine !== String(call.caller) && mine !== String(call.callee)) return;
      if (JSON.stringify(data).length > 20000) return;
      const other = mine === String(call.caller) ? call.callee : call.caller;
      io.to(room(other)).emit("call:signal", { callId, data });
    });

    socket.on("call:end", ({ callId } = {}) => {
      const call = calls.get(callId);
      if (!call) return;
      const mine = String(me);
      if (mine !== String(call.caller) && mine !== String(call.callee)) return;
      if (call.state === "ringing") {
        if (mine === String(call.caller)) cancelRinging(call, socket);
        return;
      }
      endActive(call, me, socket);
    });

    // closing the page or losing signal ends the call for the other person
    socket.on("disconnect", () => {
      const id = inCall.get(me);
      if (!id || isOnline(me)) return;
      const call = calls.get(id);
      if (!call) return;
      if (call.state === "active") endActive(call, me);
      else if (String(call.caller) === String(me)) cancelRinging(call);
    });
  });
};
