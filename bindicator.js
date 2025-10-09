// app.js
// Uses the built-in @open-wa EASY API at http://localhost:3800/sendText

const fs = require('fs');
const yaml = require('js-yaml');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const BASE_URL = process.env.WA_BASE_URL || 'http://localhost:3800';
const SENDTEXT_PATH = process.env.WA_SENDTEXT_PATH || '/sendText';
const API_KEY = process.env.WA_API_KEY || ''; // set if you started open-wa with -k

(async function main() {
  const config = loadConfig();

  // Build message
  const bins = parseBins(config.bins);
  const binDay = getNextBinDay(config.bin_day_of_week);
  const dueBins = getDueBins(bins, binDay);
  const message = createBinMessage(dueBins, binDay, config);

  try {
    const to = toJid(config.bin_chat);
    await postJSON(`${BASE_URL}${SENDTEXT_PATH}`, {
      args: { to, content: message }
    }, API_KEY && { 'x-api-key': API_KEY });

    console.log('Message Sent');
    console.log(message);
  } catch (e) {
    console.error('Send failed:', e.message);
    process.exitCode = 1;
  }
})();

function loadConfig() {
  return yaml.load(fs.readFileSync('config.yaml', 'utf8'));
}

function parseBins(binsConfig) {
  return binsConfig.map(bin => ({
    ...bin,
    startDate: new Date(bin.startDate)
  }));
}

function getNextBinDay(targetDay) {
  const date = new Date();
  while (date.getDay() !== targetDay) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

function getDueBins(bins, binDay) {
  return bins.filter(bin => {
    const diffTime = Math.abs(binDay - bin.startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    return diffWeeks % bin.cycleWeeks === 0;
  });
}

function createBinMessage(dueBins, binDay, config) {
  const footer = `\n\nMore info at: ${config.website_url}`;

  if (dueBins.length === 0) {
    return `No bins scheduled for collection this week.${footer}`;
  }

  const binColors = dueBins.map(bin => bin.color).join('\n\n');
  return `Bins for collection this week (${binDay.toDateString()}) :\n\n${binColors}${footer}`;
}

// ---- HELPER: normalise chat id to a WhatsApp JID ----
function toJid(input) {
  let s = String(input || '').trim();
  if (!s) throw new Error('Empty bin_chat in config');

  // already a JID?
  if (/@(c|g)\.us$/i.test(s)) return s;

  // remove spaces/plus/dashes for number detection
  const digits = s.replace(/\D/g, '');

  // group ids usually contain a hyphen; if user passed just the numeric parts joined by '-', treat as group
  if (s.includes('-')) return `${s}@g.us`;

  // otherwise assume it's a direct number
  if (!digits) throw new Error(`Invalid chat id: ${s}`);
  return `${digits}@c.us`;
}

// ---- Minimal POST JSON helper using core modules ----
function postJSON(urlString, payload, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const data = JSON.stringify(payload);

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + (url.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...extraHeaders
      },
      timeout: 15000
    };

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(options, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        // 2xx => success
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { return resolve(body ? JSON.parse(body) : {}); }
          catch { return resolve({ raw: body }); }
        }
        // non-2xx => error
        try {
          const json = body ? JSON.parse(body) : {};
          return reject(new Error(json?.error || `HTTP ${res.statusCode}: ${body}`));
        } catch {
          return reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Request timed out')));

    req.write(data);
    req.end();
  });
}
