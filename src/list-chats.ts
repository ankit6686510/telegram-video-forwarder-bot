import { initializeClient } from './client';
import { logger } from './utils/logger';

async function listChats() {
    try {
        const client = await initializeClient();

        console.log('\nFetching your chats...\n');

        // Get dialogs (chats)
        const dialogs = await client.getDialogs({});

        console.log('----------------------------------------');
        console.log('AVAILABLE CHATS (Copy the ID you need)');
        console.log('----------------------------------------');

        for (const dialog of dialogs) {
            if (dialog.isChannel || dialog.isGroup) {
                console.log(`Name: ${dialog.title}`);
                console.log(`ID: ${dialog.id}`);
                console.log('----------------------------------------');
            }
        }

        process.exit(0);
    } catch (error) {
        logger.error('Error listing chats:', error);
        process.exit(1);
    }
}

listChats();
