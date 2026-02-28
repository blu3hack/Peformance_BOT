require('dotenv').config();
const puppeteer = require('puppeteer');

(async () => {
  const USER_DATA_PATH = './user_session';
  let browser;

  // Handler agar saat script dimatikan (Ctrl+C), browser ikut tertutup bersih
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
      headless: false,
      userDataDir: USER_DATA_PATH,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--start-maximized',
        '--no-first-run', // Mencegah munculnya welcome screen chrome
      ],
      defaultViewport: null,
    });

    // --- PERBAIKAN: Bersihkan tab default yang terbuka otomatis ---
    const initialPages = await browser.pages();
    if (initialPages.length > 1) {
      // Tutup semua tab kecuali yang satu (agar browser tidak mati)
      for (let i = 1; i < initialPages.length; i++) {
        await initialPages[i].close();
      }
    }

    const targets = [
      { url: 'https://sympony.tif3.net/capture-performance', sel: 'body > div:nth-child(1)', name: 'ASR-ENT.png' },
      { url: 'https://sympony.tif3.net/capture-performance', sel: 'body > div:nth-child(2)', name: 'ASR-WHF.png' },
      { url: 'https://sympony.tif3.net/bot-assurance/indihome', sel: '#captureArea', name: 'alert-indihome.png' },
      { url: 'https://sympony.tif3.net/bot-assurance/indibiz', sel: '#captureArea', name: 'alert-indibiz.png' },
      { url: 'https://sympony.tif3.net/bot-assurance/network', sel: '#captureArea', name: 'alert-gamas-network.png' },
      { url: 'https://sympony.tif3.net/bot-assurance/access', sel: '#captureArea', name: 'alert-gamas-acces.png' },
    ];

    for (const target of targets) {
      let page;
      try {
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });

        await page.goto(target.url, { waitUntil: 'networkidle2', timeout: 60000 });

        const loginCheck = await page.$('#username');
        if (loginCheck) {
          console.log(`🔑 Sesi habis, login ulang...`);
          await page.type('#username', process.env.WEB_USERNAME);
          await page.type('input[type="password"]', process.env.WEB_PASSWORD);
          await Promise.all([page.click('button[type="submit"]'), page.waitForNavigation({ waitUntil: 'networkidle2' })]);
          await page.goto(target.url, { waitUntil: 'networkidle2' });
        }

        await page.evaluate(() => {
          localStorage.setItem('theme', 'light');
          const style = document.createElement('style');
          style.innerHTML = `* { transition: none !important; animation: none !important; }`;
          document.head.appendChild(style);
        });

        await page.waitForSelector(target.sel, { visible: true, timeout: 30000 });
        await new Promise((r) => setTimeout(r, 2000));

        const element = await page.$(target.sel);
        if (element) {
          await element.screenshot({ path: target.name });
          console.log(`✅ Berhasil capture: ${target.name}`);
        }
      } catch (err) {
        console.error(`❌ Gagal pada ${target.name}: ${err.message}`);
      } finally {
        if (page) {
          await page.close(); // Tutup tab segera setelah selesai
        }
      }
    }
  } catch (mainError) {
    console.error('🔴 Fatal Error:', mainError.message);
  } finally {
    if (browser) {
      console.log('\nAll targets processed. Closing browser...');
      await browser.close();
    }
  }
})();
