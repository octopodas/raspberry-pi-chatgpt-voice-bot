# Raspberry Pi ChatGPT Voice Bot

A voice interaction bot that uses speech recognition and ChatGPT for natural conversations.

## Prerequisites

Before running the application, you need to install the following dependencies:

### Audio Dependencies
```bash
# Install PulseAudio and audio utilities
sudo apt-get update
sudo apt-get install pulseaudio pulseaudio-utils alsa-utils

# Start PulseAudio server (if not already running)
pulseaudio --start
```

### Node.js Dependencies
```bash
# Install Node.js dependencies
npm install
```

## Audio Device Setup

1. First, check if your microphone is properly connected and recognized:
```bash
arecord -l
```

2. List PulseAudio sources:
```bash
pactl list sources
```

3. Test microphone levels:
```bash
alsamixer
```
Use F6 to select your sound card if needed.

## Testing the Recording

1. First, check if your microphone is properly connected and recognized:
```bash
arecord -l
```

2. Test microphone levels:
```bash
alsamixer
```
Use F6 to select your sound card if needed.

3. Run the recording test:
```bash
# Enable debug output
DEBUG=record node testRecord.js
```

## Troubleshooting

If you encounter recording issues:

1. Check if your microphone is the default input device:
```bash
arecord -L
```

2. Test direct recording with PulseAudio:
```bash
parec --format=s16le --rate=44100 --channels=1 test.wav
```

3. Common issues:
- "Device or resource busy": Make sure no other application is using the microphone
- Audio permission issues: Make sure your user has permission to access audio devices:
```bash
sudo usermod -a -G audio $USER
sudo usermod -a -G pulse-access $USER
```
- PulseAudio not running: Start it with `pulseaudio --start`

## License

MIT
