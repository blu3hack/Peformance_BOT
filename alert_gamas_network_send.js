require('dotenv').config();
const puppeteer = require('puppeteer');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const db = require('./connection');
const { getPerformanceReport } = require('./alert_gamas_network');

// Inisialisasi Bot
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token);

// --- KONFIGURASI ADMIN ---
const ADMIN_ID = process.env.ALLOWED_CHAT_ID; // Ganti dengan ID Telegram Anda (contoh: '12345678')

(async () => {
  const USER_DATA_PATH = './user_session';
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      userDataDir: USER_DATA_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
      defaultViewport: null,
    });

    const targets = [
      {
        url: 'https://sympony.tif3.net/bot-assurance/network',
        sel: '#captureArea',
        name: 'alert-gamas-network.png',
        title: 'Alert Gamas Network',
      },
    ];

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
        await new Promise((r) => setTimeout(r, 3000));

        const element = await page.$(target.sel);
        if (element) {
          await element.screenshot({ path: target.name });
          console.log(`✅ Berhasil capture: ${target.name}`);

          // --- KIRIM STATUS BERHASIL KE ADMIN ---
          await bot.sendMessage(ADMIN_ID, `✅ <b>LOG STATUS</b>\nCapture <b>${target.title}</b> Berhasil.\nSedang memproses pengiriman ke user...`, { parse_mode: 'HTML' });

          // Kirim ke semua user di database
          await sendToTelegram(target.name, target.title);
        }
      } catch (captureErr) {
        console.error(`❌ Gagal pada target ${target.title}:`, captureErr.message);
        // --- KIRIM STATUS GAGAL KE ADMIN ---
        await bot.sendMessage(ADMIN_ID, `❌ <b>LOG STATUS GAGAL</b>\nTarget: ${target.title}\nError: <code>${captureErr.message}</code>`, { parse_mode: 'HTML' });
      } finally {
        await page.close();
      }
    }
  } catch (err) {
    console.error('🔴 Fatal Error:', err.message);
    await bot.sendMessage(ADMIN_ID, `🔴 <b>FATAL ERROR SYSTEM</b>\n${err.message}`);
  } finally {
    if (browser) await browser.close();
    console.log('🏁 Proses Selesai.');
    process.exit();
  }
})();

// --- FUNGSI KIRIM KE USER (DATABASE) ---
async function sendToTelegram(filename, title) {
  console.log(`📤 Menyiapkan pengiriman untuk ${title}...`);

  try {
    const reportData = await getPerformanceReport();
    const users = await new Promise((resolve, reject) => {
      db.query('SELECT telegram_id, first_name, last_name FROM users_bot', (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    });

    const cutoffQuery = "SELECT waktu_update FROM metabase.waktu_update_all WHERE penamaan = 'nossa' LIMIT 1";
    const cutoffTime = await new Promise((resolve) => {
      db.query(cutoffQuery, (err, res) => {
        if (err || !res || res.length === 0) resolve('-');
        else {
          const d = new Date(res[0].waktu_update);
          const cleanDate =
            d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
          resolve(cleanDate);
        }
      });
    });

    for (const user of users) {
      try {
        const namaPenerima = `${user.first_name || ''} ${user.last_name || ''}`.trim();
        const captionText = `Report ${title}\n` + `Posisi : ${cutoffTime}\n\n` + `<code>${reportData.summaryText}</code>`;

        await bot.sendPhoto(user.telegram_id, fs.createReadStream(filename), {
          caption: captionText,
          parse_mode: 'HTML',
        });
      } catch (e) {
        console.error(`   ❌ Gagal kirim ke ${user.telegram_id}:`, e.message);
      }
    }

    // Kirim konfirmasi akhir ke Admin
    await bot.sendMessage(ADMIN_ID, `🏁 <b>REPORT SELESAI</b>\nLaporan ${title} telah selesai dikirim ke seluruh user di database.`);
  } catch (error) {
    console.error('❌ Gagal pada proses Telegram:', error.message);
    await bot.sendMessage(ADMIN_ID, `❌ <b>ERROR PENGIRIMAN</b>\n${error.message}`);
  }
}
