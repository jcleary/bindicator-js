const { create } = require('@open-wa/wa-automate');
const fs = require('fs');
const yaml = require('js-yaml');

create({
  headless: true, // Set to false if you want to see the browser
  qrTimeout: 0,   // Never timeout waiting for QR scan
  authTimeout: 60, // Wait 60 seconds for login
  multiDevice: true, // Enable if using multi-device
}).then(client => start(client));

function start(client) {
  const config = loadConfig();
  const bins = parseBins(config.bins);
  const binDay = getNextBinDay(config.bin_day_of_week);
  const dueBins =getDueBins(bins, binDay);
  const message = createBinMessage(dueBins, binDay, config);

  client.sendText(config.bin_chat, message);
  console.log('Message Sent');
  console.log(message);
}

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



