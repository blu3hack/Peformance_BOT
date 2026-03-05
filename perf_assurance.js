const db = require('./connection');

async function getPerformanceReport() {
  const today = new Date().toISOString().split('T')[0];
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

  // Bungkus dengan Promise secara manual
  return new Promise((resolve, reject) => {
    db.query(query, (error, results) => {
      if (error) {
        console.error('Gagal mengambil data:', error);
        return reject(error);
      }
      resolve(results);
    });
  });
}

// Cara melihat hasilnya
async function generateCaption() {
  try {
    const data = await getPerformanceReport();

    const now = new Date();
    const opsiTanggal = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const tanggalHariIni = now.toLocaleDateString('id-ID', opsiTanggal);
    const jamUpdate = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    let message = `<b>Report Perf Assurance</b>\n`;
    message += `<b>${tanggalHariIni} | ${jamUpdate} WIB</b>\n`;
    message += `──────────────────────────\n\n`;

    const groupedData = {};
    data.forEach((item) => {
      const area = item.area ? item.area.toUpperCase() : 'UNKNOWN';
      if (!groupedData[area]) groupedData[area] = [];
      groupedData[area].push(item);
    });

    const metrics = ['ach_k1', 'ach_k2', 'ach_k3', 'ach_twifi', 'ach_t3', 'ach_t6', 'ach_t36', 'ach_tmanja', 'ach_tbiz4', 'ach_tbiz24'];

    const getRank = (score) => {
      if (score === 10) return 'PLATINUM';
      if (score >= 7) return 'GOLD';
      if (score >= 4) return 'SILVER';
      return 'BRONZE';
    };

    const sortedAreas = Object.keys(groupedData).sort();

    for (const area of sortedAreas) {
      let areaDetails = '';
      let totalScoreArea = 0;
      const jumlahWitel = groupedData[area].length;

      groupedData[area].forEach((item) => {
        let countAman = 0;
        let kpiIssue = [];

        metrics.forEach((m) => {
          const val = parseFloat(item[m]) || 0;
          if (val >= 100 || val === 0) {
            countAman++;
          } else {
            kpiIssue.push(`${m.replace('ach_', '')}: ${val}%`);
          }
        });

        totalScoreArea += countAman;
        const witelRank = getRank(countAman);

        // Perbaikan: Gunakan tag <b> yang tertutup rapi
        areaDetails += `<b>${item.lokasi} ${witelRank} (${countAman}/10)</b>\n`;
        if (kpiIssue.length > 0) {
          areaDetails += `<i>Issue: ${kpiIssue.join(', ')}</i>\n`; // Gunakan miring untuk issue
        }
      });

      const avgScoreArea = Math.round(totalScoreArea / jumlahWitel);
      const areaRank = getRank(avgScoreArea);

      // --- PERBAIKAN DI SINI ---
      // Menghapus <br>, menghapus **, dan memastikan tag tertutup
      message += `<b>==== ${area} ====</b>\n`;
      message += areaDetails + '\n';
    }

    return message;
  } catch (err) {
    console.error('Gagal menyusun laporan:', err);
    return 'Gagal memuat laporan.';
  }
}

// generateCaption();

// Export fungsi agar bisa dipakai di file lain
module.exports = { generateCaption };
