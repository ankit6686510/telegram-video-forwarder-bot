import { Api } from 'telegram';
import { NewMessage, NewMessageEvent } from 'telegram/events';
import { getClient } from '../client';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { downloadMedia, deleteMedia } from '../services/mediaDownloader';
import { uploadMedia } from '../services/mediaUploader';

export function registerMessageHandler(): void {
    const client = getClient();

    logger.info('Registering message handler...');

    const eventFilter: any = {};
    if (config.sourceChatId) {
        logger.info(`Configured to only forward messages from source chat: ${config.sourceChatId}`);
        // Note: detailed filtering happens inside handler for better logging
    }

    client.addEventHandler(handleNewMessage, new NewMessage(eventFilter));
}

async function handleNewMessage(event: NewMessageEvent): Promise<void> {
    try {
        const message = event.message;

        // Skip if no media
        if (!message.media) {
            return;
        }

        // Source chat filtering
        if (config.sourceChatId) {
            const chatId = message.chatId?.toString();
            // Handle both raw ID and -100 prefix format
            const sourceId = config.sourceChatId.toString();
            const normalizeId = (id: string) => id.replace(/^-100/, '').replace(/^-/, '');

            if (chatId && normalizeId(chatId) !== normalizeId(sourceId)) {
                return;
            }
        }

        // Check if it's a media message we should process
        const isMedia = isMediaMessage(message);
        if (!isMedia) {
            return;
        }

        logger.info(`Detected media in chat ${message.chatId}`);

        // Check configuration for forwarding logic
        // If sourceChatId is set, we forward everything from there regardless of restriction
        // If NOT set, we only forward restricted content as per original logic
        const shouldForward = config.sourceChatId
            ? true // Forward everything from source chat
            : (message.fwdFrom || !canForwardMessage(message)); // Only restricted

        if (!shouldForward && !config.sourceChatId) {
            logger.info('Message can be forwarded normally, skipping download/upload');
            return;
        }

        logger.info(`Processing message ${message.id} from ${message.chatId}...`);

        // Download the media
        const mediaPath = await downloadMedia(message);
        if (!mediaPath) {
            logger.error('Failed to download media');
            return;
        }

        // Determine target chat
        const targetChat = config.targetChatId;
        if (!targetChat) {
            logger.warn('No target chat configured. Use /setchat command or set TARGET_CHAT_ID in .env');
            deleteMedia(mediaPath);
            return;
        }

        // Upload to target chat
        const result = await uploadMedia(targetChat, mediaPath, undefined, message);

        // Clean up
        deleteMedia(mediaPath);

        if (result) {
            logger.info('Media forwarded successfully!');
        } else {
            logger.error('Failed to forward media');
        }
    } catch (error) {
        logger.error('Error handling message:', error);
    }
}

function isMediaMessage(message: Api.Message): boolean {
    if (!message.media) return false;

    // We now accept photos and documents (videos, files, etc)
    return 'photo' in message.media || 'document' in message.media;
}

function canForwardMessage(message: Api.Message): boolean {
    // If message has noforwards flag, it cannot be forwarded
    if (message.noforwards) {
        return false;
    }

    // Check chat settings
    const chat = message.chat;
    if (chat && 'noforwards' in chat && chat.noforwards) {
        return false;
    }

    return true;
}
