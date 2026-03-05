require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./connection');
const fs = require('fs');
const { spawn } = require('child_process');
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const today = new Date().toISOString().split('T')[0];

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

  if (text === 'capture') {
    bot.sendMessage(msg.chat.id, 'Sedang mengirim');
    // Menjalankan 'node capture.js'
    const prosesCapture = spawn('node', ['perf_assurance_send.js']);
    prosesCapture.stdout.on('data', (data) => {
      console.log(`Stdout: ${data}`);
    });
    prosesCapture.stderr.on('data', (data) => {
      console.error(`Stderr: ${data}`);
    });
    prosesCapture.on('close', (code) => {
      if (code === 0) {
        bot.sendMessage(msg.chat.id, '<b>Proses Pengitiman Report Performance Selesai', { parse_mode: 'HTML' });
      } else {
        bot.sendMessage(msg.chat.id, `❌ Terjadi kesalahan saat menjalankan capture.js (Exit Code: ${code})`);
      }
    });
  }
});
