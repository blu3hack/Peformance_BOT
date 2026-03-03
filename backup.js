require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./connection');
const fs = require('fs');
const { spawn } = require('child_process');
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const { getPerformanceReport } = require('./unit_test');

console.log('Starting Bot...');

// =================================
// COMMAND /start
// =================================
bot.onText(/\/start/, (msg) => {
  const telegramId = msg.from.id;
  const username = msg.from.username || null;
  const firstName = msg.from.first_name || '';
  const lastName = msg.from.last_name || '';

  bot.sendMessage(msg.chat.id, `Mohon Izin <b>Bapak/Ibu: ${firstName} ${lastName}</b>\nReport Performance Daily akan diupdate melalui BOT ini.\nTerima Kasih.`, { parse_mode: 'HTML' });

  const sql = `
    INSERT INTO users_bot (telegram_id, username, first_name, last_name)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      username = VALUES(username),
      first_name = VALUES(first_name),
      last_name = VALUES(last_name)
  `;

  db.query(sql, [telegramId, username, firstName, lastName], (err) => {
    if (err) console.error('Gagal simpan user:', err);
    else console.log('User berhasil disimpan / diupdate');
  });
});

// =================================
// MENERIMA SEMUA PESAN
// =================================
bot.on('message', async (msg) => {
  if (!msg.text || msg.text === '/start') return;

  const username = msg.from.username || '';
  const firstName = msg.from.first_name || '';
  const lastName = msg.from.last_name || '';
  const text = msg.text.trim().toLowerCase();

  const allowed_username = ['nheq_12'];

  if (!allowed_username.includes(username)) {
    return bot.sendMessage(msg.chat.id, `Mohon Maaf <b>Bapak/Ibu</b>\nBOT ini tidak untuk menerima pesan.\nTerima Kasih.`, { parse_mode: 'HTML' });
  }

  if (text === 'send') {
    // 1. Ambil data user dari database
    db.query('SELECT telegram_id, first_name, last_name FROM users_bot', async (err, results) => {
      if (err) {
        console.error('Gagal mengambil data dari DB:', err);
        return bot.sendMessage(msg.chat.id, 'Gagal mengakses database.');
      }

      // --- PERBAIKAN 1: Ambil report SEKALI saja di sini ---
      let reportData;
      try {
        reportData = await getPerformanceReport();
      } catch (e) {
        console.error('Gagal ambil report:', e);
        return bot.sendMessage(msg.chat.id, 'Gagal membuat laporan performansi.');
      }

      const d = new Date();
      const formatIndo = new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'long',
        timeStyle: 'medium',
      }).format(d);

      // 2. Fungsi Kirim Gambar
      async function send_capture(filename, title) {
        if (!fs.existsSync(filename)) return;

        for (const user of results) {
          try {
            await bot.sendPhoto(user.telegram_id, fs.createReadStream(filename), {
              caption: `Report ${title}\nPosisi : ${formatIndo}\n\n<code>${reportData.summaryText}</code>`,
              parse_mode: 'HTML',
            });
            console.log(`Berhasil kirim ke ${user.telegram_id}`);
          } catch (err) {
            console.log(`Gagal kirim ke ${user.telegram_id}:`, err.message);
          }
        }
      }

      // 3. Eksekusi Pengiriman
      await send_capture('alert-indihome.png', 'Alert TTR Indihome');
      bot.sendMessage(msg.chat.id, '✅ Laporan telah dikirim ke semua user.');
    });
  }

  console.log(`Pesan masuk dari ${username}: ${text}`);
});
