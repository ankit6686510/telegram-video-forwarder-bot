# Telegram Video Forwarder

A Node.js application that forwards videos from Telegram channels/groups with forwarding restrictions by downloading and re-uploading them.

## Features

- 🎥 Automatically detects videos in chats with forwarding restrictions
- 📥 Downloads videos and re-uploads them to a target chat
- 🤖 Interactive commands for manual forwarding
- 📊 Progress tracking for downloads and uploads
- 🔐 Secure authentication using Telegram MTProto
- 📝 Comprehensive logging

## Prerequisites

- Node.js 18+ and npm
- A Telegram account
- API credentials from [my.telegram.org](https://my.telegram.org/apps)

## Installation

1. **Clone or download this repository**

2. **Install dependencies:**
   ```bash
   cd telegram-video-forwarder
   npm install
   ```

3. **Get your Telegram API credentials:**
   - Go to https://my.telegram.org/apps
   - Log in with your phone number
   - Create a new application
   - Copy your `API ID` and `API Hash`

4. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and fill in your credentials:
   ```env
   API_ID=your_api_id_here
   API_HASH=your_api_hash_here
   PHONE_NUMBER=+1234567890
   SESSION_NAME=telegram_forwarder
   TARGET_CHAT_ID=  # Optional: set default target chat
   LOG_LEVEL=info
   ```

## Usage

### Start the bot:

```bash
npm start
```

On first run, you'll be prompted to:
1. Enter the verification code sent to your Telegram
2. Enter your 2FA password (if enabled)

The bot will save your session, so you won't need to log in again.

### Available Commands

Send these commands to yourself on Telegram:

- `/start` - Show welcome message and instructions
- `/help` - Display available commands
- `/setchat <chat_id>` - Set target chat for forwarding
- `/status` - Show current configuration
- `/forward` - Reply to a video message to forward it manually

### Getting a Chat ID

To find a chat ID for use with `/setchat`:
1. Forward any message from the target chat to [@userinfobot](https://t.me/userinfobot)
2. The bot will reply with the chat ID
3. Use this ID with `/setchat <chat_id>`

### How It Works

1. **Automatic Mode:**
   - Set a target chat using `/setchat <chat_id>`
   - The bot monitors all your chats
   - When a video is posted in a chat with forwarding restrictions, it automatically downloads and re-uploads to your target chat

2. **Manual Mode:**
   - Reply to any video message with `/forward`
   - The bot will download and forward it to your configured target chat

## Project Structure

```
telegram-video-forwarder/
├── src/
│   ├── index.ts              # Main entry point
│   ├── client.ts             # Telegram client setup
│   ├── handlers/
│   │   ├── messageHandler.ts # Automatic video detection
│   │   └── commandHandler.ts # Bot commands
│   ├── services/
│   │   ├── videoDownloader.ts # Download videos
│   │   └── videoUploader.ts   # Upload videos
│   └── utils/
│       ├── config.ts         # Configuration
│       └── logger.ts         # Logging
├── downloads/                # Temporary video storage
├── logs/                     # Application logs
└── .env                      # Your credentials (not in git)
```

## Important Notes

### Legal & Ethical Considerations

⚠️ **Please use this tool responsibly:**
- Respect copyright and content ownership
- Only forward content you have permission to share
- Be aware of Telegram's Terms of Service
- Some channels disable forwarding for legitimate reasons (copyright, privacy)

### Rate Limits

- Telegram has rate limits on downloads and uploads
- The bot includes retry logic, but excessive use may result in temporary restrictions
- Use responsibly and avoid bulk forwarding

### Session Security

- Your session file contains authentication data
- Keep it secure and never share it
- The `.gitignore` file prevents it from being committed to git

## Troubleshooting

### "Missing required environment variable"
- Make sure you've created a `.env` file from `.env.example`
- Verify all required fields are filled in

### "Authentication error"
- Double-check your API_ID and API_HASH
- Ensure your phone number includes the country code (e.g., +1234567890)

### "Failed to download video"
- Check your internet connection
- Verify you have access to the source chat
- Some videos may be too large or have other restrictions

### Bot not detecting videos
- Ensure the chat has forwarding restrictions (otherwise normal forwarding works)
- Check that TARGET_CHAT_ID is set or use `/setchat`
- Review logs in `logs/combined.log` for details

## Development

### Build TypeScript:
```bash
npm run build
```

### Run in development mode:
```bash
npm run dev
```

## License

MIT

## Disclaimer

This tool is for educational purposes. Users are responsible for complying with Telegram's Terms of Service and applicable laws. The authors are not responsible for misuse of this software.
