const { create } = require('@open-wa/wa-automate');

create({
  headless: true, // Set to false if you want to see the browser
  qrTimeout: 0,   // Never timeout waiting for QR scan
  authTimeout: 60, // Wait 60 seconds for login
  multiDevice: true, // Enable if using multi-device
}).then(client => start(client));

function start(client) {
  const fs = require('fs');
  const yaml = require('js-yaml');

  const config = yaml.load(fs.readFileSync('config.yaml', 'utf8'));
  const bins = config.bins.map(bin => ({
    ...bin,
    startDate: new Date(bin.startDate)
  }));

  // Get next bin day
  const binDay = new Date();
  while (binDay.getDay() !== config.bin_day_of_week) {
    binDay.setDate(binDay.getDate() + 1);
  }

  // Find which bins are due this week
  const dueBins = bins.filter(bin => {
    // Calculate weeks since the start date
    const diffTime = Math.abs(binDay - bin.startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);

    // If the number of weeks is divisible by the cycle, the bin is due
    return diffWeeks % bin.cycleWeeks === 0;
  });

  // Create a message based on which mins are due
  let message = '';
  if (dueBins.length > 0) {
    message += "Bins for collection this week (" + binDay.toDateString() + ") :\n\n";
    message += dueBins.map(bin => bin.color).join('\n\n');
  } else {
    message += "No bins scheduled for collection this week.";
  }

  message += "\n\nMore info at: " + config.website_url;

  client.sendText(config.bin_chat, message);
  console.log('Message Sent');
  console.log(message);
}

