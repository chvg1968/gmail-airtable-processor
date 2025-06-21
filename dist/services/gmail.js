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
    let plainText = '';
    let htmlText = '';
    const stack = [payload];
    while (stack.length > 0) {
        const part = stack.pop();
        if (!part)
            continue;
        // If a part is a container, push its children to the stack and process them next.
        // This handles multipart/* and message/rfc822 (forwarded emails).
        if (part.parts) {
            stack.push(...part.parts);
            continue; // We only process leaf nodes for content.
        }
        // Process leaf nodes for content.
        if (part.mimeType === 'text/plain' && part.body?.data) {
            plainText += Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        else if (part.mimeType === 'text/html' && part.body?.data) {
            htmlText += Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        else if (part.body?.data) { // Fallback for parts with data but no explicit text mimeType
            plainText += Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
    }
    // Prioritize plain text, but fall back to HTML if plain text is empty.
    return plainText.trim() ? plainText : htmlText;
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
