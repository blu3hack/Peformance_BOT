const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    headless: true, // ubah ke false kalau mau lihat browsernya
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  const COOKIE_PATH = './cookies.json';

  // ===============================
  // CEK APAKAH SUDAH ADA COOKIE
  // ===============================
  if (fs.existsSync(COOKIE_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH));
    await page.setCookie(...cookies);
    console.log('Cookie loaded');
  }

  // ===============================
  // BUKA HALAMAN LOGIN
  // ===============================
  await page.goto('https://example.com/login', {
    waitUntil: 'networkidle2',
  });

  // ===============================
  // JIKA BELUM LOGIN
  // ===============================
  if (page.url().includes('login')) {
    await page.type('#username', 'USERNAME_KAMU');
    await page.type('#password', 'PASSWORD_KAMU');

    await Promise.all([page.click('#btnLogin'), page.waitForNavigation({ waitUntil: 'networkidle2' })]);

    console.log('Login berhasil');

    // Simpan cookie supaya tidak login ulang
    const cookies = await page.cookies();
    fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
    console.log('Cookie disimpan');
  }

  // ===============================
  // MASUK KE HALAMAN TABLE
  // ===============================
  await page.goto('https://example.com/dashboard/report', {
    waitUntil: 'networkidle2',
  });

  // Tunggu table muncul
  await page.waitForSelector('#tableReport');

  // ===============================
  // CAPTURE TABLE SAJA
  // ===============================
  const tableElement = await page.$('#tableReport');

  await tableElement.screenshot({
    path: 'table_capture.png',
  });

  console.log('Table berhasil dicapture');

  await browser.close();
})();
