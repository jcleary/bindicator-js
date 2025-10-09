// app.js
// Rewritten: sends via local API POST /group_message instead of wa-automate client

const fs = require('fs');
const yaml = require('js-yaml');
const http = require('http');
const https = require('https');
const { URL } = require('url');

(async function main() {
  const config = loadConfig();

  // Build message
  const bins = parseBins(config.bins);
  const binDay = getNextBinDay(config.bin_day_of_week);
  const dueBins = getDueBins(bins, binDay);
  const message = createBinMessage(dueBins, binDay, config);

  try {
    // Send message to the group
    await postJSON('http://localhost:3800/group_message', {
      group_id: config.bin_chat,
      message
    });
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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Minimal helper to POST JSON with core Node modules
function postJSON(urlString, payload) {
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
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 15000
    };

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(options, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            return resolve(json);
          }
          return reject(new Error(json?.error || `HTTP ${res.statusCode}: ${body}`));
        } catch (e) {
          return reject(new Error(`Invalid JSON response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Request timed out'));
    });

    req.write(data);
    req.end();
  });
}
