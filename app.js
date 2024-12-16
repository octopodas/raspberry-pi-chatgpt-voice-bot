require('dotenv').config();
const fs = require("fs"); // Add file system import
const record = require("node-record-lpcm16");
const axios = require("axios");
const path = require('path');
const FormData = require('form-data');
const { Porcupine } = require("@picovoice/porcupine-node");

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

// Load system instructions from file
const systemInstructions = fs.readFileSync('system-instructions.txt', 'utf8');

// Function to remove markdown formatting from text
function cleanMarkdownFormatting(text) {
    return text
        .replace(/\*\*/g, '') // Remove bold formatting
        .replace(/\*/g, '')   // Remove italic formatting
        .replace(/\_\_/g, '') // Remove alternate bold formatting
        .replace(/\_/g, '')   // Remove alternate italic formatting
        .replace(/\`\`\`[\s\S]*?\`\`\`/g, '') // Remove code blocks
        .replace(/\`/g, '')   // Remove inline code
        .replace(/\#\#\#/g, '') // Remove h3 headers
        .replace(/\#\#/g, '')   // Remove h2 headers
        .replace(/\#/g, '')     // Remove h1 headers
        .trim();
}

// Function to handle ChatGPT conversation
async function processConversation(input, language) {
    try {
        console.log("chat input: ", input);
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                //model: "gpt-4-turbo-preview",
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemInstructions },
                    { role: "user", content: input }
                ],
            },
            {
                headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
            }
        );

        let chatResponse = response.data.choices[0].message.content;
        chatResponse = cleanMarkdownFormatting(chatResponse);
        
        console.log("ChatGPT:", chatResponse);

        // say.speak(chatResponse);
        await synthesizeSpeech(chatResponse, language);

        return chatResponse;
    } catch (error) {
        console.error("Error communicating with ChatGPT:", error.message);
        // say.speak("Sorry, I couldn't process your request.");
        await synthesizeSpeech("Sorry, I couldn't process your request.", language);
    }
}

// Function to record user's voice input
async function recordUserInput() {
    return new Promise((resolve, reject) => {
        const audioFilePath = path.join(__dirname, 'user_input.wav');
        console.log("Recording your message...");
        
        const recording = record.record({
            sampleRate: 44100,      // Higher sample rate
            channels: 1,
            audioType: 'wav',
            recorder: 'arecord',
            options: {
                // Use specific arecord options for better quality
                // device: 'hw:4,0',  // Razer Seiren Mini
                format: 'S16_LE',   // Signed 16-bit Little Endian
                rate: '44100',
                channels: '1',
                quiet: true
            }
        });

        const fileStream = fs.createWriteStream(audioFilePath);
        let silenceTimeout = null;
        
        // Voice detection parameters
        const VOICE_THRESHOLD = 300;    // Adjust based on debug output
        const ANALYSIS_WINDOW = 4410;    // 100ms at 44.1kHz
        let buffer = Buffer.alloc(0);
        
        fileStream.on('error', (err) => {
            console.error('Error writing to file:', err);
            recording.stop();
            reject(err);
        });

        fileStream.on('finish', () => {
            console.log("Recording saved successfully.");
            resolve(audioFilePath);
        });
        
        const audioStream = recording.stream();
        
        audioStream.on('data', (chunk) => {
            // Append new data to buffer
            buffer = Buffer.concat([buffer, chunk]);
            
            // Process complete windows
            while (buffer.length >= ANALYSIS_WINDOW) {
                const window = buffer.slice(0, ANALYSIS_WINDOW);
                buffer = buffer.slice(ANALYSIS_WINDOW);
                
                // Calculate audio level for this window
                let sum = 0;
                let max = 0;
                let min = 0;
                
                // Process as 16-bit PCM
                for (let i = 0; i < window.length - 1; i += 2) {
                    const sample = window.readInt16LE(i);
                    sum += Math.abs(sample);
                    max = Math.max(max, sample);
                    min = Math.min(min, sample);
                }
                
                const average = sum / (window.length / 2);
                
                // Debug output
                console.log({
                    avgLevel: average.toFixed(2),
                    maxSample: max,
                    minSample: min,
                    bufferSize: buffer.length,
                    isActive: average > VOICE_THRESHOLD
                });
                
                // Voice detection logic
                if (average > VOICE_THRESHOLD) {
                    if (silenceTimeout) {
                        clearTimeout(silenceTimeout);
                        silenceTimeout = null;
                    }
                } else {
                    if (!silenceTimeout) {
                        silenceTimeout = setTimeout(() => {
                            console.log("Voice pause detected, stopping recording.");
                            recording.stop();
                        }, 2000);
                    }
                }
            }
        });

        audioStream.on('error', (err) => {
            console.error('Recording error:', err);
            recording.stop();
            reject(err);
        });

        audioStream.pipe(fileStream);
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
        formData.append('response_format', 'verbose_json');

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

        return {
            text: response.data.text,
            language: response.data.language
        };
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
async function synthesizeSpeech(text, language) {
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

        // Map full language names to ISO codes
        const languageNameMap = {
            'english': 'en',
            'spanish': 'es',
            'french': 'fr',
            'german': 'de',
            'italian': 'it',
            'portuguese': 'pt',
            'dutch': 'nl',
            'polish': 'pl',
            'russian': 'ru',
            'japanese': 'ja',
            'korean': 'ko',
            'chinese': 'zh'
        };

        // Map ISO codes to Google TTS language codes and voice names
        const languageMap = {
            'en': { code: 'en-US', voice: 'en-US-Studio-O' },
            'es': { code: 'es-ES', voice: 'es-ES-Standard-A' },
            'fr': { code: 'fr-FR', voice: 'fr-FR-Standard-A' },
            'de': { code: 'de-DE', voice: 'de-DE-Standard-A' },
            'it': { code: 'it-IT', voice: 'it-IT-Standard-A' },
            'pt': { code: 'pt-PT', voice: 'pt-PT-Standard-A' },
            'nl': { code: 'nl-NL', voice: 'nl-NL-Standard-A' },
            'pl': { code: 'pl-PL', voice: 'pl-PL-Standard-A' },
            'ru': { code: 'ru-RU', voice: 'ru-RU-Standard-A' },
            'ja': { code: 'ja-JP', voice: 'ja-JP-Standard-A' },
            'ko': { code: 'ko-KR', voice: 'ko-KR-Standard-A' },
            'zh': { code: 'zh-CN', voice: 'zh-CN-Standard-A' }
        };

        // Convert full language name to ISO code
        const langCode = languageNameMap[language.toLowerCase()] || 'en';
        
        // Get language settings or default to English
        const langSettings = languageMap[langCode] || languageMap['en'];

        console.log("Detected language:", language);
        console.log("Language code:", langCode);
        console.log("Synthesizing speech for language:", langSettings.code);
        console.log("Voice name:", langSettings.voice);

        // Split text into phrases using punctuation marks
        const phrases = text.match(/[^.!?]+[.!?]+/g) || [text];

        // Process each phrase sequentially
        for (const phrase of phrases) {
            const trimmedPhrase = phrase.trim();
            if (!trimmedPhrase) continue;

            console.log("Processing phrase:", trimmedPhrase);

            // Construct the request for this phrase
            const request = {
                input: { text: trimmedPhrase },
                voice: { 
                    languageCode: langSettings.code,
                    name: langSettings.voice,
                    ssmlGender: 'FEMALE'
                },
                audioConfig: { audioEncoding: 'MP3' },
            };

            // Perform the text-to-speech request
            const [response] = await client.synthesizeSpeech(request);

            // Save to a temporary file and play it
            const tempFile = './temp-speech.mp3';
            await fs.promises.writeFile(tempFile, response.audioContent);
            
            // Play the audio using system audio player
            await new Promise((resolve, reject) => {
                const { exec } = require('child_process');
                exec(`play ${tempFile}`, (error) => {
                    if (error) {
                        console.error('Error playing audio:', error);
                        reject(error);
                    }
                    // Clean up the temporary file
                    fs.unlinkSync(tempFile);
                    resolve();
                });
            });
        }
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
            quiet: true,
            // device: 'hw:4,0'  // Razer Seiren Mini
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
                    console.log("Wake word detected!");

                    await synthesizeSpeech("Yes, how can I help you?", "english");
                    
                    // Set flag to prevent multiple simultaneous recordings
                    isProcessingVoice = true;

                    try {
                        // Record user's voice input
                        const audioFilePath = await recordUserInput();
                        
                        // Transcribe the audio
                        const transcription = await transcribeAudio(audioFilePath);
                        console.log("Transcribed text:", transcription.text);
                        console.log("Detected language:", transcription.language);
                        
                        // Process with ChatGPT
                        await processConversation(transcription.text, transcription.language);
                        
                        // Clean up the audio file
                        fs.unlinkSync(audioFilePath);
                    } catch (error) {
                        console.error("Error processing voice input:", error);
                        // say.speak("Sorry, there was an error with the recording. Please try again.");
                        await synthesizeSpeech("Sorry, there was an error with the recording. Please try again.", transcription.language);
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
