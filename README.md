# Raspberry Pi ChatGPT Voice Bot

A voice-enabled chatbot that runs on Raspberry Pi, combining voice recognition, natural language processing, and text-to-speech capabilities. The bot uses wake word detection, processes voice input, communicates with ChatGPT, and responds through speech synthesis.

## Features

- Wake word detection using Porcupine
- Voice recording with noise detection and automatic silence detection
- Speech-to-text using OpenAI's Whisper API
- Natural language processing using ChatGPT (GPT-4)
- Text-to-speech using Google Cloud Text-to-Speech
- Automatic audio playback of responses

## Prerequisites

### Hardware Requirements
- Raspberry Pi (any model that can run Node.js)
- Microphone (USB or built-in)
- Speakers or headphones

### Software Requirements
- Node.js v18.x or higher
- Sox (Sound eXchange) for audio recording
  ```bash
  sudo apt-get install sox
  ```
- arecord (usually pre-installed on Raspberry Pi)

### Required API Keys
You'll need to obtain the following API keys and credentials:
- OpenAI API key (for ChatGPT and Whisper)
- Porcupine Access Key
- Google Cloud credentials (for Text-to-Speech)
  - Client email
  - Private key
  - Project ID

## Installation

1. Clone the repository:
   ```bash
   git clone [your-repository-url]
   cd raspberry-pi-chatgpt-voice-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   OPENAI_API_KEY=your_openai_api_key
   PORCUPINE_ACCESS_KEY=your_porcupine_access_key
   GOOGLE_CLOUD_CLIENT_EMAIL=your_google_cloud_client_email
   GOOGLE_CLOUD_PRIVATE_KEY=your_google_cloud_private_key
   GOOGLE_CLOUD_PROJECT=your_google_cloud_project_id
   ```

## Usage

1. Start the application:
   ```bash
   node app.js
   ```

2. The bot will start listening for the wake word "Hi Chat"
3. After wake word detection, speak your message
4. The bot will process your speech, send it to ChatGPT, and respond through speech synthesis

## Troubleshooting

### Common Issues:
1. **Audio Recording Issues**
   - Ensure your microphone is properly connected and recognized
   - Check if Sox is installed correctly
   - Verify microphone permissions

2. **API Authentication Errors**
   - Double-check all API keys in the .env file
   - Ensure Google Cloud credentials are properly formatted
   - Verify OpenAI API key has sufficient credits

3. **Wake Word Detection Issues**
   - Ensure Porcupine model file is present in the correct location
   - Check if Porcupine access key is valid

## Dependencies

- node-record-lpcm16: For audio recording
- @picovoice/porcupine-node: For wake word detection
- axios: For API communications
- @google-cloud/text-to-speech: For speech synthesis
- dotenv: For environment variable management
- form-data: For API requests
