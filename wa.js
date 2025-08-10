const { create } = require('@open-wa/wa-automate');

create({
  headless: true, // Set to false if you want to see the browser
  qrTimeout: 0,   // Never timeout waiting for QR scan
  authTimeout: 60, // Wait 60 seconds for login
  multiDevice: true, // Enable if using multi-device
}).then(client => start(client));

function start(client) {
  const bin_chat = '120363402755630431@g.us';

  const bins = [
    { color: "🟦 Blue", startDate: new Date(2025, 5, 5), cycleWeeks: 4 },
    { color: "🟩 Green", startDate: new Date(2025, 5, 5), cycleWeeks: 1 },
    { color: "🟫 Brown", startDate: new Date(2025, 5, 5), cycleWeeks: 4 },
    { color: "⬛ Black", startDate: new Date(2025, 12, 20), cycleWeeks: 2 }
  ];

  // Get next Thursday
  const binDay = new Date();

  while (binDay.getDay() !== 4) {
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
    message += "Bins for collection this week (" + binDay.toString() + ") :\n\n";
    message += dueBins.map(bin => bin.color).join('\n\n');
  } else {
    message += "No bins scheduled for collection this week.";
  }


  client.sendText(bin_chat, message);
  console.log('Message Sent');
  console.log(message);
}

