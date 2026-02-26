require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');
console.log('ENV TEST:', process.env.WEB_USERNAME);

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions', '--disable-blink-features=AutomationControlled', '--start-maximized'],
    defaultViewport: null,
  });

  const page = await browser.newPage();
  const COOKIE_PATH = './cookies.json';

  // ===============================
  // SET VIEWPORT AGAR TAJAM & TIDAK TERPOTONG
  // ===============================
  await page.setViewport({
    width: 1920,
    height: 768,
    deviceScaleFactor: 2, // bikin hasil tajam
  });

  // ===============================
  // BUKA DOMAIN DULU (WAJIB)
  // ===============================
  await page.goto('https://sympony.tif3.net', {
    waitUntil: 'networkidle2',
  });

  // ===============================
  // LOAD COOKIE JIKA ADA
  // ===============================
  if (fs.existsSync(COOKIE_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH));
    await page.setCookie(...cookies);
    console.log('Cookie loaded');
  }

  // ===============================
  // COBA AKSES HALAMAN TARGET
  // ===============================
  await page.goto('https://sympony.tif3.net/capture-performance', {
    waitUntil: 'networkidle2',
  });

  console.log('URL sekarang:', page.url());

  // ===============================
  // JIKA REDIRECT KE SIGNIN → LOGIN
  // ===============================
  if (page.url().includes('signin')) {
    console.log('Session expired, login ulang...');

    console.log(process.env.WEB_USERNAME);
    console.log(process.env.WEB_PASSWORD);

    await page.waitForSelector('#username', { visible: true });

    await page.type('#username', process.env.WEB_USERNAME, { delay: 100 });
    await page.type('input[type="password"]', process.env.WEB_PASSWORD, { delay: 100 });

    await Promise.all([page.click('button[type="submit"]'), page.waitForNavigation({ waitUntil: 'networkidle2' })]);

    console.log('Login berhasil');

    const cookies = await page.cookies();
    fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
    console.log('Cookie disimpan');
  }

  // TUNGGU TABLE MUNCUL
  // ===============================

  async function capture_png(link, selector, namepng) {
    await page.goto(link, { waitUntil: 'networkidle2' });

    // === FORCE LIGHT MODE SCRIPT ===
    await page.evaluate(() => {
      // 1. Hapus class 'dark' jika ada di html atau body
      document.documentElement.classList.remove('dark', 'dark-mode');
      document.body.classList.remove('dark', 'dark-mode');

      // 2. Jika website menggunakan LocalStorage untuk simpan tema
      localStorage.setItem('theme', 'light');
      localStorage.setItem('color-scheme', 'light');

      // Tambahan: Kadang butuh reload kecil atau trigger event jika UI tidak berubah
      window.dispatchEvent(new Event('storage'));
    });
    // ===============================

    await page.waitForSelector(selector, { timeout: 60000 });
    const tableElement = await page.$(selector);
    if (tableElement) {
      await tableElement.screenshot({ path: namepng });
      console.log(`${namepng} Table berhasil dicapture (Light Mode)`);
    }
  }

  await capture_png('https://sympony.tif3.net/capture-performance', 'body > div:nth-child(1)', 'ASR-ENT.png');
  await capture_png('https://sympony.tif3.net/capture-performance', 'body > div:nth-child(2)', 'ASR-WHF.png');
  await capture_png('https://sympony.tif3.net/bot-assurance/indihome', '#captureArea', 'alert-indihome.png');
  await capture_png('https://sympony.tif3.net/bot-assurance/indibiz', '#captureArea', 'alert-indibiz.png');
  await capture_png('https://sympony.tif3.net/bot-assurance/network', '#captureArea', 'alert-gamas-network.png');
  await capture_png('https://sympony.tif3.net/bot-assurance/access', '#captureArea', 'alert-gamas-acces.png');
  await browser.close();
})();
