import { Api } from 'telegram';
import * as fs from 'fs';
import * as path from 'path';
import { getClient } from '../client';
import { logger } from '../utils/logger';

const DOWNLOADS_DIR = path.join(__dirname, '../../downloads');

// Ensure downloads directory exists
if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

export async function downloadMedia(
    message: Api.Message
): Promise<string | null> {
    try {
        const client = getClient();

        if (!message.media) {
            logger.warn('Message has no media');
            return null;
        }

        logger.info(`Downloading media from message ${message.id}...`);

        // Generate unique filename
        const timestamp = Date.now();
        // Try to get extension from mime type or default to .dat
        let ext = '.dat';
        if ('document' in message.media) {
            const doc = message.media.document as Api.Document;
            if (doc.mimeType) {
                const mimeMap: { [key: string]: string } = {
                    'video/mp4': '.mp4',
                    'image/jpeg': '.jpg',
                    'image/png': '.png',
                    'audio/ogg': '.ogg',
                    'audio/mpeg': '.mp3'
                };
                ext = mimeMap[doc.mimeType] || '.dat';
            }
        } else if ('photo' in message.media) {
            ext = '.jpg';
        }

        const filename = `media_${timestamp}${ext}`;
        const filepath = path.join(DOWNLOADS_DIR, filename);

        // Download the media
        const buffer = await client.downloadMedia(message, {
            progressCallback: (downloaded: any, total: any) => {
                const d = BigInt(downloaded);
                const t = BigInt(total);
                if (t === 0n) return;
                const percent = (Number(d) / Number(t) * 100).toFixed(2);
                process.stdout.write(`\rDownload progress: ${percent}%`);
            },
        });

        if (!buffer) {
            logger.error('Failed to download media');
            return null;
        }

        // Save to file
        fs.writeFileSync(filepath, buffer as Buffer);
        console.log(); // New line after progress
        logger.info(`Media saved to: ${filepath}`);

        return filepath;
    } catch (error) {
        logger.error('Error downloading media:', error);
        return null;
    }
}

export function deleteMedia(filepath: string): void {
    try {
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            logger.info(`Deleted temporary file: ${filepath}`);
        }
    } catch (error) {
        logger.error('Error deleting media:', error);
    }
}
