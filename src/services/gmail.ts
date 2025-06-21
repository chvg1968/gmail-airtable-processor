import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { getInitializedConfig } from '../config';

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
            console.log('Access token refreshed successfully.');
            oauth2ClientInstance = client;
            return client;
        } else {
             console.error('Failed to refresh access token, no access_token in credentials. Response:', credentials);
             throw new Error('Failed to refresh access token, no access_token in credentials.');
        }
    } catch (error: any) {
        console.error('Error refreshing access token:', error.response?.data || error.message || error);
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
    isForwarded: boolean;
    forwardedContent?: {
        from: string | null;
        body: string;
    } | null;
}

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string | null {
    const header = headers.find(h => h.name === name);
    return header ? header.value || null : null;
}

function getBody(payload: gmail_v1.Schema$MessagePart): string {
    if (payload.body?.data) {
        return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
                return Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
        }
        // Fallback to the first part if no text/plain is found
        return getBody(payload.parts[0]);
    }

    return '';
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
        const subjectHeader = getHeader(headers, 'Subject');
        const fromHeader = getHeader(headers, 'From');
        const bodyData = getBody(message.payload);

        const isForwarded = subjectHeader ? subjectHeader.toLowerCase().startsWith('fwd:') || subjectHeader.toLowerCase().startsWith('reenv:') : false;

        let forwardedContent: { from: string | null; body: string } | null = null;

        if (isForwarded) {
            const forwardedMatch = bodyData.match(/(?:---------- Forwarded message ---------|---------- Mensaje reenviado ---------)([\s\S]*)/i);
            if (forwardedMatch && forwardedMatch[1]) {
                const forwardedText = forwardedMatch[1];
                const fromMatch = forwardedText.match(/From: ([\s\S]*?)\n/i);
                const forwardedFrom = fromMatch ? fromMatch[1].trim() : null;
                
                const bodyStartIndex = forwardedText.indexOf('\n\n');
                const forwardedBody = bodyStartIndex !== -1 ? forwardedText.substring(bodyStartIndex + 2).trim() : forwardedText.trim();

                forwardedContent = {
                    from: forwardedFrom,
                    body: forwardedBody,
                };
            }
        }

        return {
            id: messageId,
            threadId: message.threadId || '',
            subject: subjectHeader,
            from: fromHeader,
            date: getHeader(headers, 'Date'),
            body: bodyData, // The full original body
            isForwarded,
            forwardedContent,
            internalDate: message.internalDate || '',
        };
    } catch (error) {
        console.error(`Error fetching email content for message ${messageId}:`, error);
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
        console.log('Successfully connected to Gmail. User email:', res.data.emailAddress);
        return res.data.emailAddress;
    } catch (error) {
        console.error('Error connecting to Gmail or fetching profile:', error);
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
        console.error('Error listing messages:', error);
        throw error;
    }
}

export async function searchEmails(searchCriteriaQuery: string): Promise<gmail_v1.Schema$Message[]> {
    const gmail = await getGmailClient();
    
    console.log(`Searching emails with query: ${searchCriteriaQuery}`);

    try {
        const allMessages = await listMessages(gmail, searchCriteriaQuery);
        console.log(`Found ${allMessages.length} messages matching criteria.`);
        return allMessages;
    } catch (error) {
        console.error('Error searching emails:', error);
        throw error;
    }
}
