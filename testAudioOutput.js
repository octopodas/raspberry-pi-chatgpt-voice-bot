const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

require('dotenv').config();

async function testAudioOutput() {
    try {
        // Initialize the client with credentials
        const client = new TextToSpeechClient({
            credentials: {
                client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
                private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.replace(/\\n/g, '\n')
            }
        });

        // Construct the request
        const request = {
            input: { text: 'Hello! This is a test of the audio output system.' },
            voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' },
            audioConfig: { audioEncoding: 'MP3' },
        };

        console.log('Generating speech...');
        // Perform the text-to-speech request
        const [response] = await client.synthesizeSpeech(request);

        // Write the audio content to a file
        const outputFile = 'test_output.mp3';
        await fs.writeFile(outputFile, response.audioContent, 'binary');
        console.log(`Audio content written to: ${outputFile}`);

        // Play the audio using PulseAudio's paplay
        console.log('Playing audio...');
        try {
            await execPromise(`paplay ${outputFile}`);
        } catch (playError) {
            console.log('Failed to play with paplay, trying with mpg123...');
            await execPromise(`mpg123 ${outputFile}`);
        }
        
        // Clean up
        await fs.unlink(outputFile);
        console.log('Test completed successfully!');

    } catch (error) {
        console.error('Error:', error);
        
        // Check for missing credentials
        if (!process.env.GOOGLE_CLOUD_CLIENT_EMAIL || !process.env.GOOGLE_CLOUD_PRIVATE_KEY) {
            console.error('\nMissing Google Cloud credentials in .env file!');
            console.log('Make sure your .env file contains:');
            console.log('GOOGLE_CLOUD_CLIENT_EMAIL=your-service-account-email');
            console.log('GOOGLE_CLOUD_PRIVATE_KEY=your-private-key');
        }
        
        // Check for audio playback issues
        if (error.code === 'ENOENT' && error.cmd?.includes('paplay')) {
            console.log('\nTroubleshooting audio playback:');
            console.log('1. Make sure PulseAudio is installed and running:');
            console.log('   sudo apt-get install pulseaudio mpg123');
            console.log('   pulseaudio --start');
            console.log('\n2. Check audio devices:');
            console.log('   pactl list sinks');
        }
    }
}

// Run the test
testAudioOutput();
