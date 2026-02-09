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

        // --- PARALLEL PREFETCHING STATE ---
        // Map of MessageID -> Download Promise
        const prefetchMap = new Map<number, Promise<string | null>>();
        const WINDOW_SIZE = config.concurrentDownloads || 5; // Number of items to look ahead

        // Helper
        const ensureDownload = (msg: Api.Message) => {
            if (!prefetchMap.has(msg.id)) {
                logger.info(`[Pipeline] Starting background download for ${msg.id}...`);
                const promise = downloadMedia(msg).then(path => {
                    // logger.info(`[Pipeline] Finished message ${msg.id}`);
                    return path;
                });
                prefetchMap.set(msg.id, promise);
            }
        };

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

            // Filter for media messages
            const mediaMessages = messages.filter(msg =>
                msg.media &&
                !msg.action &&
                ('photo' in msg.media || 'document' in msg.media)
            );

            // If batch has no media, just advance offset
            if (mediaMessages.length === 0) {
                const batchLast = messages[messages.length - 1];
                lastId = batchLast.id;
                saveOffset(lastId);
                continue;
            }

            for (let i = 0; i < mediaMessages.length; i++) {
                const message = mediaMessages[i];

                // --- 1. FILL THE WINDOW ---
                // Look ahead and trigger downloads
                for (let j = 0; j <= WINDOW_SIZE; j++) {
                    const targetIndex = i + j;
                    if (targetIndex < mediaMessages.length) {
                        ensureDownload(mediaMessages[targetIndex]);
                    }
                }

                // --- 2. PROCESSING CURRENT ---
                logger.info(`Processing message ${message.id}...`);

                // Attempt Zero-Copy Forwarding
                let success = false;
                try {
                    await client.sendMessage(targetChatId, {
                        message: message.message || '',
                        file: message.media,
                    });
                    logger.info(`Successfully forwarded message ${message.id} (via zero-copy)`);
                    success = true;
                    totalProcessed++;

                    // Optimization: If Zero-Copy worked, cancel/discard download
                    // (We can't easily cancel the promise, but we can ignore the result and delete file)
                    if (prefetchMap.has(message.id)) {
                        const path = await prefetchMap.get(message.id);
                        if (path) {
                            deleteMedia(path);
                            logger.info(`[Pipeline] Discarded unused download for ${message.id}`);
                        }
                        prefetchMap.delete(message.id);
                    }

                } catch (err: any) {
                    // Check if restricted
                    const msg = err.errorMessage || err.message || '';
                    if (!msg.includes('CHAT_FORWARDS_RESTRICTED') && !msg.includes('protected')) {
                        logger.error(`Error forwarding ${message.id}: ${msg}`);
                    }
                }

                // Fallback to Upload
                if (!success) {
                    // Wait for the download to complete
                    let currentMediaPath: string | null = null;

                    if (prefetchMap.has(message.id)) {
                        // It should be downloading or done
                        currentMediaPath = await prefetchMap.get(message.id) || null;
                    } else {
                        // Fallback catch-all
                        logger.info(`Downloading message ${message.id} (synchronous fallback)...`);
                        currentMediaPath = await downloadMedia(message);
                    }

                    // Remove from map to free memory
                    prefetchMap.delete(message.id);

                    if (currentMediaPath) {
                        try {
                            await uploadMedia(targetChatId, currentMediaPath, undefined, message);
                            logger.info(`Successfully forwarded message ${message.id} (via download/upload)`);
                            success = true;
                            totalProcessed++;
                            deleteMedia(currentMediaPath);
                        } catch (upErr) {
                            logger.error(`Upload failed for ${message.id}`, upErr);
                            deleteMedia(currentMediaPath);
                        }
                    } else {
                        logger.error(`Failed to download media for ${message.id}`);
                    }
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
