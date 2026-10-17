const express = require("express");
const router = express.Router();

// Voice and video calls go phone-to-phone. The phones find each other with these helper servers.
//  - STUN (free, public) works for many connections.
//  - TURN relays the call when a direct connection is impossible (common on mobile data).
//    Add TURN to Render > Environment (see the instructions):
//      TURN_URLS="turn:your-server:3478,turns:your-server:5349"  TURN_USERNAME=...  TURN_CREDENTIAL=...
//    or, with a Metered.ca account:  METERED_API_URL="https://YOURAPP.metered.live/api/v1/turn/credentials?apiKey=YOURKEY"
const STUN = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }];

let cache = { at: 0, servers: null };

// values pasted into Render sometimes have spaces or quotation marks around them - ignore those
const clean = (v) => (typeof v === "string" ? v.trim().replace(/^["']+|["']+$/g, "").trim() : "");

// which relay settings are present? (names only - never the values)
function relayStatus() {
  const missing = ["TURN_URLS", "TURN_USERNAME", "TURN_CREDENTIAL"].filter((name) => !clean(process.env[name]));
  const metered = !!clean(process.env.METERED_API_URL);
  return { configured: metered || missing.length === 0, usingMeteredUrl: metered, missing: metered ? [] : missing };
}

async function getIceServers() {
  if (cache.servers && Date.now() - cache.at < 5 * 60 * 1000) return cache.servers;
  const servers = [...STUN];

  if (clean(process.env.TURN_URLS) && clean(process.env.TURN_USERNAME) && clean(process.env.TURN_CREDENTIAL)) {
    servers.push({
      urls: clean(process.env.TURN_URLS).split(",").map(clean).filter(Boolean),
      username: clean(process.env.TURN_USERNAME),
      credential: clean(process.env.TURN_CREDENTIAL)
    });
  }

  if (clean(process.env.METERED_API_URL)) {
    try {
      const res = await fetch(clean(process.env.METERED_API_URL));
      const extra = await res.json();
      if (res.ok && Array.isArray(extra)) servers.push(...extra);
    } catch (err) {
      console.error("Could not fetch TURN servers:", err.message);
    }
  }

  cache = { at: Date.now(), servers };
  const st = relayStatus();
  console.log("Call relay (TURN):", st.configured ? "configured" : "NOT configured, missing: " + st.missing.join(", "));
  return servers;
}

router.get("/ice", async (req, res) => {
  try {
    res.json({ iceServers: await getIceServers(), relay: relayStatus() });
  } catch (err) {
    res.json({ iceServers: STUN, relay: relayStatus() });
  }
});

module.exports = router;
module.exports.getIceServers = getIceServers;
