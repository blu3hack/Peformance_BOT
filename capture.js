require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const USER_DATA_PATH = './user_session';

  const browser = await puppeteer.launch({
    headless: false, // Ubah ke true jika sudah lancar
    userDataDir: USER_DATA_PATH,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--start-maximized',
      '--disable-features=IsolateOrigins,site-per-process', // Menjaga konsistensi sesi
    ],
    defaultViewport: null,
  });

  const page = await browser.newPage();

  // Samarkan User Agent agar tidak mudah kena logout oleh Cloudflare/WAF
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 2,
  });

  async function capture_png(link, selector, namepng) {
    try {
      console.log(`\n🔍 Mengakses: ${link}...`);

      // Gunakan 'load' alih-alih 'networkidle2' untuk stabilitas awal
      await page.goto(link, { waitUntil: 'load', timeout: 90000 });

      // Cek apakah ada input username (tanda sesi habis/halaman login)
      const needsLogin = await page.$('#username');

      if (needsLogin) {
        console.log('⚠️ Sesi tidak ditemukan atau habis. Mencoba login otomatis...');
        await page.waitForSelector('#username', { visible: true });

        // Gunakan delay pengetikan agar menyerupai manusia
        await page.type('#username', process.env.WEB_USERNAME, { delay: 100 });
        await page.type('input[type="password"]', process.env.WEB_PASSWORD, { delay: 100 });

        await Promise.all([page.click('button[type="submit"]'), page.waitForNavigation({ waitUntil: 'networkidle2' })]);

        console.log('✅ Login berhasil, kembali ke target...');
        await page.goto(link, { waitUntil: 'networkidle2' });
      }

      // Injeksi CSS untuk Force Light Mode & Hapus Transmisi
      await page.evaluate(() => {
        const style = document.createElement('style');
        style.innerHTML = `
                    * { transition: none !important; animation: none !important; }
                    .dark, .dark-mode, [data-theme='dark'] { 
                        background-color: white !important; 
                        color: black !important; 
                    }
                    /* Pastikan background body putih jika aplikasi pakai class dark */
                    body.dark, body.dark-mode { background: white !important; color: black !important; }
                `;
        document.head.appendChild(style);
        localStorage.setItem('theme', 'light');
      });

      // Tunggu sebentar agar chart/grafik render sempurna
      await new Promise((r) => setTimeout(r, 3000));

      await page.waitForSelector(selector, { timeout: 30000 });
      const element = await page.$(selector);

      if (element) {
        await element.screenshot({ path: namepng });
        console.log(`📸 Screenshot tersimpan: ${namepng}`);
      } else {
        console.log(`❌ Gagal: Selector ${selector} tidak ditemukan.`);
      }
    } catch (error) {
      console.error(`⚠️ Error saat capture ${namepng}:`, error.message);
    }
  }

  // --- EKSEKUSI ---
  try {
    // Daftar target capture
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
  } finally {
    console.log('\n🌟 Semua tugas selesai!');
    await browser.close();
  }
})();
