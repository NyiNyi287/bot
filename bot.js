const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');

const token = '7734594664:AAF8s9aIPZdQFRsahCD14uGIaN-g8SzRhr0';
const bot = new TelegramBot(token, { polling: true });

const dataFile = 'data.json';

// Admin user IDs
const admins = [2093673968];

// In-memory data
let users = {}; // userId => { balance: number, history: [] }
let usernameToId = {}; // username => userId

// Load data from JSON file
function loadData() {
  if (fs.existsSync(dataFile)) {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    users = data.users || {};
    usernameToId = data.usernameToId || {};
  }
}

// Save data to JSON file
function saveData() {
  fs.writeFileSync(dataFile, JSON.stringify({ users, usernameToId }, null, 2));
}

// Init user if not exists
function initUser(userId) {
  if (!users[userId]) {
    users[userId] = { balance: 0, history: [] };
  }
}

// Load data on start
loadData();

bot.on('message', (msg) => {
  const from = msg.from;
  if (from.username) {
    usernameToId[from.username.toLowerCase()] = from.id;
    saveData();
  }
  initUser(from.id);

  if (msg.chat.type.includes('group')) {
    if (msg.text === '/start' || msg.text === '/menu') {
      bot.sendMessage(msg.chat.id, "Hello! I'm the bot. Use /menu to see commands.");
    }
  }
});

bot.onText(/\/start/, (msg) => {
  initUser(msg.from.id);
  bot.sendMessage(msg.chat.id, "Hello! I'm the bot. Use /menu to see commands.");
});

bot.onText(/\/menu/, (msg) => {
  const isAdmin = admins.includes(msg.from.id);
  let menu = `Commands:
/transfer @username amount - send money to a user
/history - see your transaction history`;

  if (isAdmin) {
    menu += `\n/deposit @username amount - add money (admin only)`;
  }

  bot.sendMessage(msg.chat.id, menu);
});

bot.onText(/\/deposit (@?\w+) (\d+(\.\d+)?)/, (msg, match) => {
  const adminId = msg.from.id;
  if (!admins.includes(adminId)) return;

  const username = match[1].replace('@', '').toLowerCase();
  const amount = parseFloat(match[2]);
  const userId = usernameToId[username];

  if (!userId) {
    bot.sendMessage(msg.chat.id, `@${username} has not used the bot yet.`);
    return;
  }

  if (amount <= 0) {
    bot.sendMessage(msg.chat.id, "Amount must be positive.");
    return;
  }

  initUser(userId);
  users[userId].balance += amount;
  users[userId].history.push({
    type: 'deposit',
    amount,
    time: new Date().toISOString(),
    by: adminId
  });
  saveData();

  bot.sendMessage(msg.chat.id, `Deposited $${amount} to @${username}.`);
});

bot.onText(/\/transfer (@?\w+) (\d+(\.\d+)?)/, (msg, match) => {
  const fromId = msg.from.id;
  const username = match[1].replace('@', '').toLowerCase();
  const amount = parseFloat(match[2]);
  const toId = usernameToId[username];

  if (!toId) {
    bot.sendMessage(msg.chat.id, `User @${username} not found or hasn't used the bot.`);
    return;
  }

  if (toId === fromId) {
    bot.sendMessage(msg.chat.id, "You cannot transfer money to yourself.");
    return;
  }

  if (amount <= 0) {
    bot.sendMessage(msg.chat.id, "Amount must be positive.");
    return;
  }

  initUser(fromId);
  initUser(toId);

  if (users[fromId].balance < amount) {
    bot.sendMessage(msg.chat.id, "Insufficient balance.");
    return;
  }

  users[fromId].balance -= amount;
  users[toId].balance += amount;
  const time = new Date().toISOString();

  users[fromId].history.push({
    type: 'transfer_out',
    amount,
    to: username,
    time
  });

  users[toId].history.push({
    type: 'transfer_in',
    amount,
    from: msg.from.username || fromId,
    time
  });
  saveData();

  bot.sendMessage(msg.chat.id, `Transferred $${amount} to @${username}.`);
});

bot.onText(/\/history/, (msg) => {
  const userId = msg.from.id;
  initUser(userId);
  const history = users[userId].history;

  if (history.length === 0) {
    bot.sendMessage(msg.chat.id, "No transactions yet.");
    return;
  }

  let response = "Your transactions:\n";
  history.forEach((tx, i) => {
    if (tx.type === 'deposit') {
      response += `${i + 1}. Deposited $${tx.amount} by admin ${tx.by} at ${tx.time}\n`;
    } else if (tx.type === 'transfer_out') {
      response += `${i + 1}. Sent $${tx.amount} to @${tx.to} at ${tx.time}\n`;
    } else if (tx.type === 'transfer_in') {
      response += `${i + 1}. Received $${tx.amount} from @${tx.from} at ${tx.time}\n`;
    }
  });

  bot.sendMessage(msg.chat.id, response);
});
