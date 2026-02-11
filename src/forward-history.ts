import { Api } from 'telegram';
import { getClient, initializeClient } from './client';
import { logger } from './utils/logger';
import { config } from './utils/config';
import { downloadMedia, deleteMedia } from './services/mediaDownloader';
import { uploadMedia } from './services/mediaUploader';
import fs from 'fs';
import path from 'path';

const OFFSET_FILE = path.join(__dirname, '../offset.txt');

function saveOffset(id: number) {
    fs.writeFileSync(OFFSET_FILE, id.toString());
}

function loadOffset(): number {
    if (fs.existsSync(OFFSET_FILE)) {
        return parseInt(fs.readFileSync(OFFSET_FILE, 'utf-8'), 10) || 0;
    }
    return 0;
}

async function forwardHistory() {
    try {
        const client = await initializeClient();

        const sourceChatId = config.sourceChatId;
        const targetChatId = config.targetChatId;

        if (!sourceChatId || !targetChatId) {
            logger.error('Source or Target chat ID not set in .env');
            return;
        }

        logger.info(`Starting history forward from ${sourceChatId} to ${targetChatId}`);
        logger.info(`Mode: Parallel Prefetching (Sliding Window = 3)`);

        // Resume from last processed message
        let lastId = loadOffset();
        logger.info(`Resuming from message ID: ${lastId}`);

        let totalProcessed = 0;

        while (true) {
            const messages = await client.getMessages(sourceChatId, {
                limit: 20,
                offsetId: lastId,
                reverse: true
            });

            if (messages.length === 0) {
                logger.info('No more new messages to fetch.');
                break;
            }

            // Filter for content messages (exclude service actions)
            const contentMessages = messages.filter(msg => !msg.action);

            // If batch has no content, just advance offset
            if (contentMessages.length === 0) {
                const batchLast = messages[messages.length - 1];
                lastId = batchLast.id;
                saveOffset(lastId);
                continue;
            }

            for (let i = 0; i < contentMessages.length; i++) {
                const message = contentMessages[i];
                logger.info(`Processing message ${message.id}...`);

                let success = false;

                // --- OPTION 1: Server-Side Forward (Fastest, no download) ---
                try {
                    await client.forwardMessages(targetChatId, {
                        messages: [message.id],
                        fromPeer: sourceChatId,
                        dropAuthor: true,
                    });
                    logger.info(`Successfully forwarded message ${message.id} (via server-side forward)`);
                    success = true;
                } catch (err: any) {
                    const msg = err.errorMessage || err.message || '';
                    if (msg.includes('CHAT_FORWARDS_RESTRICTED') || msg.includes('protected')) {
                        logger.info(`Message ${message.id} is restricted. Attempting copy...`);
                    } else {
                        logger.error(`Error forwarding ${message.id}: ${msg}`);
                    }
                }

                // --- OPTION 2: Server-Side Copy (Zero-copy, no download) ---
                if (!success) {
                    try {
                        await client.sendMessage(targetChatId, {
                            message: message.message || '',
                            formattingEntities: message.entities,
                            file: message.media,
                        });
                        logger.info(`Successfully copied message ${message.id} (via zero-copy)`);
                        success = true;
                    } catch (err: any) {
                        const msg = err.errorMessage || err.message || '';
                        if (message.media && (msg.includes('CHAT_FORWARDS_RESTRICTED') || msg.includes('protected'))) {
                            logger.info(`Zero-copy failed for ${message.id}. Falling back to download...`);
                        } else {
                            logger.error(`Error copying ${message.id}: ${msg}`);
                        }
                    }
                }

                // --- OPTION 3: Local Download/Upload (Last resort) ---
                if (!success && message.media) {
                    logger.info(`Downloading message ${message.id} because of channel restrictions...`);
                    const currentMediaPath = await downloadMedia(message);

                    if (currentMediaPath) {
                        try {
                            await uploadMedia(targetChatId, currentMediaPath, message.message || '', message);
                            logger.info(`Successfully forwarded message ${message.id} (via download/upload)`);
                            success = true;
                            deleteMedia(currentMediaPath);
                        } catch (upErr) {
                            logger.error(`Upload failed for ${message.id}`, upErr);
                            deleteMedia(currentMediaPath);
                        }
                    } else {
                        logger.error(`Failed to download media for ${message.id}`);
                    }
                } else if (!success && !message.media) {
                    logger.error(`Failed to process text message ${message.id}`);
                }

                if (success) {
                    totalProcessed++;
                }

                // Update Offset
                lastId = message.id;
                saveOffset(lastId);
            }

            logger.info(`Processed batch. Total so far: ${totalProcessed}. Last ID: ${lastId}`);
        }

        logger.info(`History forwarding complete! Total messages: ${totalProcessed}`);
        process.exit(0);
    } catch (error) {
        logger.error('Error forwarding history:', error);
        process.exit(1);
    }
}

forwardHistory();
