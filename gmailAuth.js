const { google } = require('googleapis');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify'  // Чтение + изменение labels (пометка прочитанным)
];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.BOT_URL}/oauth/callback`
  );
}

function getAuthUrl(state) {
  const oAuth2Client = getOAuth2Client();

  return oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: state, // Telegram ID для идентификации пользователя
    prompt: 'consent'
  });
}

async function getTokensFromCode(code) {
  const oAuth2Client = getOAuth2Client();
  const { tokens } = await oAuth2Client.getToken(code);
  return tokens;
}

function createAuthClient(tokens) {
  const oAuth2Client = getOAuth2Client();
  oAuth2Client.setCredentials(tokens);
  return oAuth2Client;
}

async function refreshAccessToken(refreshToken) {
  const oAuth2Client = getOAuth2Client();
  oAuth2Client.setCredentials({ refresh_token: refreshToken });

  try {
    const { credentials } = await oAuth2Client.refreshAccessToken();
    return credentials;
  } catch (error) {
    console.error('❌ Ошибка обновления токена:', error);
    throw error;
  }
}

module.exports = { 
  getAuthUrl, 
  getTokensFromCode, 
  createAuthClient,
  refreshAccessToken
};
