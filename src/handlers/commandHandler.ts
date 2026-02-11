import { Api } from 'telegram';
import { NewMessage, NewMessageEvent } from 'telegram/events';
import { getClient } from '../client';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { downloadMedia, deleteMedia } from '../services/mediaDownloader';
import { uploadMedia } from '../services/mediaUploader';

let targetChatId: string | undefined = config.targetChatId;

export function registerCommandHandler(): void {
    const client = getClient();

    logger.info('Registering command handler...');

    client.addEventHandler(handleCommand, new NewMessage({ fromUsers: ['me'] }));
}

async function handleCommand(event: NewMessageEvent): Promise<void> {
    try {
        const message = event.message;
        const text = message.message;

        if (!text || !text.startsWith('/')) {
            return;
        }

        const [command, ...args] = text.split(' ');

        switch (command.toLowerCase()) {
            case '/start':
                await handleStart(message);
                break;
            case '/help':
                await handleHelp(message);
                break;
            case '/setchat':
                await handleSetChat(message, args);
                break;
            case '/status':
                await handleStatus(message);
                break;
            case '/forward':
                await handleForward(message, args);
                break;
            default:
                // Unknown command, ignore
                break;
        }
    } catch (error) {
        logger.error('Error handling command:', error);
    }
}

async function handleStart(message: Api.Message): Promise<void> {
    const helpText = `
 **Telegram Media Forwarder Bot**

This bot automatically forwards media from channels with forwarding restrictions or from a configured source channel.

**Commands:**
/start - Show this message
/help - Show available commands
/setchat <chat_id> - Set target chat for forwarding
/status - Show current configuration
/forward <reply_to_media> - Manually forward media

**How it works:**
1. Set a target chat using /setchat
2. Configure SOURCE_CHAT_ID in .env (optional) to forward everything from one channel
3. Or simply let the bot forward restricted media from any chat

Get started by setting a target chat!
  `.trim();

    await message.reply({ message: helpText });
    logger.info('Sent start message');
}

async function handleHelp(message: Api.Message): Promise<void> {
    const helpText = `
**Available Commands:**

/start - Initialize bot and show welcome message
/help - Show this help message
/setchat <chat_id> - Set default target chat for forwarding
/status - Show current bot configuration and statistics
/forward - Reply to a media message to forward it manually

**Tips:**
- To get a chat ID, forward a message from that chat to @userinfobot
- You can also set TARGET_CHAT_ID and SOURCE_CHAT_ID in your .env file
  `.trim();

    await message.reply({ message: helpText });
    logger.info('Sent help message');
}

async function handleSetChat(message: Api.Message, args: string[]): Promise<void> {
    if (args.length === 0) {
        await message.reply({ message: '❌ Please provide a chat ID. Usage: /setchat <chat_id>' });
        return;
    }

    const chatId = args[0];
    targetChatId = chatId;

    await message.reply({ message: `✅ Target chat set to: ${chatId}` });
    logger.info(`Target chat set to: ${chatId}`);
}

async function handleStatus(message: Api.Message): Promise<void> {
    const statusText = `
**Bot Status:**

📱 Phone: ${config.phoneNumber}
📥 Source Chat: ${config.sourceChatId || 'Any (Restricted Only)'}
🎯 Target Chat: ${targetChatId || 'Not set'}
📊 Log Level: ${config.logLevel}
✅ Status: Active

Use /setchat to change the target chat.
  `.trim();

    await message.reply({ message: statusText });
    logger.info('Sent status message');
}

async function handleForward(message: Api.Message, args: string[]): Promise<void> {
    // Check if this is a reply to a message
    if (!message.replyTo) {
        await message.reply({
            message: '❌ Please reply to a media message with /forward to forward it.'
        });
        return;
    }

    if (!targetChatId) {
        await message.reply({
            message: '❌ No target chat set. Use /setchat <chat_id> first.'
        });
        return;
    }

    try {
        const client = getClient();

        // Get the replied message
        const repliedMessage = await message.getReplyMessage();
        if (!repliedMessage || !repliedMessage.media) {
            await message.reply({ message: '❌ The replied message does not contain media.' });
            return;
        }

        await message.reply({ message: '⏬ Downloading media...' });

        // Download the media
        const mediaPath = await downloadMedia(repliedMessage);
        if (!mediaPath) {
            await message.reply({ message: '❌ Failed to download media.' });
            return;
        }

        await message.reply({ message: '⏫ Uploading media...' });

        // Upload to target chat
        const result = await uploadMedia(targetChatId, mediaPath, undefined, repliedMessage);

        // Clean up
        deleteMedia(mediaPath);

        if (result) {
            await message.reply({ message: '✅ Media forwarded successfully!' });
            logger.info('Manual forward completed');
        } else {
            await message.reply({ message: '❌ Failed to upload media.' });
        }
    } catch (error) {
        logger.error('Error in manual forward:', error);
        await message.reply({ message: '❌ An error occurred while forwarding.' });
    }
}
