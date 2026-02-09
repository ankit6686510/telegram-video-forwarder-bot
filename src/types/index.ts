export interface Config {
    apiId: number;
    apiHash: string;
    phoneNumber: string;
    sessionName: string;
    sessionString?: string;
    sourceChatId?: string;
    targetChatId?: string;
    concurrentDownloads?: number;
    logLevel: string;
}

export interface MediaMessage {
    chatId: string;
    messageId: number;
    mediaPath: string;
    caption?: string;
    duration?: number;
    width?: number;
    height?: number;
    mimeType?: string;
}
