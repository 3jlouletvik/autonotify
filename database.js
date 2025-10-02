const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  gmailAccounts: [{
    email: String,
    tokens: Object,
    historyId: String,
    addedAt: { type: Date, default: Date.now }
  }],
  pendingAuth: {
    state: String,
    timestamp: Date
  }
});

const User = mongoose.model('User', userSchema);

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ База данных подключена');
  } catch (error) {
    console.error('❌ Ошибка подключения к БД:', error);
    process.exit(1);
  }
}

async function saveUserTokens(telegramId, email, tokens, historyId) {
  try {
    await User.findOneAndUpdate(
      { telegramId },
      { 
        $push: { 
          gmailAccounts: { email, tokens, historyId } 
        },
        $unset: { pendingAuth: "" }
      },
      { upsert: true, new: true }
    );
    console.log(`✅ Токены сохранены для ${email}`);
  } catch (error) {
    console.error('❌ Ошибка сохранения токенов:', error);
    throw error;
  }
}

async function setPendingAuth(telegramId, state) {
  await User.findOneAndUpdate(
    { telegramId },
    { pendingAuth: { state, timestamp: new Date() } },
    { upsert: true }
  );
}

async function findUserByState(state) {
  return await User.findOne({ 'pendingAuth.state': state });
}

async function getUserAccounts(telegramId) {
  try {
    const user = await User.findOne({ telegramId });
    return user ? user.gmailAccounts : [];
  } catch (error) {
    console.error('❌ Ошибка получения аккаунтов:', error);
    return [];
  }
}

async function removeAccount(telegramId, email) {
  try {
    await User.updateOne(
      { telegramId },
      { $pull: { gmailAccounts: { email } } }
    );
    console.log(`✅ Email удален: ${email}`);
  } catch (error) {
    console.error('❌ Ошибка удаления email:', error);
    throw error;
  }
}

async function getAllUsers() {
  return await User.find({});
}

async function updateHistoryId(telegramId, email, historyId) {
  try {
    await User.updateOne(
      { telegramId, 'gmailAccounts.email': email },
      { $set: { 'gmailAccounts.$.historyId': historyId } }
    );
  } catch (error) {
    console.error('❌ Ошибка обновления historyId:', error);
  }
}

module.exports = { 
  connectDB, 
  saveUserTokens,
  setPendingAuth,
  findUserByState,
  getUserAccounts, 
  removeAccount,
  getAllUsers,
  updateHistoryId,
  User 
};
