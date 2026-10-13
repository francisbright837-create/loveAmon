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

async function getIceServers() {
  if (cache.servers && Date.now() - cache.at < 5 * 60 * 1000) return cache.servers;
  const servers = [...STUN];

  if (process.env.TURN_URLS && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    servers.push({
      urls: process.env.TURN_URLS.split(",").map((u) => u.trim()).filter(Boolean),
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL
    });
  }

  if (process.env.METERED_API_URL) {
    try {
      const res = await fetch(process.env.METERED_API_URL);
      const extra = await res.json();
      if (res.ok && Array.isArray(extra)) servers.push(...extra);
    } catch (err) {
      console.error("Could not fetch TURN servers:", err.message);
    }
  }

  cache = { at: Date.now(), servers };
  return servers;
}

router.get("/ice", async (req, res) => {
  try {
    res.json({ iceServers: await getIceServers() });
  } catch (err) {
    res.json({ iceServers: STUN });
  }
});

module.exports = router;
module.exports.getIceServers = getIceServers;
