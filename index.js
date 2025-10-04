require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { connectDB, saveUserTokens, setPendingAuth, findUserByState, getUserAccounts, removeAccount, getAllUsers } = require('./database');
const { getAuthUrl, getTokensFromCode } = require('./gmailAuth');
const { getEmailAddress, startWatching, getRecentMessages, getMessage, markAsRead } = require('./gmailWatcher');
const { extractVerificationCode } = require('./codeExtractor');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const app = express();

// Главное меню с кнопками
function getMainKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ Подключить Gmail', callback_data: 'add' }],
        [{ text: '📋 Мои аккаунты', callback_data: 'list' }],
        [{ text: '❌ Удалить аккаунт', callback_data: 'remove' }],
        [{ text: '❓ Помощь', callback_data: 'help' }]
      ]
    }
  };
}

// /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 
    '👋 *Привет!*\n\n' +
    'Я помогу получать коды верификации из Gmail автоматически.\n\n' +
    '✨ Для добавления аккаунта нужен всего *1 клик*!',
    { parse_mode: 'Markdown', ...getMainKeyboard() }
  );
});

// /status
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const accounts = await getUserAccounts(chatId);

    let message = '*📊 Статус бота*\n\n';
    message += `👤 Telegram ID: \`${chatId}\`\n`;
    message += `📧 Подключено аккаунтов: ${accounts.length}\n\n`;

    if (accounts.length > 0) {
      message += '*Аккаунты:*\n';
      for (const acc of accounts) {
        const date = new Date(acc.addedAt).toLocaleDateString('ru-RU');
        message += `• \`${acc.email}\`\n  Добавлен: ${date}\n`;
      }
    }

    message += `\n⏱ Проверка: каждые 30 сек\n`;
    message += `✅ Бот активен`;

    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    bot.sendMessage(chatId, '❌ Ошибка получения статуса');
    console.error(error);
  }
});

// /test - ручная проверка почты
bot.onText(/\/test/, async (msg) => {
  const chatId = msg.chat.id;
  const testMsg = await bot.sendMessage(chatId, '⏳ Проверяю почту вручную...');

  try {
    const accounts = await getUserAccounts(chatId);

    if (accounts.length === 0) {
      await bot.editMessageText('❌ Нет подключенных аккаунтов', {
        chat_id: chatId,
        message_id: testMsg.message_id
      });
      return;
    }

    let found = 0;

    for (const account of accounts) {
      console.log(`[TEST] Проверка ${account.email}`);
      const messages = await getRecentMessages(account.tokens, 5);
      console.log(`[TEST] Найдено писем: ${messages.length}`);

      for (const msg of messages) {
        const fullMessage = await getMessage(account.tokens, msg.id);
        const { codes, subject, from } = extractVerificationCode(fullMessage);

        if (codes.length > 0) {
          found++;
          let botMessage = `🔑 *Найден код!*\n\n`;
          botMessage += `📧 От: \`${from}\`\n`;
          botMessage += `📝 Тема: ${subject}\n\n`;
          botMessage += `*Коды:* ${codes.map(c => '`' + c + '`').join(', ')}`;

          await bot.sendMessage(chatId, botMessage, { parse_mode: 'Markdown' });
        }
      }
    }

    await bot.editMessageText(
      found > 0 
        ? `✅ Найдено кодов: ${found}` 
        : '📭 Непрочитанных писем с кодами не найдено',
      {
        chat_id: chatId,
        message_id: testMsg.message_id
      }
    );

  } catch (error) {
    await bot.editMessageText(`❌ Ошибка: ${error.message}`, {
      chat_id: chatId,
      message_id: testMsg.message_id
    });
    console.error(error);
  }
});

// Обработка кнопок
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === 'add') {
    bot.answerCallbackQuery(query.id);

    try {
      const state = chatId.toString();
      await setPendingAuth(chatId, state);

      const authUrl = getAuthUrl(state);

      bot.sendMessage(chatId,
        '🔐 *Шаг 1 из 1 (это всё!)*\n\n' +
        'Нажми кнопку ниже, разреши доступ к Gmail - и готово!\n\n' +
        '✅ Никаких паролей и кодов\n' +
        '✅ Полностью автоматически',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '🔗 Подключить Gmail', url: authUrl }
            ]]
          }
        }
      );
    } catch (error) {
      bot.sendMessage(chatId, '❌ Ошибка создания ссылки. Попробуй /start');
      console.error(error);
    }

  } else if (data === 'list') {
    bot.answerCallbackQuery(query.id);

    try {
      const accounts = await getUserAccounts(chatId);

      if (accounts.length === 0) {
        return bot.sendMessage(chatId, 
          '📭 У тебя нет подключенных аккаунтов.\n\nИспользуй кнопку "➕ Подключить Gmail"',
          { parse_mode: 'Markdown', ...getMainKeyboard() }
        );
      }

      let message = '*📋 Подключенные Gmail аккаунты:*\n\n';
      accounts.forEach((acc, index) => {
        const date = new Date(acc.addedAt).toLocaleDateString('ru-RU');
        message += `${index + 1}. \`${acc.email}\`\n   Добавлен: ${date}\n\n`;
      });

      bot.sendMessage(chatId, message, { 
        parse_mode: 'Markdown',
        ...getMainKeyboard() 
      });
    } catch (error) {
      bot.sendMessage(chatId, '❌ Ошибка при загрузке аккаунтов');
      console.error(error);
    }

  } else if (data === 'remove') {
    bot.answerCallbackQuery(query.id);

    try {
      const accounts = await getUserAccounts(chatId);

      if (accounts.length === 0) {
        return bot.sendMessage(chatId, '📭 Нет аккаунтов для удаления', getMainKeyboard());
      }

      const keyboard = accounts.map((acc, index) => [{
        text: `${index + 1}. ${acc.email}`,
        callback_data: `del_${acc.email}`
      }]);
      keyboard.push([{ text: '« Назад в меню', callback_data: 'menu' }]);

      bot.sendMessage(chatId, 
        '*Выбери аккаунт для удаления:*',
        {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        }
      );
    } catch (error) {
      bot.sendMessage(chatId, '❌ Ошибка при загрузке аккаунтов');
      console.error(error);
    }

  } else if (data.startsWith('del_')) {
    const email = data.replace('del_', '');

    try {
      await removeAccount(chatId, email);
      bot.answerCallbackQuery(query.id, { text: '✅ Аккаунт удален' });
      bot.editMessageText(
        `✅ Аккаунт \`${email}\` успешно удален.`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: 'Markdown',
          ...getMainKeyboard()
        }
      );
    } catch (error) {
      bot.answerCallbackQuery(query.id, { text: '❌ Ошибка удаления' });
      console.error(error);
    }

  } else if (data === 'help') {
    bot.answerCallbackQuery(query.id);
    bot.sendMessage(chatId,
      '*❓ Как это работает:*\n\n' +
      '*1.* Нажимаешь "➕ Подключить Gmail"\n' +
      '*2.* Разрешаешь доступ в Google (1 клик)\n' +
      '*3.* Готово! Коды приходят автоматически\n\n' +
      '*🔒 Безопасность:*\n' +
      '• Бот видит только новые письма\n' +
      '• Не может удалять или отправлять письма\n' +
      '• Доступ можно отозвать в любой момент\n\n' +
      '*⚡️ Скорость:*\n' +
      'Коды проверяются каждые 30 секунд',
      { parse_mode: 'Markdown', ...getMainKeyboard() }
    );

  } else if (data === 'menu') {
    bot.answerCallbackQuery(query.id);
    bot.editMessageText(
      '📋 *Главное меню*\n\nВыбери действие:',
      {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: 'Markdown',
        ...getMainKeyboard()
      }
    );
  }
});

// OAuth callback
app.get('/oauth/callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;
  const error = req.query.error;

  if (error) {
    res.send('<h1>❌ Доступ отклонен</h1><p>Ты отказался предоставить доступ к Gmail.</p><p>Можешь закрыть это окно и попробовать снова в боте.</p>');
    return;
  }

  if (!code || !state) {
    res.send('<h1>❌ Ошибка</h1><p>Неверные параметры</p>');
    return;
  }

  try {
    const user = await findUserByState(state);
    if (!user) {
      res.send('<h1>❌ Ошибка</h1><p>Пользователь не найден. Попробуй начать заново в боте.</p>');
      return;
    }

    const telegramId = user.telegramId;
    const tokens = await getTokensFromCode(code);
    const email = await getEmailAddress(tokens);
    const historyId = await startWatching(tokens);

    await saveUserTokens(telegramId, email, tokens, historyId);

    bot.sendMessage(telegramId,
      `✅ *Gmail успешно подключен!*\n\n` +
      `📧 Аккаунт: \`${email}\`\n\n` +
      `Коды верификации будут приходить сюда автоматически каждые 30 секунд.`,
      { parse_mode: 'Markdown', ...getMainKeyboard() }
    );

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>✅ Успешно подключено</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .container {
            text-align: center;
            padding: 40px;
            background: rgba(255,255,255,0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            max-width: 500px;
          }
          h1 { font-size: 64px; margin: 0; }
          h2 { font-size: 32px; margin: 10px 0; }
          p { font-size: 18px; opacity: 0.9; }
          .email { 
            background: rgba(255,255,255,0.2);
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            word-break: break-all;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅</h1>
          <h2>Успешно подключено!</h2>
          <p>Gmail аккаунт подключен к Telegram боту</p>
          <div class="email">${email}</div>
          <p>Коды верификации будут приходить автоматически</p>
          <p style="margin-top: 30px; font-size: 14px;">Можешь закрыть это окно</p>
        </div>
        <script>
          setTimeout(() => { window.close(); }, 5000);
        </script>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    res.send(`<h1>❌ Ошибка</h1><p>${error.message}</p><p>Попробуй снова в боте.</p>`);
  }
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/', (req, res) => {
  res.send('✅ Telegram Gmail Bot is running!');
});

// Проверка почты с подробным логированием
async function emailChecker() {
  try {
    console.log('\n🔄 [EmailChecker] Начало проверки почты...');
    const users = await getAllUsers();
    console.log(`👥 [EmailChecker] Найдено пользователей: ${users.length}`);

    for (const user of users) {
      console.log(`\n👤 [EmailChecker] Проверка для Telegram ID: ${user.telegramId}`);
      console.log(`📧 [EmailChecker] Аккаунтов у пользователя: ${user.gmailAccounts.length}`);

      for (const account of user.gmailAccounts) {
        try {
          console.log(`\n📬 [EmailChecker] Проверка почты: ${account.email}`);
          const messages = await getRecentMessages(account.tokens, 10);
          console.log(`📩 [EmailChecker] Найдено непрочитанных писем: ${messages ? messages.length : 0}`);

          if (!messages || messages.length === 0) {
            console.log(`✅ [EmailChecker] Нет новых писем для ${account.email}`);
            continue;
          }

          for (const msg of messages) {
            console.log(`\n📧 [EmailChecker] Обработка письма ID: ${msg.id}`);

            const fullMessage = await getMessage(account.tokens, msg.id);
            const { codes, subject, from } = extractVerificationCode(fullMessage);

            console.log(`🔍 [EmailChecker] Тема: ${subject}`);
            console.log(`🔍 [EmailChecker] От: ${from}`);
            console.log(`🔍 [EmailChecker] Найдено кодов: ${codes.length}`);

            if (codes.length > 0) {
              console.log(`🔑 [EmailChecker] Коды: ${codes.join(', ')}`);

              let botMessage = `🔑 *Новый код верификации!*\n\n`;
              botMessage += `📧 От: \`${from}\`\n`;
              botMessage += `📝 Тема: ${subject}\n\n`;
              botMessage += `*Коды:* ${codes.map(c => '`' + c + '`').join(', ')}`;

              await bot.sendMessage(user.telegramId, botMessage, { parse_mode: 'Markdown' });
              console.log(`✅ [EmailChecker] Код отправлен пользователю ${user.telegramId}`);

              await markAsRead(account.tokens, msg.id);
              console.log(`✅ [EmailChecker] Письмо ${msg.id} помечено как прочитанное`);
            } else {
              console.log(`⚠️  [EmailChecker] Коды не найдены в письме "${subject}"`);
            }
          }

        } catch (err) {
          console.error(`❌ [EmailChecker] Ошибка проверки ${account.email}:`, err.message);
        }
      }
    }

    console.log(`\n✅ [EmailChecker] Проверка завершена\n`);

  } catch (error) {
    console.error('❌ [EmailChecker] Критическая ошибка:', error);
  }
}

// Запуск
async function start() {
  try {
    await connectDB();

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`✅ HTTP сервер запущен на порту ${PORT}`);
      console.log(`✅ OAuth callback: ${process.env.BOT_URL}/oauth/callback`);
    });

    // ВАЖНО: Запуск проверки почты
    setInterval(emailChecker, 30000); // Каждые 30 секунд
    setTimeout(emailChecker, 10000);  // Первая проверка через 10 секунд

    console.log('\n✅ Telegram бот запущен!');
    console.log('✅ Режим: Автоматический OAuth (для самых ленивых)');
    console.log('✅ Проверка почты: каждые 30 секунд\n');

  } catch (error) {
    console.error('❌ Ошибка запуска:', error);
    process.exit(1);
  }
}

start();

// Обработка ошибок
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
});
