# 📧 Telegram Gmail Bot - Версия "Для самых ленивых"

**Telegram бот с автоматическим OAuth - никаких паролей и кодов!**

## 🚀 Главная фича

**Пользователь:**
1. Нажимает кнопку "🔗 Подключить Gmail"
2. Разрешает доступ в Google (1 клик)
3. **ВСЁ!** Коды приходят автоматически

**Никаких:**
- ❌ Паролей приложений
- ❌ Копирования OAuth кодов вручную
- ❌ Ввода email/пароля
- ❌ Сложных настроек

## 📋 Требования

- Node.js >= 16.x
- MongoDB (или MongoDB Atlas)
- Telegram Bot Token
- Google Cloud Project с OAuth2

## 🛠 Установка

### 1. Клонирование и зависимости

```bash
npm install
```

### 2. Настройка Google Cloud Console

#### Создай OAuth 2.0 Client ID:

1. https://console.cloud.google.com
2. APIs & Services → Credentials
3. Create Credentials → **OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Name: `telegram-bot`
6. **Authorized redirect URIs** (ВАЖНО!):
   ```
   https://your-app.onrender.com/oauth/callback
   ```
   Замени `your-app.onrender.com` на свой домен
7. Create и сохрани `Client ID` и `Client Secret`

#### Включи Gmail API:

1. APIs & Services → Library
2. Найди "Gmail API" → Enable

#### Настрой OAuth consent screen:

1. OAuth consent screen → External
2. Заполни обязательные поля
3. Scopes → Add: `gmail.readonly` и `gmail.metadata`
4. Test users → добавь свой Gmail для тестирования

### 3. Переменные окружения

Создай файл `.env`:

```env
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/gmail-bot
GOOGLE_CLIENT_ID=abc123.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abc123...
BOT_URL=https://your-app.onrender.com
PORT=3000
```

**ВАЖНО:** `BOT_URL` должен совпадать с Authorized redirect URI в Google Cloud!

### 4. Запуск

```bash
npm start
```

## 🌐 Деплой на Render

1. Загрузи проект на GitHub
2. Render.com → New Web Service
3. Connect Repository
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Environment Variables:
   - `TELEGRAM_BOT_TOKEN`
   - `MONGODB_URI`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `BOT_URL` (URL твоего сервиса, например `https://my-bot.onrender.com`)
7. Deploy!

**После деплоя:**
1. Скопируй URL сервиса (например, `https://my-bot.onrender.com`)
2. Добавь в Google Cloud Console → OAuth Client → Authorized redirect URIs:
   ```
   https://my-bot.onrender.com/oauth/callback
   ```

## 📱 Использование

### Команды:

Бот работает **полностью на кнопках** - никаких команд учить не нужно!

- `/start` - открыть главное меню

### Кнопки:

- **➕ Подключить Gmail** - добавить аккаунт (1 клик!)
- **📋 Мои аккаунты** - список подключенных
- **❌ Удалить аккаунт** - удалить выбранный
- **❓ Помощь** - инструкция

## ✨ Преимущества этой версии

### Для пользователей:

- ✅ **Супер простая настройка** - всего 1 клик
- ✅ **Нет паролей** - OAuth через Google
- ✅ **Автоматический callback** - ничего не копировать
- ✅ **Красивый интерфейс** - кнопки вместо команд
- ✅ **Безопасно** - официальный OAuth Google

### Для разработчика:

- ✅ Автоматический OAuth flow
- ✅ Работает на любом хостинге
- ✅ Refresh tokens для долгосрочного доступа
- ✅ Проверка почты каждые 30 секунд
- ✅ Красивая страница успеха после авторизации

## 🔒 Безопасность

- OAuth2 с refresh tokens
- Доступ только на чтение (readonly)
- Токены хранятся в MongoDB
- Можно отозвать доступ в Google Account

## 🐛 Решение проблем

### "Ошибка OAuth callback"

1. Проверь что `BOT_URL` в `.env` правильный
2. Проверь что redirect URI добавлен в Google Cloud Console
3. URL должен быть HTTPS (не HTTP!)

### "Access denied"

1. Проверь что пользователь добавлен в Test users (OAuth consent screen)
2. Или опубликуй приложение (Publish App)

### "Коды не приходят"

1. Проверь логи бота
2. Убедись что письма непрочитанные
3. Проверь что Gmail API включен

## 📊 Архитектура

```
Пользователь → Telegram Bot → Express сервер
                                    ↓
                              OAuth redirect
                                    ↓
                              Google OAuth
                                    ↓
                              Callback URL
                                    ↓
                              Сохранение токенов → MongoDB
```

## 🎯 Roadmap

- [ ] Поддержка Outlook/Hotmail
- [ ] Web dashboard для управления
- [ ] Статистика кодов
- [ ] Уведомления для конкретных отправителей

## 📝 Лицензия

ISC

---

**Сделано для самых ленивых с ❤️**
