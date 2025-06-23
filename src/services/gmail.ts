import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { getInitializedConfig } from '../config';
import { logger } from '../utils/logger';

let oauth2ClientInstance: OAuth2Client | null = null;

async function getOAuth2Client(): Promise<OAuth2Client> {
    const appConfig = await getInitializedConfig();

    if (oauth2ClientInstance && oauth2ClientInstance.credentials.expiry_date && oauth2ClientInstance.credentials.expiry_date > Date.now() + 60000) {
        return oauth2ClientInstance;
    }

    const client = new google.auth.OAuth2(
        appConfig.googleClientId,
        appConfig.googleClientSecret,
        'https://developers.google.com/oauthplayground'
    );

    client.setCredentials({
        refresh_token: appConfig.googleRefreshToken,
    });

    try {
        const { credentials } = await client.refreshAccessToken();
        if (credentials.access_token) {
            client.setCredentials({
                access_token: credentials.access_token,
                refresh_token: appConfig.googleRefreshToken,
            });
            logger.debug('Access token refreshed successfully.');
            oauth2ClientInstance = client;
            return client;
        } else {
             logger.error('Failed to refresh access token, no access_token in credentials. Response:', credentials);
             throw new Error('Failed to refresh access token, no access_token in credentials.');
        }
    } catch (error: any) {
        logger.error('Error refreshing access token:', error.response?.data || error.message || error);
        throw new Error(`Could not refresh access token: ${error.message}`);
    }
}

// Interfaz para el contenido del correo que extraeremos
export interface EmailContent {
    id: string;
    threadId: string;
    subject?: string | null;
    from?: string | null;
    date?: string | null;
    body: string;
    internalDate: string;
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string | null {
    const header = headers.find(h => h.name === name);
    return header ? header.value || null : null;
}

function getBody(payload: gmail_v1.Schema$MessagePart): string {
    let plainText = '';
    let htmlText = '';
    const stack: gmail_v1.Schema$MessagePart[] = [payload];

    while (stack.length > 0) {
        const part = stack.pop();
        if (!part) continue;

        // If a part is a container, push its children to the stack and process them next.
        // This handles multipart/* and message/rfc822 (forwarded emails).
        if (part.parts) {
            stack.push(...part.parts);
            continue; // We only process leaf nodes for content.
        }

        // Process leaf nodes for content.
        if (part.mimeType === 'text/plain' && part.body?.data) {
            plainText += Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/html' && part.body?.data) {
            htmlText += Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.body?.data) { // Fallback for parts with data but no explicit text mimeType
            plainText += Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
    }

    // Prioritize plain text, but fall back to HTML if plain text is empty.
    return plainText.trim() ? plainText : htmlText;
}

export async function getEmailContent(messageId: string): Promise<EmailContent | null> {
    try {
        const gmail = await getGmailClient();
        const res = await gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'full',
        });

        const message = res.data;
        if (!message.payload || !message.payload.headers) {
            return null;
        }

        const headers = message.payload.headers;
        const bodyData = getBody(message.payload);

        return {
            id: messageId,
            threadId: message.threadId || '',
            subject: getHeader(headers, 'Subject'),
            from: getHeader(headers, 'From'),
            date: getHeader(headers, 'Date'),
            body: bodyData,
            internalDate: message.internalDate || '',
        };
    } catch (error) {
        logger.error(`Error fetching email content for message ${messageId}:`, error);
        return null;
    }
}

export async function getGmailClient(): Promise<gmail_v1.Gmail> {
    const client = await getOAuth2Client();
    return google.gmail({ version: 'v1', auth: client });
}

export async function getGmailProfile(): Promise<string | null | undefined> {
    try {
        const gmail = await getGmailClient();
        const res = await gmail.users.getProfile({ userId: 'me' });
        logger.debug('Successfully connected to Gmail. User email:', res.data.emailAddress);
        return res.data.emailAddress;
    } catch (error) {
        logger.error('Error connecting to Gmail or fetching profile:', error);
        throw error;
    }
}

async function listMessages(gmail: gmail_v1.Gmail, query: string, pageToken?: string): Promise<gmail_v1.Schema$Message[]> {
    try {
        const res = await gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults: 100,
            pageToken: pageToken,
        });

        const messages = res.data.messages || [];
        const nextPageToken = res.data.nextPageToken;

        if (nextPageToken && messages.length > 0) {
            const nextMessages = await listMessages(gmail, query, nextPageToken);
            return messages.concat(nextMessages);
        } else {
            return messages;
        }
    } catch (error) {
        logger.error('Error listing messages:', error);
        throw error;
    }
}

export async function searchEmails(searchCriteriaQuery: string): Promise<gmail_v1.Schema$Message[]> {
    const gmail = await getGmailClient();
    
    logger.debug(`Searching emails with query: ${searchCriteriaQuery}`);

    try {
        const allMessages = await listMessages(gmail, searchCriteriaQuery);
        logger.debug(`Found ${allMessages.length} messages matching criteria.`);
        return allMessages;
    } catch (error) {
        logger.error('Error searching emails:', error);
        throw error;
    }
}
