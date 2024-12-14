const record = require('node-record-lpcm16');

console.log("Starting recording...");
const mic = record.start({
  sampleRateHertz: 16000,
  threshold: 0,
  verbose: true,
  recordProgram: 'rec', // on Linux or macOS, use 'sox' or 'arecord' if needed
  silence: '0.0'
});

mic.on('data', (data) => {
  console.log("Received audio data chunk of length:", data.length);
});

setTimeout(() => {
  record.stop();
  console.log("Stopped recording.");
}, 5000);
