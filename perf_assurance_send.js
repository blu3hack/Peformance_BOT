require('dotenv').config();
const puppeteer = require('puppeteer');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const db = require('./connection');
const { generateCaption } = require('./perf_assurance');

// Inisialisasi Bot
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token);

// --- KONFIGURASI ADMIN ---
const ADMIN_ID = process.env.ALLOWED_CHAT_ID;

(async () => {
  const USER_DATA_PATH = './user_session';
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: 'new', // Set 'new' untuk production, false untuk debug
      userDataDir: USER_DATA_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
      defaultViewport: null,
    });

    // Daftar target capture
    const targets = [
      {
        url: 'https://sympony.tif3.net/capture-performance',
        sel: 'body > div:nth-child(1)',
        name: 'asr_ent.png',
        title: 'Alert TTR Indihome',
      },
      {
        url: 'https://sympony.tif3.net/capture-performance',
        sel: 'body > div:nth-child(2)',
        name: 'asr_whf.png',
        title: 'Performance Assurance ENT',
      },
    ];

    const capturedFiles = [];

    for (const target of targets) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });

      try {
        console.log(`🌐 Navigasi ke ${target.url}...`);
        await page.goto(target.url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Cek Login
        const loginCheck = await page.$('#username');
        if (loginCheck) {
          console.log(`🔑 Login ulang...`);
          await page.type('#username', process.env.WEB_USERNAME);
          await page.type('input[type="password"]', process.env.WEB_PASSWORD);
          await Promise.all([page.click('button[type="submit"]'), page.waitForNavigation({ waitUntil: 'networkidle2' })]);
          await page.goto(target.url, { waitUntil: 'networkidle2' });
        }

        await page.waitForSelector(target.sel, { visible: true, timeout: 30000 });
        await new Promise((r) => setTimeout(r, 3000)); // Tunggu render selesai

        const element = await page.$(target.sel);
        if (element) {
          await element.screenshot({ path: target.name });
          capturedFiles.push(target.name);
          console.log(`✅ Berhasil capture: ${target.name}`);
        }
      } catch (captureErr) {
        console.error(`❌ Gagal pada target ${target.title}:`, captureErr.message);
        await bot.sendMessage(ADMIN_ID, `❌ **LOG STATUS GAGAL**\nTarget: ${target.title}\nError: \`${captureErr.message}\``, { parse_mode: 'Markdown' });
      } finally {
        await page.close();
      }
    }

    // Jika ada file yang berhasil di-capture, kirim sebagai Album
    if (capturedFiles.length > 0) {
      console.log('📤 Memulai proses pengiriman album...');
      await sendMediaToTelegram(capturedFiles);
    }
  } catch (err) {
    console.error('🔴 Fatal Error:', err.message);
    await bot.sendMessage(ADMIN_ID, `🔴 **FATAL ERROR SYSTEM**\n${err.message}`);
  } finally {
    if (browser) await browser.close();
    console.log('🏁 Proses Selesai.');
    process.exit();
  }
})();

// --- FUNGSI KIRIM ALBUM KE USER ---
// --- FUNGSI KIRIM ALBUM & TEKS TERPISAH ---
async function sendMediaToTelegram(filenames) {
  try {
    // 1. Ambil data laporan terpusat
    const reportData = await generateCaption();

    // 2. Ambil list user dari database
    const users = await new Promise((resolve, reject) => {
      db.query('SELECT telegram_id, first_name, last_name FROM users_bot', (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    });

    // 3. Baca file ke Buffer agar lebih aman untuk pengiriman massal
    const fileBuffers = filenames.map((file) => fs.readFileSync(file));

    for (const user of users) {
      try {
        // A. Kirim Album Gambar (Gunakan Buffer)
        const mediaGroup = fileBuffers.map((buffer) => ({
          type: 'photo',
          media: buffer,
        }));
        await bot.sendMediaGroup(user.telegram_id, mediaGroup);

        // B. Kirim Teks Summary Terpisah
        await bot.sendMessage(user.telegram_id, reportData, {
          parse_mode: 'HTML',
        });

        // Opsional: Tambahkan sedikit jeda agar tidak terkena spam limit Telegram
        // await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.error(`❌ Gagal kirim ke ${user.telegram_id}:`, e.message);
      }
    }

    // Konfirmasi Akhir ke Admin (Perbaikan Tag Penutup </b>)
    await bot.sendMessage(ADMIN_ID, `✅ <b>REPORT Performance SELESAI</b>`, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('❌ Gagal pada proses Telegram:', error.message);
    // Perbaikan Tag Penutup </b>
    await bot.sendMessage(ADMIN_ID, `❌ <b>ERROR PENGIRIMAN</b>\n<code>${error.message}</code>`, { parse_mode: 'HTML' });
  }
}
