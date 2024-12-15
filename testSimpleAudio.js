const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function testSimpleAudio() {
    try {
        console.log('Testing audio output...');
        
        // Try to play a test sound using speaker-test
        console.log('Playing a test tone...');
        await execPromise('speaker-test -t sine -f 440 -l 1');
        
        console.log('\nIf you heard a beep, audio output is working!');
        console.log('If not, here are some troubleshooting steps:');
        console.log('1. Check if audio device is recognized:');
        console.log('   pactl list sinks');
        console.log('2. Check volume levels:');
        console.log('   alsamixer');
        console.log('3. Make sure PulseAudio is running:');
        console.log('   pulseaudio --start');
        
    } catch (error) {
        console.error('Error testing audio:', error);
        console.log('\nTrying alternative test method...');
        
        try {
            // Try using aplay with a sine wave
            await execPromise('aplay -D default -t raw -r 44100 -c 2 -f S16_LE /dev/zero -d 1');
            console.log('Alternative test completed. Did you hear anything?');
        } catch (err) {
            console.error('Alternative test also failed:', err);
            console.log('\nPlease check your audio setup:');
            console.log('1. Is your speaker/headphone connected?');
            console.log('2. Run: alsamixer (to check volume levels)');
            console.log('3. Run: aplay -l (to list playback devices)');
        }
    }
}

// Run the test
testSimpleAudio();
