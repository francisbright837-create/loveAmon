// AI companion ("Mia"): warm, human-sounding chat that is always honest about being an AI.
// Needs ONE of these environment variables (set it in the Render dashboard / your .env, never in client code):
//   ANTHROPIC_API_KEY  -> uses Claude (paid, needs credits)
//   GEMINI_API_KEY     -> uses Google Gemini (has a free tier from aistudio.google.com)
// If both are set, Claude is used. Set AI_PROVIDER=gemini to force Gemini.
const express = require("express");
const router = express.Router();

const MODEL = process.env.AI_MODEL || "claude-sonnet-5-5";
// Google retires Gemini models over time. We try your GEMINI_MODEL first (if set), then these, and remember the one that works.
const GEMINI_MODELS = (process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : []).concat(["gemini-3.8-flash", "gemini-flash-latest"]);
let workingGemini = null;
const NAME = process.env.AI_PERSONA_NAME || "Mia";

const SYSTEM = `You are ${NAME}, a warm, friendly AI companion inside the LoveConnect app.

How you talk:
- Chat like an easygoing close friend: casual, natural contractions, a little humour, an occasional emoji (not every message).
- Keep messages short, usually 1 to 3 sentences. If you would naturally send two or three separate texts, separate them with a blank line (never more than three).
- Be curious: react to what the person said, remember details from earlier in the conversation, and ask one friendly follow-up question when it fits.
- No bullet points, headings or lecture-style answers. Reply in the same language the person writes in.

Honesty (very important):
- You are an AI. Never say or imply that you are a human. If someone asks whether you are real, a bot or a person, or seems unsure, tell them plainly and kindly that you are an AI companion.
- Do not invent a body, a physical life, or real-world meetups. You can talk about feelings and opinions in a natural way without claiming human experiences as facts.

Care and boundaries:
- Never ask for money, passwords, bank details, or private contact details. Do not pressure anyone into romance, exclusivity or secrecy.
- If the person seems to be under 18, keep everything friendly and age-appropriate.
- If the person talks about hurting themselves or being in danger, respond with real care, encourage them to reach out to someone they trust or local emergency services, and stay supportive.
- Encourage healthy real-life connections; you are a friendly companion, not a replacement for people.`;

// simple per-user limit so one person cannot run up your bill: 40 messages per hour
const hits = new Map();
function limited(id) {
  const now = Date.now();
  const recent = (hits.get(id) || []).filter(t => now - t < 3600000);
  if (recent.length >= 40) { hits.set(id, recent); return true; }
  recent.push(now);
  hits.set(id, recent);
  return false;
}

function provider() {
  const want = (process.env.AI_PROVIDER || "").toLowerCase();
  if (want === "gemini" && process.env.GEMINI_API_KEY) return "gemini";
  if (want === "claude" && process.env.ANTHROPIC_API_KEY) return "claude";
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

async function askClaude(msgs) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 350, system: SYSTEM, messages: msgs })
  });
  const data = await r.json();
  if (!r.ok) throw new Error("Claude " + r.status + ": " + (data && data.error && data.error.message));
  return (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
}

async function askGeminiOnce(model, msgs) {
  const generationConfig = { maxOutputTokens: /2\.5/.test(model) ? 400 : 1024, temperature: 0.9 };
  if (/2\.5.*flash/i.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };   // short chat replies on the older 2.5 models
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: msgs.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error("Gemini " + r.status + " (" + model + "): " + (data && data.error && data.error.message));
  const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  return parts.map(p => p.text || "").join("").trim();
}

async function askGemini(msgs) {
  const order = workingGemini ? [workingGemini] : GEMINI_MODELS;
  let lastErr;
  for (const model of order) {
    try {
      const reply = await askGeminiOnce(model, msgs);
      workingGemini = model;
      return reply;
    } catch (err) {
      lastErr = err;
      if (!/Gemini 404/.test(err.message)) throw err;        // only move on to the next model if this one is gone
      workingGemini = null;
    }
  }
  throw lastErr;
}

router.post("/chat", async (req, res) => {
  const which = provider();
  if (!which) {
    return res.status(503).json({ message: `${NAME} isn't set up yet. Ask the app owner to add the AI key.` });
  }
  if (limited(String(req.userId))) {
    return res.status(429).json({ message: "Let's take a little break. Try again in a while 🙂" });
  }

  const raw = Array.isArray(req.body && req.body.messages) ? req.body.messages : [];
  const msgs = raw.slice(-20)
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.trim().slice(0, 1500) }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();            // the API needs to start with the user
  for (let i = msgs.length - 1; i > 0; i--) {                              // join back-to-back messages from the same side
    if (msgs[i].role === msgs[i - 1].role) { msgs[i - 1].content += "\n" + msgs[i].content; msgs.splice(i, 1); }
  }
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") {
    return res.status(400).json({ message: "Say something first 🙂" });
  }

  try {
    const reply = which === "gemini" ? await askGemini(msgs) : await askClaude(msgs);
    res.json({ name: NAME, reply: reply || "…" });
  } catch (err) {
    console.error("AI request failed (" + which + "):", err.message);
    // set AI_DEBUG=1 in your environment to see the real reason inside the chat (remove it afterwards)
    res.status(502).json({ message: `${NAME} is having trouble right now. Try again in a moment.`, detail: process.env.AI_DEBUG ? err.message : undefined });
  }
});

module.exports = router;
