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
    bot.sendMessage(msg.chat.id, '⏳ Sedang mengambil screenshot, mohon tunggu...');
    // Menjalankan 'node capture.js'
    const prosesCapture = spawn('node', ['capture.js']);
    prosesCapture.stdout.on('data', (data) => {
      console.log(`Stdout: ${data}`);
    });
    prosesCapture.stderr.on('data', (data) => {
      console.error(`Stderr: ${data}`);
    });
    prosesCapture.on('close', (code) => {
      if (code === 0) {
        bot.sendMessage(msg.chat.id, '✅ Screenshot selesai diambil. Silakan ketik <b>send</b> untuk mengirim laporan.', { parse_mode: 'HTML' });
      } else {
        bot.sendMessage(msg.chat.id, `❌ Terjadi kesalahan saat menjalankan capture.js (Exit Code: ${code})`);
      }
    });
  }

  if (text === 'send') {
    // 1. Ambil semua data (id, nama) dari database
    db.query('SELECT telegram_id, first_name, last_name FROM users_bot', async (err, results) => {
      if (err) {
        console.error('Gagal mengambil data dari DB:', err);
        return bot.sendMessage(msg.chat.id, 'Gagal mengakses database.');
      }

      const d = new Date();
      const formatIndo = new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'long',
        timeStyle: 'medium',
      }).format(d);

      // 2. Fungsi Kirim Gambar
      async function send_capture(filename, title) {
        if (!fs.existsSync(filename)) return;

        // Loop melalui setiap user hasil query database
        for (const user of results) {
          try {
            // Gunakan data nama dari tiap user di database
            const namaPenerima = `${user.first_name || ''} ${user.last_name || ''}`.trim();

            await bot.sendPhoto(user.telegram_id, fs.createReadStream(filename), {
              caption: `Mohon Izin <b>Bapak/Ibu: ${namaPenerima}</b>\nReport ${title} \nPosisi : ${formatIndo} .`,
              parse_mode: 'HTML',
            });
            console.log(`Berhasil kirim ke ${user.telegram_id} (${namaPenerima})`);
          } catch (err) {
            console.log(`Gagal kirim ke ${user.telegram_id}:`, err.message);
          }
        }
      }

      // 3. Eksekusi Pengiriman
      await send_capture('alert-gamas-acces.png', 'Alert Gamas Access');
      await send_capture('alert-gamas-network.png', 'Alert Gamas Network');
      await send_capture('alert-indibiz.png', 'Alert TTR Indibiz');
      await send_capture('alert-indihome.png', 'Alert TTR Indihome');

      bot.sendMessage(msg.chat.id, '✅ Laporan telah dikirim ke semua user di database.');
    });
  }

  if (text === 'send_perf') {
    // 1. Ambil data user dan data performansi secara paralel agar cepat
    db.query('SELECT telegram_id, first_name, last_name FROM users_bot', async (err, userResults) => {
      if (err) return bot.sendMessage(msg.chat.id, 'Gagal mengakses database.');

      try {
        // Ambil data performansi SEKALI saja untuk semua user
        const perfData = await getPerformanceReport();
        const report_asr_ent = report_ASR_ENT(perfData); // Format data jadi teks laporan
        const report_asr_whf = report_ASR_WHF(perfData); // Format data jadi teks laporan

        const d = new Date();
        const formatIndo = new Intl.DateTimeFormat('id-ID', {
          dateStyle: 'long',
          timeStyle: 'medium',
        }).format(d);

        // 2. Fungsi Kirim Gambar (Hanya loop pengiriman, bukan loop query)
        async function send_capture(filename, title, fix_caption) {
          if (!fs.existsSync(filename)) return;

          for (const user of userResults) {
            try {
              const namaPenerima = `${user.first_name || ''} ${user.last_name || ''}`.trim();

              // Header singkat untuk caption foto
              const captionSingkat = `Mohon Izin Bapak/Ibu <b>${namaPenerima}</b>\nLaporan: <b>${title}</b>\n📅 ${formatIndo}`;

              // 1. Kirim Foto
              await bot.sendPhoto(user.telegram_id, fs.createReadStream(filename), {
                caption: captionSingkat,
                parse_mode: 'HTML',
              });

              // 2. Kirim Detail Performansi (Teks Terpisah)
              // Kita kirim ini HANYA SEKALI setelah foto pertama atau sesuai kebutuhan
              await bot.sendMessage(user.telegram_id, fix_caption, {
                parse_mode: 'HTML',
              });

              console.log(`✅ Berhasil kirim ke ${namaPenerima}`);
            } catch (err) {
              console.log(`❌ Gagal kirim ke ${user.telegram_id}:`, err.message);
            }
          }
        }

        // 3. Eksekusi Pengiriman
        await send_capture('ASR-ENT.png', 'REPORT ASR-ENT', report_asr_ent);
        await send_capture('ASR-WHF.png', 'REPORT ASR-WHF', report_asr_whf);
        // ... dst

        bot.sendMessage(msg.chat.id, '✅ Laporan telah dikirim ke semua user.');
      } catch (error) {
        console.error('Error:', error);
        bot.sendMessage(msg.chat.id, 'Terjadi kesalahan saat memproses laporan.');
      }
    });
  }

  // --- FUNGSI HELPER (Letakkan di luar handler agar rapi) ---
  async function getPerformanceReport() {
    const today = new Date().toISOString().split('T')[0];
    const query = `SELECT
      rsb.lok AS lokasi,
      rsb.area,
      100 AS ach_k1,
      ROUND(ttd.k2 / NULLIF((SELECT feb FROM perf_tif.wisa_indikator WHERE indikator = 'ASR-ENT-TTR Compliance K2 dan K1 Repair DATIN 3.6 Jam'), 0) * 100, 2) AS ach_k2,
      ROUND(ttd.k3 / NULLIF((SELECT feb FROM perf_tif.wisa_indikator WHERE indikator = 'ASR-ENT-TTR Compliance K3 DATIN 7.2 Jam'), 0) * 100, 2) AS ach_k3,
      ROUND(ttw.comply / NULLIF((SELECT feb FROM perf_tif.wisa_indikator WHERE indikator = 'ASR-ENT-TTR Compliance WiFi'), 0) * 100, 2) AS ach_twifi,
      ROUND(wt3.m02 / NULLIF((SELECT feb FROM perf_tif.wisa_indikator WHERE indikator = 'ASR-WHF-TTR Comply 3H (D.V)'), 0) * 100, 2) AS ach_t3,
      ROUND(wt6.m02 / NULLIF((SELECT feb FROM perf_tif.wisa_indikator WHERE indikator = 'ASR-WHF-TTR Comply 6H (P)'), 0) * 100, 2) AS ach_t6,
      ROUND(wt36.m02 / NULLIF((SELECT feb FROM perf_tif.wisa_indikator WHERE indikator = 'ASR-WHF-TTR Comply 36H (Non HVC)'), 0) * 100, 2) AS ach_t36,
      ROUND(wtmanja.m02 / NULLIF((SELECT feb FROM perf_tif.wisa_indikator WHERE indikator = 'ASR-WHF-TTR Comply 3H Manja'), 0) * 100, 2) AS ach_tmanja,
      ROUND(tbiz.real_1 / NULLIF((SELECT feb FROM perf_tif.wisa_indikator WHERE indikator = 'ASR-ENT-Compliance-Time to Recover IndiBiz-4 jam'), 0) * 100, 2) AS ach_tbiz4,
      ROUND(tbiz.real_2 / NULLIF((SELECT feb FROM perf_tif.wisa_indikator WHERE indikator = 'ASR-ENT-Compliance-Time to Recover IndiBiz-24 jam'), 0) * 100, 2) AS ach_tbiz24
    FROM
      perf_tif.region_sub_branch rsb
      LEFT JOIN perf_tif.ttr_datin ttd ON ttd.jenis = rsb.area AND ttd.treg = rsb.lokasi AND ttd.tgl = '${today}'
      LEFT JOIN perf_tif.ttr_wifi ttw ON ttw.jenis = rsb.area AND ttw.regional = rsb.lokasi AND ttw.tgl = '${today}'
      LEFT JOIN perf_tif.wsa_ttr3 AS wt3 ON wt3.lokasi = rsb.area AND wt3.witel = rsb.lokasi AND wt3.tgl = '${today}'
      LEFT JOIN perf_tif.wsa_ttr6 AS wt6 ON wt6.lokasi = rsb.area AND wt6.witel = rsb.lokasi AND wt6.tgl = '${today}'
      LEFT JOIN perf_tif.wsa_ttr36 AS wt36 ON wt36.lokasi = rsb.area AND wt36.witel = rsb.lokasi AND wt36.tgl = '${today}'
      LEFT JOIN perf_tif.wsa_ttrmanja AS wtmanja ON wtmanja.lokasi = rsb.area AND wtmanja.witel = rsb.lokasi AND wtmanja.tgl = '${today}'
      LEFT JOIN perf_tif.ttr_indibiz AS tbiz ON tbiz.jenis = rsb.area AND tbiz.treg = rsb.lokasi AND tbiz.tgl = '${today}'`;
    const [rows] = await db.promise().execute(query);
    return rows;
  }

  function report_ASR_ENT(results) {
    if (!results || results.length === 0) return 'Data tidak ditemukan.';

    let textReport = '<b>SUMMARY PERFORMANSI:</b>\n';

    results.forEach((row) => {
      const metrics = [row.ach_k1, row.ach_k2, row.ach_k3, row.ach_twifi, row.ach_tbiz4, row.ach_tbiz24];
      const validMetrics = metrics.filter((v) => v !== null && v !== undefined);
      const avg = validMetrics.length > 0 ? validMetrics.reduce((a, b) => a + Number(b), 0) / validMetrics.length : 0;

      const status = avg >= 100 ? '✅ GOOD' : '🚨 ALERT';
      const isRegional = ['BALNUS', 'JATIM', 'JATENG'].includes(row.lokasi);

      if (isRegional) {
        textReport += `\n<b>[ ${row.lokasi} ]</b>\n`;
      } else {
        textReport += `• ${row.lokasi}: `;
      }

      textReport += `AVG Ach: ${avg.toFixed(2)}% | Status: ${status}\nInsight: TTRK2(${row.ach_k2 ?? 0}%), TTRWiFi(${row.ach_twifi ?? 0}%), TTRBiz4H(${row.ach_tbiz4 ?? 0}, TTRBiz24H(${row.ach_tbiz24 ?? 0}%)\n`;
    });

    return textReport;
  }

  function report_ASR_WHF(results) {
    if (!results || results.length === 0) return 'Data tidak ditemukan.';

    let textReport = '<b>SUMMARY PERFORMANSI:</b>\n';

    results.forEach((row) => {
      const metrics = [row.ach_t3, row.ach_t6, row.ach_t36, row.ach_tmanja];
      const validMetrics = metrics.filter((v) => v !== null && v !== undefined);
      const avg = validMetrics.length > 0 ? validMetrics.reduce((a, b) => a + Number(b), 0) / validMetrics.length : 0;

      const status = avg >= 100 ? '✅ GOOD' : '🚨 ALERT';
      const isRegional = ['BALNUS', 'JATIM', 'JATENG'].includes(row.lokasi);

      if (isRegional) {
        textReport += `\n<b>[ ${row.lokasi} ]</b>\n`;
      } else {
        textReport += `• ${row.lokasi}: `;
      }

      textReport += `AVG Ach: ${avg.toFixed(2)}% | Status: ${status}\nInsight: TTR3(${row.ach_t3 ?? 0}%), TTR6(${row.ach_t6 ?? 0}%), TTR36(${row.ach_t36 ?? 0}%), TTRMANJA(${row.ach_tmanja ?? 0}%)\n`;
    });

    return textReport;
  }
  console.log(`Pesan masuk dari ${username}: ${text}`);
});
