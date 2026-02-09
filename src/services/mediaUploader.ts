import { Api } from 'telegram';
import { getClient } from '../client';
import { logger } from '../utils/logger';

export async function uploadMedia(
    targetChatId: string,
    mediaPath: string,
    caption?: string,
    originalMessage?: Api.Message
): Promise<Api.Message | null> {
    try {
        const client = getClient();

        logger.info(`Uploading media to chat ${targetChatId}...`);

        // Extract attributes from original message if available
        let attributes: Api.TypeDocumentAttribute[] = [];
        let forceDocument = false;

        if (originalMessage?.media) {
            if ('document' in originalMessage.media) {
                const doc = originalMessage.media.document as Api.Document;
                attributes = doc.attributes || [];
                // If it was a generic file, keep it as document
                forceDocument = !doc.mimeType?.startsWith('video/') && !doc.mimeType?.startsWith('image/');
            }
        }

        // Send the message with media directly
        // gramJS sendMessage/sendFile handles file paths automatically
        const result = await client.sendMessage(targetChatId, {
            file: mediaPath,
            message: caption || (originalMessage?.message || ''),
            attributes: attributes,
            forceDocument: forceDocument as any,
            // Add progress callback if possible with sendMessage, though might not be exposed directly in same way
            // or we rely on logger
        });

        logger.info(`Media sent successfully! Message ID: ${result.id}`);
        return result as Api.Message;
    } catch (error) {
        logger.error('Error uploading media:', error);
        return null;
    }
}
