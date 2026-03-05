require('dotenv').config();
const puppeteer = require('puppeteer');
const TelegramBot = require('node-telegram-bot-api');

// Inisialisasi Bot Telegram
const token = process.env.TRIGGER_BOT_TOKEN;
const bot = new TelegramBot(token);
const ADMIN_ID = process.env.ALLOWED_CHAT_ID;

(async () => {
  const USER_DATA_PATH = './user_session';
  let browser;

  const cleanup = async () => {
    if (browser) {
      console.log('\nStopping bot and closing browser...');
      await browser.close();
      process.exit();
    }
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      userDataDir: USER_DATA_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--start-maximized'],
      defaultViewport: null,
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    const targetUrl = 'https://sympony.tif3.net/capture-performance';
    console.log(`🌐 Membuka halaman login...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // --- PROSES LOGIN ---
    const loginCheck = await page.$('#username');
    if (loginCheck) {
      console.log(`🔑 Menjalankan proses login...`);
      try {
        await page.type('#username', process.env.WEB_USERNAME);
        await page.type('input[type="password"]', process.env.WEB_PASSWORD);

        await Promise.all([page.click('button[type="submit"]'), page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })]);

        // Verifikasi apakah login benar-benar berhasil (cek apakah input username sudah hilang)
        const stillOnLoginPage = await page.$('#username');

        if (!stillOnLoginPage) {
          console.log('✅ Login Berhasil!');
          await bot.sendMessage(ADMIN_ID, `✅ <b>LOGIN SUCCESS</b>\nBot berhasil login ke Sympony pada <code>${new Date().toLocaleString('id-ID')}</code>`, { parse_mode: 'HTML' });
        } else {
          throw new Error('Password salah atau akun terblokir.');
        }
      } catch (loginError) {
        console.error(`❌ Login Gagal: ${loginError.message}`);
        await bot.sendMessage(ADMIN_ID, `❌ <b>LOGIN FAILED</b>\nError: <code>${loginError.message}</code>`, { parse_mode: 'HTML' });
      }
    } else {
      console.log('ℹ️ Sesi masih aktif, tidak perlu login.');
      await bot.sendMessage(ADMIN_ID, `<b>SESSION ACTIVE</b>\n`, { parse_mode: 'HTML' });
    }

    // --- CAPTURE DIHAPUS SESUAI PERMINTAAN ---
    console.log('🏁 Proses login selesai, tidak ada capture yang dilakukan.');
  } catch (mainError) {
    console.error('🔴 Fatal Error:', mainError.message);
    await bot.sendMessage(ADMIN_ID, `🔴 <b>FATAL ERROR</b>\n${mainError.message}`, { parse_mode: 'HTML' });
  } finally {
    if (browser) {
      await browser.close();
    }
    process.exit();
  }
})();
