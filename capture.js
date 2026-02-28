require('dotenv').config();
const puppeteer = require('puppeteer');

(async () => {
  const USER_DATA_PATH = './user_session';
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: false, // Gunakan mode headless terbaru yang lebih stabil
      userDataDir: USER_DATA_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--start-maximized', '--disable-features=IsolateOrigins,site-per-process'],
      defaultViewport: null,
    });

    const page = await browser.newPage();

    // Agar tidak terdeteksi bot oleh Cloudflare
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });

    const targets = [
      { url: 'https://sympony.tif3.net/capture-performance', sel: 'body > div:nth-child(1)', name: 'ASR-ENT.png' },
      { url: 'https://sympony.tif3.net/capture-performance', sel: 'body > div:nth-child(2)', name: 'ASR-WHF.png' },
      { url: 'https://sympony.tif3.net/bot-assurance/indihome', sel: '#captureArea', name: 'alert-indihome.png' },
      { url: 'https://sympony.tif3.net/bot-assurance/indibiz', sel: '#captureArea', name: 'alert-indibiz.png' },
      { url: 'https://sympony.tif3.net/bot-assurance/network', sel: '#captureArea', name: 'alert-gamas-network.png' },
      { url: 'https://sympony.tif3.net/bot-assurance/access', sel: '#captureArea', name: 'alert-gamas-acces.png' },
    ];

    for (const target of targets) {
      try {
        console.log(`\nProcessing: ${target.name}...`);

        // 1. Navigasi dengan timeout yang longgar
        await page.goto(target.url, { waitUntil: 'load', timeout: 60000 });

        // 2. Cek Login (Hanya jika elemen username muncul)
        const loginCheck = await page.$('#username');
        if (loginCheck) {
          console.log(`🔑 Sesi habis di ${target.name}, mencoba login...`);
          await page.type('#username', process.env.WEB_USERNAME);
          await page.type('input[type="password"]', process.env.WEB_PASSWORD);
          await Promise.all([page.click('button[type="submit"]'), page.waitForNavigation({ waitUntil: 'networkidle2' })]);
          // Kembali ke halaman target setelah login
          await page.goto(target.url, { waitUntil: 'networkidle2' });
        }

        // 3. Force Light Mode & Stabilisasi Element
        await page.evaluate(() => {
          localStorage.setItem('theme', 'light');
          const style = document.createElement('style');
          style.innerHTML = `
                        * { transition: none !important; animation: none !important; }
                        body, .dark, [data-theme='dark'] { background: white !important; color: black !important; }
                    `;
          document.head.appendChild(style);
        });

        // 4. Tunggu selector stabil & visible
        await page.waitForSelector(target.sel, { visible: true, timeout: 30000 });

        // Jeda 2 detik untuk render chart/grafik
        await new Promise((r) => setTimeout(r, 2000));

        const element = await page.$(target.sel);
        if (element) {
          await element.screenshot({ path: target.name });
          console.log(`✅ Berhasil capture: ${target.name}`);
        }
      } catch (err) {
        console.error(`❌ Gagal pada ${target.name}: ${err.message}`);
        // Lanjut ke target berikutnya, jangan matikan seluruh proses
      }
    }
  } catch (mainError) {
    console.error('🔴 Fatal Error:', mainError.message);
  } finally {
    if (browser) {
      console.log('\nClosing browser...');
      await browser.close();
    }
  }
})();
