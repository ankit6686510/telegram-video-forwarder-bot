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

        // Source chat filtering
        if (config.sourceChatId) {
            const chatId = message.chatId?.toString();
            // Handle both raw ID and -100 prefix format
            const sourceId = config.sourceChatId.toString();
            const normalizeId = (id: string) => id.replace(/^-100/, '').replace(/^-/, '');

            const isMatch = (chatId && normalizeId(chatId) === normalizeId(sourceId)) ||
                (message.chat && 'username' in message.chat && message.chat.username === sourceId.replace('@', ''));

            if (!isMatch) {
                return;
            }
        } else {
            // If no source chat is configured, only forward if it looks like a manual request or similar
            // For this project, we usually expect a source chat.
            return;
        }

        logger.info(`Processing live message ${message.id} from ${message.chatId}...`);

        // Determine target chat
        const targetChat = config.targetChatId;
        if (!targetChat) {
            logger.warn('No target chat configured.');
            return;
        }

        const client = getClient();
        let success = false;

        // --- OPTION 1: Server-Side Forward ---
        try {
            await client.forwardMessages(targetChat, {
                messages: [message.id],
                fromPeer: message.chatId!,
                dropAuthor: true,
            });
            logger.info(`Successfully live-forwarded message ${message.id} (via server-side forward)`);
            success = true;
        } catch (err: any) {
            const msg = err.errorMessage || err.message || '';
            if (msg.includes('CHAT_FORWARDS_RESTRICTED') || msg.includes('protected')) {
                logger.info(`Live message ${message.id} is restricted. Attempting copy...`);
            } else {
                logger.error(`Error live-forwarding ${message.id}: ${msg}`);
            }
        }

        // --- OPTION 2: Server-Side Copy ---
        if (!success) {
            try {
                await client.sendMessage(targetChat, {
                    message: message.message || '',
                    formattingEntities: message.entities,
                    file: message.media,
                });
                logger.info(`Successfully live-copied message ${message.id} (via zero-copy)`);
                success = true;
            } catch (err: any) {
                const msg = err.errorMessage || err.message || '';
                if (message.media && (msg.includes('CHAT_FORWARDS_RESTRICTED') || msg.includes('protected'))) {
                    logger.info(`Live zero-copy failed for ${message.id}. Falling back to download...`);
                } else {
                    logger.error(`Error live-copying ${message.id}: ${msg}`);
                }
            }
        }

        // --- OPTION 3: Local Download/Upload ---
        if (!success && message.media && ('photo' in message.media || 'document' in message.media)) {
            logger.info(`Downloading live message ${message.id} because of channel restrictions...`);
            const mediaPath = await downloadMedia(message);
            if (mediaPath) {
                try {
                    await uploadMedia(targetChat, mediaPath, message.message || '', message);
                    logger.info(`Successfully live-forwarded message ${message.id} (via download/upload)`);
                    deleteMedia(mediaPath);
                } catch (upErr) {
                    logger.error(`Live upload failed for ${message.id}`, upErr);
                    deleteMedia(mediaPath);
                }
            }
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
