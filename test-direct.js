const { spawn } = require('child_process');
const fs = require('fs');

console.log("Starting recording...");

const arecord = spawn('arecord', [
  '-D', 'plughw:1,0',
  '-f', 'S16_LE',
  '-r', '16000',
  '-c', '1',
  '-t', 'raw'
]);

arecord.stdout.on('data', (data) => {
  console.log(`Received chunk of ${data.length} bytes`);
});

arecord.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});

arecord.on('error', (error) => {
  console.error(`Error: ${error.message}`);
});

arecord.on('close', (code) => {
  console.log(`Child process exited with code ${code}`);
});

// Stop recording after 5 seconds
setTimeout(() => {
  arecord.kill();
  console.log("Stopped recording.");
}, 5000);
