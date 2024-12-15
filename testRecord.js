const record = require('node-record-lpcm16');

console.log("Starting recording test...");

// First, let's log the audio device information
const { execSync } = require('child_process');
try {
    console.log("\nAudio device information:");
    console.log(execSync('pactl list sources').toString());
} catch (err) {
    console.error("Error getting audio device info:", err);
}

const recording = record.record({
    sampleRateHertz: 16000,
    channels: 1,
    encoding: 'signed-integer',
    recordProgram: 'parec',
    verbose: true,
    audioType: 'raw',
    recordParams: [
        '--device=alsa_input.usb-Razer_Inc_Razer_Seiren_Mini_UC2119L03206637-00.mono-fallback',
        '--format=s16le',
        '--rate=16000',
        '--channels=1',
        '--latency-msec=20',
        '--process-time-msec=10',
        '--volume=1.5'
    ]
}).stream();

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

recording.on('error', (err) => {
    console.error('Recording error:', err);
});

let maxValue = 0;
let minValue = 0;
let totalChunks = 0;

recording.on('data', (data) => {
    totalChunks++;
    // Convert buffer to 16-bit integers
    const samples = new Int16Array(data.buffer);
    const chunkMax = Math.max(...samples);
    const chunkMin = Math.min(...samples);
    
    maxValue = Math.max(maxValue, chunkMax);
    minValue = Math.min(minValue, chunkMin);
    
    if (totalChunks % 10 === 0) {  // Log every 10th chunk to avoid spam
        console.log("Audio stats:", {
            chunkSize: data.length,
            samplesCount: samples.length,
            maxValue,
            minValue,
            totalChunks
        });
    }
});

// Stop recording after 5 seconds
setTimeout(() => {
    recording.destroy();
    console.log("\nFinal recording stats:", {
        maxValue,
        minValue,
        totalChunks
    });
    console.log("Stopped recording.");
}, 5000);
