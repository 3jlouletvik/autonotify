const { google } = require('googleapis');
const { createAuthClient } = require('./gmailAuth');

async function getEmailAddress(tokens) {
  try {
    const auth = createAuthClient(tokens);
    const gmail = google.gmail({ version: 'v1', auth });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    return profile.data.emailAddress;
  } catch (error) {
    console.error('❌ Ошибка получения email:', error);
    throw error;
  }
}

async function startWatching(tokens) {
  try {
    const auth = createAuthClient(tokens);
    const gmail = google.gmail({ version: 'v1', auth });

    // Получаем начальный historyId
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const historyId = profile.data.historyId;

    console.log(`✅ История Gmail получена, historyId: ${historyId}`);
    return historyId;
  } catch (error) {
    console.error('❌ Ошибка запуска отслеживания:', error);
    throw error;
  }
}

async function getRecentMessages(tokens, maxResults = 10) {
  try {
    const auth = createAuthClient(tokens);
    const gmail = google.gmail({ version: 'v1', auth });

    const res = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      labelIds: ['INBOX'],
      q: 'is:unread' // Только непрочитанные
    });

    return res.data.messages || [];
  } catch (error) {
    console.error('❌ Ошибка получения сообщений:', error);
    return [];
  }
}

async function getMessage(tokens, messageId) {
  try {
    const auth = createAuthClient(tokens);
    const gmail = google.gmail({ version: 'v1', auth });

    const res = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    return res.data;
  } catch (error) {
    console.error('❌ Ошибка получения письма:', error);
    throw error;
  }
}

async function markAsRead(tokens, messageId) {
  try {
    const auth = createAuthClient(tokens);
    const gmail = google.gmail({ version: 'v1', auth });

    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD']
      }
    });
  } catch (error) {
    console.error('❌ Ошибка пометки письма:', error);
  }
}

module.exports = { 
  getEmailAddress,
  startWatching,
  getRecentMessages,
  getMessage,
  markAsRead
};
