// server.js — Check Ban Kira (Telegram + Baileys)
// Variable Render : BOT_TOKEN (obligatoire)

const express = require('express');
const fs = require('fs');
const path = require('path');
const { Telegraf } = require('telegraf');
const { registerCommands, sendPromo } = require('./commands');

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error('❌ BOT_TOKEN manquant');
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
const PROMO_INTERVAL = 10 * 60 * 1000; // 10 minutes
const PING_INTERVAL = 5 * 60 * 1000; // 5 minutes (anti-sleep)

// ---------- Stockage simple (JSON) ----------
// ⚠️ Sur Render free, le disque est effacé à chaque redémarrage.
const DATA_FILE = path.join(__dirname, 'data.json');
let store = { users: [], groups: [] };
try {
  store = { ...store, ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) };
} catch {}
const save = () => {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(store)); } catch {}
};
store.save = save;

// ---------- Serveur web + anti-sleep ----------
const app = express();
app.get('/', (_req, res) => res.send('☠︎︎༒︎ CHECK BAN KIRA — en ligne ༒︎☠︎︎'));
app.get('/ping', (_req, res) => res.send('pong'));
app.listen(PORT, () => console.log(`🌐 Serveur sur le port ${PORT}`));

setInterval(async () => {
  try {
    await fetch(`${SELF_URL}/ping`);
    console.log('🏓 ping anti-sleep OK');
  } catch (e) {
    console.log('🏓 ping échoué :', e.message);
  }
}, PING_INTERVAL);

// ---------- Bot Telegram ----------
const bot = new Telegraf(TOKEN);

// Enregistre utilisateurs (privé) et groupes
bot.use(async (ctx, next) => {
  const chat = ctx.chat;
  if (chat) {
    if (chat.type === 'private' && ctx.from && !store.users.includes(ctx.from.id)) {
      store.users.push(ctx.from.id);
      save();
    }
    if ((chat.type === 'group' || chat.type === 'supergroup') && !store.groups.includes(chat.id)) {
      store.groups.push(chat.id);
      save();
    }
  }
  return next();
});

// Ajout / retrait du bot dans un groupe
bot.on('my_chat_member', (ctx) => {
  const chat = ctx.chat;
  const status = ctx.myChatMember.new_chat_member.status;
  if (chat.type !== 'group' && chat.type !== 'supergroup') return;
  if (['member', 'administrator'].includes(status)) {
    if (!store.groups.includes(chat.id)) store.groups.push(chat.id);
  } else {
    store.groups = store.groups.filter((id) => id !== chat.id);
  }
  save();
});

registerCommands(bot, store);

bot.catch((err) => console.error('Erreur bot :', err.message));

// ---------- Envoi auto (image + message + boutons) toutes les 10 min ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

setInterval(async () => {
  for (const chatId of [...store.groups]) {
    try {
      await sendPromo(bot, chatId);
    } catch (e) {
      const code = e?.response?.error_code;
      if (code === 403 || code === 400) {
        store.groups = store.groups.filter((id) => id !== chatId);
        save();
      }
      console.log(`Promo échouée (${chatId}) :`, e.message);
    }
    await sleep(1500);
  }
}, PROMO_INTERVAL);

bot.launch({ dropPendingUpdates: true }).then(() => console.log('🤖 Bot lancé'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
