const mysql = require('mysql2/promise');

async function getPerformanceReport() {
  const connection = await mysql.createConnection({
    host: '10.110.13.43',
    user: 'cxmention',
    password: 'tr5ju4r4#',
    database: 'perf_tif',
  });

  const query = `
    SELECT
      rsb.lok AS lokasi,
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
      LEFT JOIN perf_tif.ttr_datin ttd ON ttd.jenis = rsb.area AND ttd.treg = rsb.lokasi AND ttd.tgl = '2026-02-26'
      LEFT JOIN perf_tif.ttr_wifi ttw ON ttw.jenis = rsb.area AND ttw.regional = rsb.lokasi AND ttw.tgl = '2026-02-26'
      LEFT JOIN perf_tif.wsa_ttr3 AS wt3 ON wt3.lokasi = rsb.area AND wt3.witel = rsb.lokasi AND wt3.tgl = '2026-02-26'
      LEFT JOIN perf_tif.wsa_ttr6 AS wt6 ON wt6.lokasi = rsb.area AND wt6.witel = rsb.lokasi AND wt6.tgl = '2026-02-26'
      LEFT JOIN perf_tif.wsa_ttr36 AS wt36 ON wt36.lokasi = rsb.area AND wt36.witel = rsb.lokasi AND wt36.tgl = '2026-02-26'
      LEFT JOIN perf_tif.wsa_ttrmanja AS wtmanja ON wtmanja.lokasi = rsb.area AND wtmanja.witel = rsb.lokasi AND wtmanja.tgl = '2026-02-26'
      LEFT JOIN perf_tif.ttr_indibiz AS tbiz ON tbiz.jenis = rsb.area AND tbiz.treg = rsb.lokasi AND tbiz.tgl = '2026-02-26'
  `;

  try {
    const [rows] = await connection.execute(query);
    await connection.end();
    return rows;
  } catch (error) {
    console.error('Error executing query:', error);
  }
}

// Memanggil fungsi dan mencetak summary
getPerformanceReport().then((results) => {
  console.log('--- DATA MENTAH HASIL QUERY ---');
  console.table(results); // Mencetak dalam bentuk tabel yang rapi di console

  console.log('\n--- SUMMARY PERFORMANSI (26 FEB 2026) ---');
  if (!results || results.length === 0) {
    console.log('Data tidak ditemukan.');
    return;
  }

  results.forEach((row) => {
    // 1. Definisikan metrik (pastikan nama kolom sesuai dengan query SQL Anda)
    const metrics = [row.ach_k2, row.ach_k3, row.ach_twifi, row.ach_tbiz4, row.ach_tbiz24];
    const validMetrics = metrics.filter((val) => val !== null && val !== undefined);

    // 2. Hitung rata-rata
    let avg = 0;
    if (validMetrics.length > 0) {
      const total = validMetrics.reduce((a, b) => Number(a) + Number(b), 0);
      avg = total / validMetrics.length;
    }

    // 3. Tentukan Status & Kategori (Perbaikan Logika di sini)
    const status = avg >= 100 ? '✅ EXCELLENT' : avg >= 90 ? '🟡 GOOD' : '🚨 Alert';

    // Menggunakan ternary untuk menentukan kategori Reg vs Branch
    const regionalList = ['BALNUS', 'JATIM', 'JATENG'];
    const kat = regionalList.includes(row.lokasi) ? 'Reg' : 'Branch';

    // 4. Cetak Output
    if (regionalList.includes(row.lokasi)) {
      console.log(`<===== ${kat}: ${row.lokasi} ======>`);
    } else {
      console.log(`${kat}: ${row.lokasi}`);
    }

    console.log(`AVG Ach: ${avg.toFixed(2)}% | Status: ${status}`);
    console.log(`Insight: TTRC K2(3.6H) (${row.ach_k2 ?? 0}%), TTRC WiFi (${row.ach_twifi ?? 0}%), TTR Indibiz HVC (4H) (${row.ach_tbiz4 ?? 0}%), TTR Indibiz REG (24H) (${row.ach_tbiz24 ?? 0}%) \n`);
  });
});
