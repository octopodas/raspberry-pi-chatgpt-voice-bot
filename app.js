require('dotenv').config();

const record = require("node-record-lpcm16");
const axios = require("axios");
// const say = require("say");
const fs = require("fs");
const FormData = require('form-data');
const { Porcupine } = require("@picovoice/porcupine-node");
const path = require('path');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');

// OpenAI API Key
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORCUPINE_ACCESS_KEY = process.env.PORCUPINE_ACCESS_KEY;
// Paths to Porcupine keyword file
const KEYWORD_FILE_PATH = "./porcupine-model/hi-chat_en_raspberry-pi_v3_0_0.ppn";

// Initialize Porcupine
let porcupine;
try {
    porcupine = new Porcupine(
        PORCUPINE_ACCESS_KEY,
        [KEYWORD_FILE_PATH],
        [0.5]
      );

} catch (error) {
    console.error(`Failed to initialize Porcupine: ${error}`);
    process.exit(1);
}

// Check Porcupine properties
const frameLength = porcupine.frameLength; // The number of samples per frame
const sampleRate = porcupine.sampleRate;   // Should be 16000
console.log(`Porcupine initialized with frameLength=${frameLength}, sampleRate=${sampleRate}`);

// Function to handle ChatGPT conversation
async function processConversation(input) {
    try {
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-4o",
                messages: [{ role: "user", content: input }],
            },
            {
                headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
            }
        );

        const chatResponse = response.data.choices[0].message.content;
        console.log("ChatGPT:", chatResponse);

        // Speak the response
        // say.speak(chatResponse);
        await synthesizeSpeech(chatResponse);

        return chatResponse;
    } catch (error) {
        console.error("Error communicating with ChatGPT:", error.message);
        // say.speak("Sorry, I couldn't process your request.");
        await synthesizeSpeech("Sorry, I couldn't process your request.");
    }
}

// Function to record user's voice input
async function recordUserInput() {
    return new Promise((resolve, reject) => {
        const audioFilePath = path.join(__dirname, 'user_input.wav');
        console.log("Recording your message...");
        
        const recording = record.record({
            sampleRate: 16000,
            channels: 1,
            audioType: 'wav',
            recorder: 'arecord',
            options: {
                quiet: true
            }
        });

        const fileStream = fs.createWriteStream(audioFilePath);
        
        fileStream.on('error', (err) => {
            console.error('Error writing to file:', err);
            recording.stop();
            reject(err);
        });

        fileStream.on('finish', () => {
            console.log("Recording saved successfully.");
            resolve(audioFilePath);
        });
        
        recording.stream()
            .on('error', (err) => {
                console.error('Recording error:', err);
                recording.stop();
                reject(err);
            })
            .pipe(fileStream);

        setTimeout(() => {
            recording.stop();
            console.log("Recording stopped.");
        }, 5000);
    });
}

// Function to transcribe audio using Whisper API
async function transcribeAudio(audioFilePath) {
    try {
        // Check if file exists and is readable
        if (!fs.existsSync(audioFilePath)) {
            throw new Error('Audio file does not exist');
        }

        // Check if OPENAI_API_KEY is defined
        if (!OPENAI_API_KEY) {
            throw new Error('OpenAI API key is not configured');
        }

        const formData = new FormData();
        
        // Read the file into a buffer first
        const fileBuffer = await fs.promises.readFile(audioFilePath);
        
        formData.append('file', fileBuffer, {
            filename: 'audio.wav',
            contentType: 'audio/wav'
        });
        formData.append('model', 'whisper-1');
        formData.append('language', 'en');

        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', 
            formData,
            {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    ...formData.getHeaders(),
                    'Content-Type': 'multipart/form-data'
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            }
        );

        return response.data.text;
    } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error('API Error:', error.response.data);
            throw new Error(`Transcription failed: ${error.response.data.error?.message || 'Unknown API error'}`);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received:', error.request);
            throw new Error('No response received from OpenAI API');
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error setting up request:', error.message);
            throw error;
        }
    }
}

// Function to synthesize speech using Google Cloud Text-to-Speech API
async function synthesizeSpeech(text) {
    try {
        const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY
                                        .replace(/\\n/g, '\n')
                                        .replace(/"$/, '')
                                        .replace(/^"/, '');

        const client = new TextToSpeechClient({
            credentials: {
                client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
                private_key: privateKey
            },
            projectId: process.env.GOOGLE_CLOUD_PROJECT
        });

        // Construct the request
        const request = {
            input: { text: text },
            voice: { 
                languageCode: 'en-US',
                name: 'en-US-Standard-D',
                ssmlGender: 'NEUTRAL'
            },
            audioConfig: { audioEncoding: 'MP3' },
        };

        // Perform the text-to-speech request
        const [response] = await client.synthesizeSpeech(request);

        // Save to a temporary file and play it
        const tempFile = './temp-speech.mp3';
        await fs.promises.writeFile(tempFile, response.audioContent);
        
        // Play the audio using system audio player
        const { exec } = require('child_process');
        exec(`play ${tempFile}`, (error) => {
            if (error) {
                console.error('Error playing audio:', error);
            }
            // Clean up the temporary file
            fs.unlinkSync(tempFile);
        });
    } catch (error) {
        console.error('Error synthesizing speech:', error);
    }
}

function startListening() {
    console.log("Listening for the wake word...");

    let audioBuffer = Buffer.alloc(0);
    let isProcessingVoice = false;

    // Start the microphone
    const mic = record.record({
        sampleRate: 16000,
        channels: 1,
        audioType: 'raw',
        recorder: 'arecord',
        options: {
            quiet: true
        }
    });

    mic.stream()
        .on('data', async (data) => {
            if (isProcessingVoice) return;

            // Append new data to the buffer
            audioBuffer = Buffer.concat([audioBuffer, data]);

            // Each sample is 16 bits (2 bytes)
            const bytesPerSample = 2;
            const requiredBytes = frameLength * bytesPerSample;

            // Process as many frames as possible from the buffer
            while (audioBuffer.length >= requiredBytes) {
                const frameBuffer = audioBuffer.slice(0, requiredBytes);
                audioBuffer = audioBuffer.slice(requiredBytes);

                // Convert the frame buffer to a typed array of 16-bit integers
                const frame = new Int16Array(frameLength);
                for (let i = 0; i < frameLength; i++) {
                    frame[i] = frameBuffer.readInt16LE(i * bytesPerSample);
                }

                // Process the frame with Porcupine
                const keywordIndex = porcupine.process(frame);
                if (keywordIndex >= 0 && !isProcessingVoice) {
                    // Wake word detected
                    console.log("Wake word detected!");
                    // say.speak("Yes, how can I help you?");
                    
                    // Set flag to prevent multiple simultaneous recordings
                    isProcessingVoice = true;

                    try {
                        // Wait a moment for the response to be spoken
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        
                        // Record user's voice input
                        const audioFilePath = await recordUserInput();
                        
                        // Transcribe the audio
                        const transcription = await transcribeAudio(audioFilePath);
                        console.log("Transcribed text:", transcription);
                        
                        // Process with ChatGPT
                        await processConversation(transcription);
                        
                        // Clean up the audio file
                        fs.unlinkSync(audioFilePath);
                    } catch (error) {
                        console.error("Error processing voice input:", error);
                        // say.speak("Sorry, there was an error with the recording. Please try again.");
                        await synthesizeSpeech("Sorry, there was an error with the recording. Please try again.");
                    } finally {
                        isProcessingVoice = false;
                    }
                }
            }
        })
        .on('error', (err) => {
            console.error("Microphone error:", err);
        });

    // Start recording
    mic.start();
}

// Verify environment variables are loaded
if (!process.env.GOOGLE_CLOUD_CLIENT_EMAIL || !process.env.GOOGLE_CLOUD_PRIVATE_KEY) {
    console.error('Missing required environment variables. Please check your .env file.');
    process.exit(1);
}

startListening();

// Clean up on exit
process.on('SIGINT', () => {
    console.log("Shutting down...");
    record.stop();
    porcupine.release();
    process.exit(0);
});