// telegram-financial-bot.js const TelegramBot = require('node-telegram-bot-api'); const fs = require('fs');

const token = '7734594664:AAF8s9aIPZdQFRsahCD14uGIaN-g8SzRhr0'; const adminId = 2093673968; const usersFile = './users.json';

let users = {}; if (fs.existsSync(usersFile)) { users = JSON.parse(fs.readFileSync(usersFile, 'utf8')); }

function saveUsers() { try { fs.writeFileSync(usersFile, JSON.stringify(users, null, 2)); console.log('Saved users.json'); } catch (err) { console.error('Error writing users.json:', err); } }

function initUser(id, username = '') { if (!users[id]) { users[id] = { username, balance: 0, history: [] }; } else if (username && users[id].username !== username) { users[id].username = username; } }

function findUserByUsername(username) { if (!username) return null; username = username.toLowerCase().replace('@', '').trim(); for (const [id, user] of Object.entries(users)) { if (user.username && user.username.toLowerCase().trim() === username) { return [id, user]; } } return null; }

const bot = new TelegramBot(token, { polling: true });

bot.onText(//start/, (msg) => { const id = msg.from.id; const username = msg.from.username; initUser(id, username); saveUsers(); bot.sendMessage(msg.chat.id, "Hello! I'm the bot. Type /menu to see commands."); });

bot.onText(//menu/, (msg) => { const menu = [ '/balance - Check your balance', '/send - Send money to someone', '/history - View your transaction history', ]; if (msg.from.id === adminId) { menu.push('/deposit @username amount - Admin deposit'); menu.push('/users - List all users'); } bot.sendMessage(msg.chat.id, menu.join('\n')); });

bot.onText(//balance/, (msg) => { const id = msg.from.id; initUser(id, msg.from.username); const user = users[id]; bot.sendMessage(msg.chat.id, Your balance: $${user.balance}); });

bot.onText(//send/, (msg) => { const chatId = msg.chat.id; const senderId = msg.from.id; initUser(senderId, msg.from.username);

bot.sendMessage(chatId, 'Enter the username you want to send to (with @):').then(() => { bot.once('message', (msg2) => { const targetUsername = msg2.text; const recipientEntry = findUserByUsername(targetUsername);

if (!recipientEntry) {
    return bot.sendMessage(chatId, 'User not found or has not used /start.');
  }

  const [recipientId, recipient] = recipientEntry;
  bot.sendMessage(chatId, 'Enter the amount to send:').then(() => {
    bot.once('message', (msg3) => {
      const amount = parseFloat(msg3.text);
      const sender = users[senderId];

      if (isNaN(amount) || amount <= 0) {
        return bot.sendMessage(chatId, 'Invalid amount.');
      }
      if (sender.balance < amount) {
        return bot.sendMessage(chatId, 'Insufficient balance.');
      }

      sender.balance -= amount;
      recipient.balance += amount;

      const timestamp = new Date().toLocaleString();
      sender.history.push(`Sent $${amount} to @${recipient.username} on ${timestamp}`);
      recipient.history.push(`Received $${amount} from @${sender.username} on ${timestamp}`);
      saveUsers();

      bot.sendMessage(chatId, `Sent $${amount} to @${recipient.username}`);
      bot.sendMessage(recipientId, `You received $${amount} from @${sender.username}`);
    });
  });
});

}); });

bot.onText(//history/, (msg) => { const id = msg.from.id; initUser(id, msg.from.username); const user = users[id]; const history = user.history.length ? user.history.join('\n') : 'No transactions yet.'; bot.sendMessage(msg.chat.id, history); });

bot.onText(//deposit (.+) (.+)/, (msg, match) => { const senderId = msg.from.id; if (senderId !== adminId) return bot.sendMessage(msg.chat.id, 'Only admin can use this.');

const username = match[1].replace('@', ''); const amount = parseFloat(match[2]); const entry = findUserByUsername(username);

if (!entry || isNaN(amount) || amount <= 0) { return bot.sendMessage(msg.chat.id, 'Invalid username or amount.'); }

const [id, user] = entry; user.balance += amount; user.history.push(Deposited $${amount} by admin on ${new Date().toLocaleString()}); saveUsers();

bot.sendMessage(msg.chat.id, Deposited $${amount} to @${username}); bot.sendMessage(id, Admin deposited $${amount} to your account); });

bot.onText(//users/, (msg) => { if (msg.from.id !== adminId) return; const list = Object.entries(users) .map(([id, u]) => @${u.username || 'no_username'}: $${u.balance}) .join('\n') || 'No users.'; bot.sendMessage(msg.chat.id, list); });

  
