require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  // Tentukan folder untuk menyimpan sesi (seperti profil Chrome asli)
  const USER_DATA_PATH = './user_session';

  const browser = await puppeteer.launch({
    headless: false, // Set ke true jika ingin jalan di background setelah stabil
    userDataDir: USER_DATA_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--start-maximized'],
    defaultViewport: null,
  });

  const page = await browser.newPage();

  // Set Viewport agar hasil screenshot tajam (High DPI)
  await page.setViewport({
    width: 1920,
    height: 768,
    deviceScaleFactor: 2,
  });

  // Fungsi Helper untuk Capture
  async function capture_png(link, selector, namepng) {
    try {
      console.log(`Mengakses: ${link}...`);
      await page.goto(link, { waitUntil: 'networkidle2', timeout: 60000 });

      // Cek apakah kita terlempar ke halaman signin
      if (page.url().includes('signin')) {
        console.log('Sesi habis, mencoba login otomatis...');
        await page.waitForSelector('#username', { visible: true });
        await page.type('#username', process.env.WEB_USERNAME, { delay: 50 });
        await page.type('input[type="password"]', process.env.WEB_PASSWORD, { delay: 50 });

        await Promise.all([page.click('button[type="submit"]'), page.waitForNavigation({ waitUntil: 'networkidle2' })]);

        // Setelah login, balik lagi ke link tujuan awal
        await page.goto(link, { waitUntil: 'networkidle2' });
      }

      // Force Light Mode via CSS Injection (Lebih stabil daripada localStorage manual)
      await page.evaluate(() => {
        const style = document.createElement('style');
        style.innerHTML = `
          * { transition: none !important; }
          .dark, .dark-mode, [data-theme='dark'] { 
            background-color: white !important; 
            color: black !important; 
          }
        `;
        document.head.appendChild(style);
        document.documentElement.classList.remove('dark', 'dark-mode');
        document.body.classList.remove('dark', 'dark-mode');
        localStorage.setItem('theme', 'light');
      });

      // Tunggu selector muncul
      await page.waitForSelector(selector, { timeout: 30000 });
      const element = await page.$(selector);

      if (element) {
        await element.screenshot({ path: namepng });
        console.log(`✅ Berhasil: ${namepng}`);
      } else {
        console.log(`❌ Gagal: Selector ${selector} tidak ditemukan.`);
      }
    } catch (error) {
      console.error(`⚠️ Error saat capture ${namepng}:`, error.message);
    }
  }

  // --- EKSEKUSI ---
  // 1. Pastikan buka home dulu untuk trigger session loading
  await page.goto('https://sympony.tif3.net', { waitUntil: 'networkidle2' });

  // 2. Daftar Capture
  const targets = [
    { url: 'https://sympony.tif3.net/capture-performance', sel: 'body > div:nth-child(1)', name: 'ASR-ENT.png' },
    { url: 'https://sympony.tif3.net/capture-performance', sel: 'body > div:nth-child(2)', name: 'ASR-WHF.png' },
    { url: 'https://sympony.tif3.net/bot-assurance/indihome', sel: '#captureArea', name: 'alert-indihome.png' },
    { url: 'https://sympony.tif3.net/bot-assurance/indibiz', sel: '#captureArea', name: 'alert-indibiz.png' },
    { url: 'https://sympony.tif3.net/bot-assurance/network', sel: '#captureArea', name: 'alert-gamas-network.png' },
    { url: 'https://sympony.tif3.net/bot-assurance/access', sel: '#captureArea', name: 'alert-gamas-acces.png' },
  ];

  for (const target of targets) {
    await capture_png(target.url, target.sel, target.name);
  }

  console.log('Semua tugas selesai!');
  await browser.close();
})();
