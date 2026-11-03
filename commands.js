// commands.js — commandes du bot + vérification WhatsApp (Baileys)

const fs = require('fs');
const pino = require('pino');
const { Markup } = require('telegraf');

// ---------- Constantes ----------
const BOT_LINK = 'https://t.me/Check_ban_kira_bot';
const SUPPORT_LINK = 'https://t.me/KIRA_SUPPORT_HUB';

const IMG_START = 'https://i.ibb.co/TqbYZw24/76-B6-D7-C4-6848-4-EEE-B630-99950-FD07-C82.jpg';
const IMG_LINK = 'https://i.ibb.co/5gSLZVLY/386-B4665-E762-4100-9-D0-A-F7142-D2-A2036.jpg';
const IMG_RESULT = 'https://i.ibb.co/nqvr8nqN/425-EC70-B-54-D2-4-B11-80-FB-A645584923-E1.jpg';

const BANNER = `<pre>════════════════════════════════════
   ✦ ︎ ☠︎︎༒︎ 𝙲𝙷𝙴𝙲𝙺 𝙱𝙰𝙽 𝙺𝙸𝚁𝙰 ༒︎☠︎︎ ✦
════════════════════════════════════
CREATOR : ⫸𝐌𝐫 𝐊𝐈𝐑𝐀┃𝗧𝗘𝗖𝗛 🌐⫷</pre>`;

const linksKeyboard = () =>
  Markup.inlineKeyboard([
    [Markup.button.url('📢 Suivre la chaîne Telegram', 'https://t.me/+mQ3aQpCsEqI0YmY0')],
    [Markup.button.url('1️⃣ Rejoindre le groupe 1', 'https://t.me/+2JDC_Be4_ww1N2Vk')],
    [Markup.button.url('2️⃣ Rejoindre le groupe 2', 'https://t.me/+Z-P_xjUgJjU0MjM0')],
    [Markup.button.url('📢 Suivre la chaîne WhatsApp', 'https://whatsapp.com/channel/0029Vb7WJzp84OmBD0fEEJ2X')],
    [Markup.button.url('🌐 Rejoindre le groupe WhatsApp', 'https://chat.whatsapp.com/IP0nFB79rMDF0nvFSMXtDR')],
  ]);

const startCaption = `${BANNER}\n\n👋 Bienvenue sur ☠︎︎༒︎ 𝙲𝙷𝙴𝙲𝙺 𝙱𝙰𝙽 𝙺𝙸𝚁𝙰 ༒︎☠︎︎\nRejoins nos canaux &amp; groupes pour continuer.`;

// Message envoyé automatiquement dans les groupes
async function sendPromo(bot, chatId) {
  return bot.telegram.sendPhoto(chatId, IMG_LINK, {
    caption: startCaption,
    parse_mode: 'HTML',
    ...linksKeyboard(),
  });
}

// ---------- Vérification WhatsApp (Baileys) ----------
let queue = Promise.resolve();
function checkNumber(rawNumber) {
  const run = () => doCheck(rawNumber);
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

async function doCheck(number, timeoutMs = 30000) {
  const baileys = await import('@whiskeysockets/baileys');
  const makeWASocket = baileys.default?.default || baileys.default || baileys.makeWASocket;
  const { useMultiFileAuthState, Browsers } = baileys;

  const dir = `./tmp_check_${number}_${Date.now()}`;
  const { state } = await useMultiFileAuthState(dir);

  return new Promise((resolve) => {
    let done = false;
    let sock;
    let timer;

    const finish = (status, detail) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { sock.end(undefined); } catch {}
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
      resolve({ status, detail });
    };

    timer = setTimeout(() => finish('unknown', 'Délai dépassé'), timeoutMs);

    sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: Browsers.ubuntu('Chrome'),
      printQRInTerminal: false,
    });

    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code === 403 || code === 401) finish('banned', `Connexion refusée (code ${code})`);
        else finish('unknown', `Connexion fermée (code ${code ?? 'inconnu'})`);
      }
    });

    setTimeout(async () => {
      try {
        if (!sock.authState.creds.registered) {
          await sock.requestPairingCode(number);
          finish('active', 'Jumelage accepté');
        }
      } catch (err) {
        const code = err?.output?.statusCode;
        const msg = String(err?.message || '').toLowerCase();
        if (code === 403 || code === 401 || msg.includes('forbidden') || msg.includes('banned')) {
          finish('banned', `Refusé par WhatsApp (code ${code ?? 'n/a'})`);
        } else {
          finish('unknown', err?.message || 'Erreur inconnue');
        }
      }
    }, 3000);
  });
}

// Date au format HH:mm - JJ/MM/AA
function nowStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())} - ${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
}

// ---------- Commandes ----------
const cooldown = new Map(); // 1 vérification / 5 min par utilisateur
const COOLDOWN_MS = 5 * 60 * 1000;

function registerCommands(bot, store) {
  // /start
  bot.start((ctx) =>
    ctx.replyWithPhoto(IMG_START, {
      caption: startCaption,
      parse_mode: 'HTML',
      ...linksKeyboard(),
    })
  );

  // /help
  bot.help((ctx) =>
    ctx.reply(
      `<pre>━━━━━━━━━━━━━━━━━━━━
⚡ DÉMARRAGE RAPIDE
━━━━━━━━━━━━━━━━━━━━
1️⃣ Tapez ➜ /check (numero sans +)
2️⃣ Envoyez le numéro à vérifier à WhatsApp
3️⃣ Ensuite vous verrez le statut du compte
━━━━━━━━━━━━━━━━━━━━</pre>`,
      { parse_mode: 'HTML' }
    )
  );

  // /link
  bot.command('link', (ctx) =>
    ctx.replyWithPhoto(IMG_LINK, {
      caption: '🔗 Nos liens officiels',
      ...linksKeyboard(),
    })
  );

  // /contact
  bot.command('contact', (ctx) =>
    ctx.reply(
      `<pre>📩 Support Kira Tech\nClique sur le bouton ci-dessous pour contacter l'équipe.</pre>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.url('💬 Contacter le support', SUPPORT_LINK)]]),
      }
    )
  );

  // /users
  bot.command('users', (ctx) =>
    ctx.replyWithPhoto(IMG_START, {
      caption: `<pre>━━━━━━━━━━━━━━━━━━
✦  ☠︎︎༒︎ 𝕊ℍ𝔸𝔻𝕆𝕎 𝕂𝕀ℝ𝔸 𝔹𝕆𝕋 ༒︎☠︎︎ ✦
⚜️ By Mr Kira Tech 🌐
━━━━━━━━━━━━━━━━━━━
╔══════════════════════════╗
👥 Nombre d'utilisateurs : ( ${store.users.length} ) 🚹🚺
╚══════════════════════════╝
🔗 Bot : ${BOT_LINK}
> Mr Kira tech 🌐</pre>`,
      parse_mode: 'HTML',
    })
  );

  // /check 242XXXXXXXXX
  bot.command('check', async (ctx) => {
    const arg = (ctx.message.text.split(/\s+/)[1] || '').trim();

    if (!/^\d{8,15}$/.test(arg)) {
      return ctx.reply(
        '⚠️ Échec : le numéro est erroné, veuillez respecter le format.\n\nEx : /check 242XXXXXXXXX (sans le +)'
      );
    }

    const last = cooldown.get(ctx.from.id) || 0;
    if (Date.now() - last < COOLDOWN_MS) {
      return ctx.reply('⏳ Patiente quelques minutes avant une nouvelle vérification.');
    }
    cooldown.set(ctx.from.id, Date.now());

    await ctx.reply(`⏳ Demande de ${arg} ...`);
    const { status, detail } = await checkNumber(arg);

    if (status === 'unknown') {
      return ctx.reply(`❓ Résultat indéterminé pour ${arg}.\n${detail}\nRéessaie dans quelques minutes.`);
    }

    const banned = status === 'banned';
    const caption = `<pre>━━━━━━━━━━━━━━━━━━━

•𝙽𝚞𝚖𝚎𝚛𝚘 : ${arg}${banned ? ' 💀' : ''}

•𝚂𝚝𝚊𝚝𝚞𝚝 : ${banned ? 'Banni 📵' : 'Disponible ✅'}

•𝚅𝚎𝚛𝚒𝚏𝚒𝚎 𝚕𝚎 : ${nowStamp()}

━━━━━━━━━━━━━━━━━━━</pre>
Merci d'avoir utilisé le bot de Mr Kira Tech 🌐`;

    return ctx.replyWithPhoto(IMG_RESULT, { caption, parse_mode: 'HTML' });
  });
}

module.exports = { registerCommands, sendPromo, checkNumber };
