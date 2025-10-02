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

// Обработка кнопок
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === 'add') {
    bot.answerCallbackQuery(query.id);

    try {
      // Генерируем уникальный state для идентификации пользователя
      const state = chatId.toString();
      await setPendingAuth(chatId, state);

      // Получаем OAuth URL
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

// OAuth callback - сюда приходит пользователь после авторизации в Google
app.get('/oauth/callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state; // Telegram ID
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
    // Находим пользователя по state
    const user = await findUserByState(state);
    if (!user) {
      res.send('<h1>❌ Ошибка</h1><p>Пользователь не найден. Попробуй начать заново в боте.</p>');
      return;
    }

    const telegramId = user.telegramId;

    // Получаем токены из кода
    const tokens = await getTokensFromCode(code);

    // Получаем email адрес
    const email = await getEmailAddress(tokens);

    // Получаем начальный historyId
    const historyId = await startWatching(tokens);

    // Сохраняем в базу
    await saveUserTokens(telegramId, email, tokens, historyId);

    // Уведомляем пользователя в Telegram
    bot.sendMessage(telegramId,
      `✅ *Gmail успешно подключен!*\n\n` +
      `📧 Аккаунт: \`${email}\`\n\n` +
      `Коды верификации будут приходить сюда автоматически каждые 30 секунд.`,
      { parse_mode: 'Markdown', ...getMainKeyboard() }
    );

    // Показываем красивую страницу успеха
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
          .close-btn {
            background: white;
            color: #667eea;
            border: none;
            padding: 15px 40px;
            border-radius: 25px;
            font-size: 16px;
            font-weight: bold;
            margin-top: 20px;
            cursor: pointer;
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
          <button class="close-btn" onclick="window.close()">Закрыть окно</button>
        </div>
        <script>
          // Автоматически закрываем окно через 5 секунд
          setTimeout(() => {
            window.close();
          }, 5000);
        </script>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('❌ Ошибка OAuth callback:', error);
    res.send(`
      <h1>❌ Ошибка</h1>
      <p>${error.message}</p>
      <p>Попробуй снова в боте.</p>
    `);
  }
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/', (req, res) => {
  res.send('✅ Telegram Gmail Bot is running!');
});

// Проверка почты каждые 30 секунд
async function emailChecker() {
  try {
    const users = await getAllUsers();

    for (const user of users) {
      for (const account of user.gmailAccounts) {
        try {
          const messages = await getRecentMessages(account.tokens, 5);

          for (const msg of messages) {
            const fullMessage = await getMessage(account.tokens, msg.id);
            const { codes, subject, from } = extractVerificationCode(fullMessage);

            if (codes.length > 0) {
              let botMessage = `🔑 *Новый код верификации!*\n\n`;
              botMessage += `📧 От: \`${from}\`\n`;
              botMessage += `📝 Тема: ${subject}\n\n`;
              botMessage += `*Коды:* ${codes.map(c => '`' + c + '`').join(', ')}`;

              await bot.sendMessage(user.telegramId, botMessage, { parse_mode: 'Markdown' });
              console.log(`✅ Код отправлен пользователю ${user.telegramId}`);

              await markAsRead(account.tokens, msg.id);
            }
          }

        } catch (err) {
          console.error(`❌ Ошибка проверки ${account.email}:`, err.message);
        }
      }
    }
  } catch (error) {
    console.error('❌ Ошибка emailChecker:', error);
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

    // Проверка почты каждые 30 секунд
    setInterval(emailChecker, 30000);

    console.log('\n✅ Telegram бот запущен!');
    console.log('✅ Режим: Автоматический OAuth (для самых ленивых)');
    console.log('✅ Проверка почты: каждые 30 секунд\n');

    setTimeout(emailChecker, 10000);

  } catch (error) {
    console.error('❌ Ошибка запуска:', error);
    process.exit(1);
  }
}

start();

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
});
