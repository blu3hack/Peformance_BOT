const mysql = require('mysql2/promise');
const db = require('./connection'); // Pastikan path file benar

const today = new Date().toISOString().split('T')[0];
console.log(today); // Hasil: 2026-02-27

async function getPerformanceReport() {
  const query = `
    SELECT
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
      LEFT JOIN perf_tif.ttr_indibiz AS tbiz ON tbiz.jenis = rsb.area AND tbiz.treg = rsb.lokasi AND tbiz.tgl = '${today}'
  `;

  try {
    // KUNCI PERBAIKAN: Tambahkan .promise() di sini
    const [rows] = await db.promise().execute(query);
    return rows;
  } catch (error) {
    console.error('Database Error:', error.message);
    throw error;
  }
}

async function asr_ent() {
  getPerformanceReport()
    .then((results) => {
      if (!results || results.length === 0) return console.log('Data tidak ditemukan.');

      results.forEach((row) => {
        const metrics = [row.ach_k1, row.ach_k2, row.ach_k3, row.ach_twifi, row.ach_tbiz4, row.ach_tbiz24];

        const validMetrics = metrics.filter((v) => v !== null && v !== undefined);
        const avg = validMetrics.length > 0 ? validMetrics.reduce((a, b) => a + Number(b), 0) / validMetrics.length : 0;

        const status = avg >= 100 ? '✅ GOOD' : '🚨 ALERT';
        const isRegional = ['BALNUS', 'JATIM', 'JATENG'].includes(row.lokasi);
        const label = isRegional ? `\n<===== Reg: ${row.lokasi} ======>` : `Branch: ${row.lokasi}`;

        console.log(label);
        console.log(`AVG Ach: ${avg.toFixed(2)}% | Status: ${status}`);
        console.log(`Insight: K2(${row.ach_k2 ?? 0}%), WiFi(${row.ach_twifi ?? 0}%), Biz4H(${row.ach_tbiz4 ?? 0}%)\n`);
      });
    })
    .catch((err) => console.error('Final Error:', err));
}

async function asr_whf() {
  getPerformanceReport()
    .then((results) => {
      if (!results || results.length === 0) return console.log('Data tidak ditemukan.');

      results.forEach((row) => {
        const metrics = [row.ach_t3, row.ach_t6, row.ach_t36, row.ach_tmanja];
        const validMetrics = metrics.filter((v) => v !== null && v !== undefined);
        const avg = validMetrics.length > 0 ? validMetrics.reduce((a, b) => a + Number(b), 0) / validMetrics.length : 0;

        const status = avg >= 100 ? '✅ GOOD' : '🚨 ALERT';
        const isRegional = ['BALNUS', 'JATIM', 'JATENG'].includes(row.lokasi);
        const label = isRegional ? `\n<===== Reg: ${row.lokasi} ======>` : `Branch: ${row.lokasi}`;

        console.log(label);
        console.log(`AVG Ach: ${avg.toFixed(2)}% | Status: ${status}`);
        console.log(`Insight: TTR3(${row.ach_t3 ?? 0}%), TTR6(${row.ach_t6 ?? 0}%), TTR36(${row.ach_t36 ?? 0}%), TTRMANJA(${row.ach_tmanja ?? 0}%)\n`);
      });
    })
    .catch((err) => console.error('Final Error:', err));
}
asr_ent();
asr_whf();
