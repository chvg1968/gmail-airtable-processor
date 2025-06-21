"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchEmails = exports.getGmailProfile = exports.getGmailClient = exports.getEmailContent = void 0;
const googleapis_1 = require("googleapis");
const config_1 = require("../config");
let oauth2ClientInstance = null;
async function getOAuth2Client() {
    const appConfig = await (0, config_1.getInitializedConfig)();
    if (oauth2ClientInstance && oauth2ClientInstance.credentials.expiry_date && oauth2ClientInstance.credentials.expiry_date > Date.now() + 60000) {
        return oauth2ClientInstance;
    }
    const client = new googleapis_1.google.auth.OAuth2(appConfig.googleClientId, appConfig.googleClientSecret, 'https://developers.google.com/oauthplayground');
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
        }
        else {
            console.error('Failed to refresh access token, no access_token in credentials. Response:', credentials);
            throw new Error('Failed to refresh access token, no access_token in credentials.');
        }
    }
    catch (error) {
        console.error('Error refreshing access token:', error.response?.data || error.message || error);
        throw new Error(`Could not refresh access token: ${error.message}`);
    }
}
function getHeader(headers, name) {
    const header = headers.find(h => h.name === name);
    return header ? header.value || null : null;
}
function getBody(payload) {
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
async function getEmailContent(messageId) {
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
        let forwardedContent = null;
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
            body: bodyData,
            isForwarded,
            forwardedContent,
            internalDate: message.internalDate || '',
        };
    }
    catch (error) {
        console.error(`Error fetching email content for message ${messageId}:`, error);
        return null;
    }
}
exports.getEmailContent = getEmailContent;
async function getGmailClient() {
    const client = await getOAuth2Client();
    return googleapis_1.google.gmail({ version: 'v1', auth: client });
}
exports.getGmailClient = getGmailClient;
async function getGmailProfile() {
    try {
        const gmail = await getGmailClient();
        const res = await gmail.users.getProfile({ userId: 'me' });
        console.log('Successfully connected to Gmail. User email:', res.data.emailAddress);
        return res.data.emailAddress;
    }
    catch (error) {
        console.error('Error connecting to Gmail or fetching profile:', error);
        throw error;
    }
}
exports.getGmailProfile = getGmailProfile;
async function listMessages(gmail, query, pageToken) {
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
        }
        else {
            return messages;
        }
    }
    catch (error) {
        console.error('Error listing messages:', error);
        throw error;
    }
}
async function searchEmails(searchCriteriaQuery) {
    const gmail = await getGmailClient();
    console.log(`Searching emails with query: ${searchCriteriaQuery}`);
    try {
        const allMessages = await listMessages(gmail, searchCriteriaQuery);
        console.log(`Found ${allMessages.length} messages matching criteria.`);
        return allMessages;
    }
    catch (error) {
        console.error('Error searching emails:', error);
        throw error;
    }
}
exports.searchEmails = searchEmails;
