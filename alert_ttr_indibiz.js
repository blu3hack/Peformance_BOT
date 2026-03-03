const db = require('./connection');

async function getPerformanceReport() {
  const query = `
  WITH alert_indibiz AS (
    SELECT
      service_area, sto, region_urut, region_tsel, branch, saldo, inet, voice, iptv, wr4, ex4, wr24, ex24, hsi, hsi_gaul
    FROM
    (
      SELECT
        a.service_area,
        a.sto,
        a.branch,
        CASE
          WHEN a.region_tsel = 'JAWA TENGAH' THEN 1
          WHEN a.region_tsel = 'JAWA TIMUR' THEN 2
          WHEN a.region_tsel = 'BALNUS' THEN 3
          ELSE 99
        END AS region_urut,
        a.region_tsel,
        -- Menggunakan CONVERT agar character set cocok sebelum collation diterapkan
        COUNT(DISTINCT CASE WHEN CONVERT(b.TRUE_JENIS USING utf8mb4) COLLATE utf8mb4_unicode_ci IN ('INDIBIZ', 'INDIHOME') THEN b.incident END) AS saldo,
        COUNT(DISTINCT CASE WHEN CONVERT(b.SERVICE_TYPE USING utf8mb4) COLLATE utf8mb4_unicode_ci = 'INTERNET' THEN b.incident END) AS inet,
        COUNT(DISTINCT CASE WHEN CONVERT(b.SERVICE_TYPE USING utf8mb4) COLLATE utf8mb4_unicode_ci = 'VOICE' THEN b.incident END) AS voice,
        COUNT(DISTINCT CASE WHEN CONVERT(b.SERVICE_TYPE USING utf8mb4) COLLATE utf8mb4_unicode_ci = 'IPTV' THEN b.incident END) AS iptv,
        COUNT(DISTINCT CASE WHEN CONVERT(b.TRUE_JENIS USING utf8mb4) COLLATE utf8mb4_unicode_ci IN ('INDIBIZ', 'INDIHOME') AND b.jam >= 3 AND b.jam < 4 THEN b.incident END) AS wr4,
        COUNT(DISTINCT CASE WHEN CONVERT(b.TRUE_JENIS USING utf8mb4) COLLATE utf8mb4_unicode_ci IN ('INDIBIZ', 'INDIHOME') AND b.jam >= 4 THEN b.incident END) AS ex4,
        COUNT(DISTINCT CASE WHEN CONVERT(b.TRUE_JENIS USING utf8mb4) COLLATE utf8mb4_unicode_ci IN ('INDIBIZ', 'INDIHOME') AND b.jam >= 20 AND b.jam < 24 THEN b.incident END) AS wr24,
        COUNT(DISTINCT CASE WHEN CONVERT(b.TRUE_JENIS USING utf8mb4) COLLATE utf8mb4_unicode_ci IN ('INDIBIZ', 'INDIHOME') AND b.jam >= 24 THEN b.incident END) AS ex24,
        COUNT(DISTINCT CASE WHEN CONVERT(b.TRUE_JENIS USING utf8mb4) COLLATE utf8mb4_unicode_ci IN ('INDIBIZ', 'INDIHOME') AND nondatin.workzone IS NOT NULL THEN b.incident END) AS hsi,
        COUNT(DISTINCT CASE WHEN CONVERT(b.TRUE_JENIS USING utf8mb4) COLLATE utf8mb4_unicode_ci IN ('INDIBIZ', 'INDIHOME') AND nondatin_gaul.workzone IS NOT NULL THEN b.incident END) AS hsi_gaul
      FROM
        (SELECT *, regional AS region_tsel FROM metabase.new_mapping) a
        LEFT JOIN egbis_tif.view_egbis_nondatin_tif3 b ON a.sto = b.workzone
        LEFT JOIN egbis_tif.view_egbis_proactive_nondatin_tif3 nondatin ON a.sto = nondatin.workzone
        LEFT JOIN egbis_tif.egbis_procative_nondatin_gaul nondatin_gaul ON a.sto = nondatin_gaul.workzone
      GROUP BY 1, 2, 3, 4, 5
    ) s
  )

  -- Query utama tetap sama
  SELECT
    region_tsel, branch,
    SUM(saldo) as saldo, SUM(inet) as inet, SUM(voice) as voice, SUM(iptv) as iptv,
    SUM(wr4) as wr4, SUM(ex4) as ex4, SUM(wr24) as wr24, SUM(ex24) as ex24, SUM(hsi) as hsi, SUM(hsi_gaul) as hsi_gaul
  FROM alert_indibiz
  GROUP BY region_tsel, branch
  UNION ALL
  SELECT
    region_tsel, 'total' as branch,
    SUM(saldo) as saldo, SUM(inet) as inet, SUM(voice) as voice, SUM(iptv) as iptv,
    SUM(wr4) as wr4, SUM(ex4) as ex4, SUM(wr24) as wr24, SUM(ex24) as ex24, SUM(hsi) as hsi, SUM(hsi_gaul) as hsi_gaul
  FROM alert_indibiz
  GROUP BY region_tsel
  ORDER BY region_tsel, CASE WHEN branch = 'total' THEN 2 ELSE 1 END
`;

  return new Promise((resolve, reject) => {
    db.query(query, (error, results) => {
      if (error) return reject(error);

      if (!results || results.length === 0) {
        return resolve({ detail: [], summaryText: 'Data tidak ditemukan' });
      }

      // 1. Ambil data total per region
      const regionTotals = results.filter((item) => item.branch === 'total');
      // 2. Ambil data per branch
      const branchDetails = results.filter((item) => item.branch !== 'total');

      const getShortName = (name) => (name ? name.substring(0, 3).toUpperCase() : 'N/A');

      // --- LOGIKA MENCARI TOP INET ---
      // Urutkan region berdasarkan inet terbanyak
      const sortedRegionsInet = [...regionTotals].sort((a, b) => (b.inet || 0) - (a.inet || 0));
      const sortedRegionsVoice = [...regionTotals].sort((a, b) => (b.voice || 0) - (a.voice || 0));
      const sortedRegionsIPTV = [...regionTotals].sort((a, b) => (b.iptv || 0) - (a.iptv || 0));
      const sortedRegionsWR4 = [...regionTotals].sort((a, b) => (b.wr4 || 0) - (a.wr4 || 0));
      const sortedRegionsEX4 = [...regionTotals].sort((a, b) => (b.ex4 || 0) - (a.ex4 || 0));
      const sortedRegionsWR24 = [...regionTotals].sort((a, b) => (b.wr24 || 0) - (a.wr24 || 0));
      const sortedRegionsEX24 = [...regionTotals].sort((a, b) => (b.ex24 || 0) - (a.ex24 || 0));
      const sortedRegionsSQMHSI = [...regionTotals].sort((a, b) => (b.hsi || 0) - (a.hsi || 0));
      const sortedRegionsSQMHSIGAUL = [...regionTotals].sort((a, b) => (b.hsi_gaul || 0) - (a.hsi_gaul || 0));
      const topInetRegion = sortedRegionsInet[0];
      const topVoiceRegion = sortedRegionsVoice[0];
      const topIPTVRegion = sortedRegionsIPTV[0];
      const topWR4Region = sortedRegionsWR4[0];
      const topEX4Region = sortedRegionsEX4[0];
      const topWR24Region = sortedRegionsWR24[0];
      const topEX24Region = sortedRegionsEX24[0];
      const topSQMHSIRegion = sortedRegionsSQMHSI[0];
      const topSQMHSIGAULRegion = sortedRegionsSQMHSIGAUL[0];

      // Cari branch di dalam region tersebut yang inet-nya paling banyak
      const topBraInet = branchDetails.filter((b) => b.region_tsel === topInetRegion.region_tsel).sort((a, b) => (b.inet || 0) - (a.inet || 0))[0];
      const topBraVoice = branchDetails.filter((b) => b.region_tsel === topVoiceRegion.region_tsel).sort((a, b) => (b.voice || 0) - (a.voice || 0))[0];
      const topBraIPTV = branchDetails.filter((b) => b.region_tsel === topIPTVRegion.region_tsel).sort((a, b) => (b.iptv || 0) - (a.iptv || 0))[0];
      const topBraWR4 = branchDetails.filter((b) => b.region_tsel === topWR4Region.region_tsel).sort((a, b) => (b.wr4 || 0) - (a.wr4 || 0))[0];
      const topBraEX4 = branchDetails.filter((b) => b.region_tsel === topEX4Region.region_tsel).sort((a, b) => (b.ex4 || 0) - (a.ex4 || 0))[0];
      const topBraWR24 = branchDetails.filter((b) => b.region_tsel === topWR24Region.region_tsel).sort((a, b) => (b.wr24 || 0) - (a.wr24 || 0))[0];
      const topBraEX24 = branchDetails.filter((b) => b.region_tsel === topEX24Region.region_tsel).sort((a, b) => (b.ex24 || 0) - (a.ex24 || 0))[0];
      const topBraSQMHSI = branchDetails.filter((b) => b.region_tsel === topSQMHSIRegion.region_tsel).sort((a, b) => (b.hsi || 0) - (a.hsi || 0))[0];
      const topBraSQMHSIGAUL = branchDetails.filter((b) => b.region_tsel === topSQMHSIGAULRegion.region_tsel).sort((a, b) => (b.hsi_gaul || 0) - (a.hsi_gaul || 0))[0];

      // --- FORMAT SUMMARY ---
      const summaryString = `<b>SALDO TIKET</b>
Inet - ${topInetRegion.region_tsel} (${topInetRegion.inet}) -> Dis ${getShortName(topBraInet?.branch)} (${topBraInet?.inet || 0})
Voice - ${topVoiceRegion.region_tsel} (${topVoiceRegion.voice}) -> Dis ${getShortName(topBraVoice?.branch)} (${topBraVoice?.voice || 0})
IPTV - ${topIPTVRegion.region_tsel} (${topIPTVRegion.iptv}) -> Dis ${getShortName(topBraIPTV?.branch)} (${topBraIPTV?.iptv || 0})

<b>TTR INDIBIZ</b>
Warn 4 - ${topWR4Region.region_tsel} (${topWR4Region.wr4}) -> Dis ${getShortName(topBraWR4?.branch)} (${topBraWR4?.wr4 || 0})
Expi 4 - ${topEX4Region.region_tsel} (${topEX4Region.ex4}) -> Dis ${getShortName(topBraEX4?.branch)} (${topBraEX4?.ex4 || 0})
Warn 24 - ${topWR24Region.region_tsel} (${topWR24Region.wr24}) -> Dis ${getShortName(topBraWR24?.branch)} (${topBraWR24?.wr24 || 0})
Expi 24 - ${topEX24Region.region_tsel} (${topEX24Region.ex24}) -> Dis ${getShortName(topBraEX24?.branch)} (${topBraEX24?.ex24 || 0})

<b>SQM</b>
HSI - ${topSQMHSIRegion.region_tsel} (${topSQMHSIRegion.hsi}) -> Dis ${getShortName(topBraSQMHSI?.branch)} (${topBraSQMHSI?.hsi || 0})
HSI - ${topSQMHSIGAULRegion.region_tsel} (${topSQMHSIGAULRegion.hsi_gaul}) -> Dis ${getShortName(topBraSQMHSIGAUL?.branch)} (${topBraSQMHSIGAUL?.hsi_gaul || 0})

`;

      resolve({
        detail: results,
        summaryText: summaryString,
      });
    });
  });
}

module.exports = { getPerformanceReport };
