// server.js
// Minimal WhatsApp group message sender using @open-wa/wa-automate
// Endpoint: POST /group_message { group_id: string, message: string }

const express = require("express");
const fs = require("fs");
const path = require("path");
const { create } = require("@open-wa/wa-automate");

const PORT = process.env.PORT || 3800;
const SESSION_DIR = path.join(__dirname, "session");

fs.mkdirSync(SESSION_DIR, { recursive: true });

let waClient = null;

// Start WA client and keep session on disk
create({
  sessionId: "wa-simple-group-server",
  authTimeout: 0, // wait forever for auth
  multiDevice: true,
  headless: true,
  useChrome: true,
  qrTimeout: 0, // do not time out QR
  killProcessOnBrowserClose: false,
  sessionDataPath: SESSION_DIR, // persist session
  restartOnCrash: (p) => p, // auto-restart client on crash
})
  .then((client) => {
    waClient = client;
    console.log("WhatsApp client ready. If prompted, scan the QR code in the logs.");

    client.onStateChanged((state) => {
      console.log("WA state:", state);
      if (["CONFLICT", "UNLAUNCHED"].includes(state)) client.forceRefocus();
    });

    client.onLogout(() => {
      console.error("Logged out. You may need to re-scan the QR.");
    });
  })
  .catch((err) => {
    console.error("Failed to init WhatsApp client:", err);
    process.exit(1);
  });

const app = express();
app.use(express.json({ limit: "256kb" }));

// POST /group_message { group_id: string, message: string }
app.post("/group_message", async (req, res) => {
  if (!waClient) return res.status(503).json({ error: "WhatsApp client not ready" });

  const { group_id, message } = req.body || {};
  if (
    typeof group_id !== "string" ||
    typeof message !== "string" ||
    !group_id.trim() ||
    !message.trim()
  ) {
    return res.status(400).json({ error: "group_id and message must be non-empty strings" });
  }

  // WhatsApp group chat IDs typically look like: "1234567890-1234567890@g.us"
  // If caller omitted the "@g.us" suffix, add it.
  let chatId = group_id.trim();
  if (!/@g\.us$/i.test(chatId)) chatId = `${chatId}@g.us`;

  try {
    const result = await waClient.sendText(chatId, message);
    return res.json({ ok: true, chatId, result });
  } catch (e) {
    console.error("Send failed:", e);
    return res.status(500).json({ ok: false, chatId, error: e.message });
  }
});

app.listen(PORT, () => console.log(`HTTP server listening on :${PORT}`));
