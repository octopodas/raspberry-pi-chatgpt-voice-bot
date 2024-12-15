const record = require('node-record-lpcm16');

console.log("Starting recording...");
const recording = record.record({
  sampleRateHertz: 16000,
  threshold: 0,
  verbose: true,
  recordProgram: 'arecord',
  audioDevice: 'hw:4,0', // Razer Seiren Mini
  silence: '0.0'
});

recording.stream()
  .on('error', (err) => {
    console.error('Recording error:', err);
  })
  .on('data', (data) => {
    console.log("Received audio data chunk of length:", data.length);
  });

console.log("Recording for 5 seconds...");
setTimeout(() => {
  recording.stop();
  console.log("Stopped recording.");
}, 5000);
