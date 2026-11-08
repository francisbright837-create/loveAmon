// AI companion ("Mia"): warm, human-sounding chat that is always honest about being an AI.
// Needs an ANTHROPIC_API_KEY environment variable (set it in the Render dashboard / your .env, never in client code).
const express = require("express");
const router = express.Router();

const MODEL = process.env.AI_MODEL || "claude-sonnet-5-5";
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

router.post("/chat", async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
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
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") {
    return res.status(400).json({ message: "Say something first 🙂" });
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 350, system: SYSTEM, messages: msgs })
    });
    const data = await r.json();
    if (!r.ok) {
      console.error("AI error:", r.status, data && data.error && data.error.message);
      return res.status(502).json({ message: `${NAME} is having trouble right now. Try again in a moment.` });
    }
    const reply = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    res.json({ name: NAME, reply: reply || "…" });
  } catch (err) {
    console.error("AI request failed:", err.message);
    res.status(502).json({ message: `${NAME} is having trouble right now. Try again in a moment.` });
  }
});

module.exports = router;
