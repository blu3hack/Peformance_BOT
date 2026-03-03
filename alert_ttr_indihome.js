const db = require('./connection');

async function getPerformanceReport() {
  const cutoff = `SELECT waktu_update FROM metabase.waktu_update_all WHERE penamaan = 'nossa' LIMIT 1`;
  const query = `
    WITH kpi_data AS (
      SELECT
        CASE
          WHEN b.region_tsel = 'BALI NUSRA' THEN 'BALNUS'
          WHEN b.region_tsel = 'JATENG-DIY' THEN 'JATENG'
          ELSE b.region_tsel
        END AS region_nama,
        b.branch as branch,
        CASE
          WHEN b.region_tsel = 'JATENG-DIY' THEN 1
          WHEN b.region_tsel = 'BALI NUSRA' THEN 3
          ELSE 2
        END AS region_urut,
        COUNT(DISTINCT CASE WHEN hvc_kpi = '3JAM' THEN ticketid END) AS tiga_op,
        COUNT(DISTINCT CASE WHEN description_assignment = 'Customer Assign' AND umur_gaul < 1 THEN ticketid END) AS tigam_op,
        COUNT(DISTINCT CASE WHEN hvc_kpi = '6JAM' THEN ticketid END) AS enam_op,
        COUNT(DISTINCT CASE WHEN hvc_kpi = '12JAM' THEN ticketid END) AS duabelas_op,
        COUNT(DISTINCT CASE WHEN hvc_kpi = '24JAM' THEN ticketid END) AS duaempat_op,
        COUNT(DISTINCT CASE WHEN hvc_kpi IN ('12JAM', '24JAM', '36JAM') THEN ticketid END) AS tigapuluh_op,
        COUNT(DISTINCT CASE WHEN jam >= 2 AND jam < 3 AND jenis <> '' AND hvc_kpi = '3JAM' THEN ticketid END) AS tiga_wr,
        COUNT(DISTINCT CASE WHEN description_assignment = 'Customer Assign' AND umur_gaul > 2 AND umur_gaul < 3 THEN ticketid END) AS tigam_wr,
        COUNT(DISTINCT CASE WHEN jam >= 4 AND jam < 6 AND jenis <> '' AND hvc_kpi = '6JAM' THEN ticketid END) AS enam_wr,
        COUNT(DISTINCT CASE WHEN jam >= 9 AND jam < 12 AND jenis <> '' AND hvc_kpi = '12JAM' THEN ticketid END) AS duabelas_wr,
        COUNT(DISTINCT CASE WHEN jam >= 18 AND jam < 24 AND jenis <> '' AND hvc_kpi = '24JAM' THEN ticketid END) AS duaempat_wr,
        COUNT(DISTINCT CASE WHEN jam >= 30 AND jam < 36 AND jenis <> '' AND hvc_kpi IN ('12JAM', '24JAM', '36JAM') THEN ticketid END) AS tigapuluh_wr,
        COUNT(DISTINCT CASE WHEN jam >= 3 AND jenis <> '' AND hvc_kpi = '3JAM' THEN ticketid END) AS tiga_ex,
        COUNT(DISTINCT CASE WHEN description_assignment = 'Customer Assign' AND umur_gaul >= 3 THEN ticketid END) AS tigam_ex,
        COUNT(DISTINCT CASE WHEN jam >= 6 AND jenis <> '' AND hvc_kpi = '6JAM' THEN ticketid END) AS enam_ex,
        COUNT(DISTINCT CASE WHEN jam >= 12 AND jenis <> '' AND hvc_kpi = '12JAM' THEN ticketid END) AS duabelas_ex,
        COUNT(DISTINCT CASE WHEN jam >= 24 AND jenis <> '' AND hvc_kpi = '24JAM' THEN ticketid END) AS duaempat_ex,
        COUNT(DISTINCT CASE WHEN jam >= 36 AND jenis <> '' AND hvc_kpi IN ('12JAM', '24JAM', '36JAM') THEN ticketid END) AS tigapuluh_ex
      FROM metabase.mapping_sektor b
      LEFT JOIN metabase.ttr_wsa_tif3_detail a ON b.sto = a.sto
      GROUP BY 1, 2
    )
    SELECT
      region_nama, branch,
      SUM(tiga_op) AS tot_tiga_op, SUM(tiga_wr) AS tot_tiga_wr, SUM(tiga_ex) AS tot_tiga_ex,
      SUM(tigam_op) AS tot_tigam_op, SUM(tigam_wr) AS tot_tigam_wr, SUM(tigam_ex) AS tot_tigam_ex,
      SUM(enam_op) AS tot_enam_op, SUM(enam_wr) AS tot_enam_wr, SUM(enam_ex) AS tot_enam_ex,
      SUM(duabelas_op) AS tot_duabelas_op, SUM(duabelas_wr) AS tot_duabelas_wr, SUM(duabelas_ex) AS tot_duabelas_ex,
      SUM(duaempat_op) AS tot_duaempat_op, SUM(duaempat_wr) AS tot_duaempat_wr, SUM(duaempat_ex) AS tot_duaempat_ex,
      SUM(tigapuluh_op) AS tot_tigapuluh_op, SUM(tigapuluh_wr) AS tot_tigapuluh_wr, SUM(tigapuluh_ex) AS tot_tigapuluh_ex
    FROM kpi_data
    GROUP BY region_nama, branch, region_urut
    UNION ALL
    SELECT
      region_nama, 'total',
      SUM(tiga_op), SUM(tiga_wr), SUM(tiga_ex),
      SUM(tigam_op), SUM(tigam_wr), SUM(tigam_ex),
      SUM(enam_op), SUM(enam_wr), SUM(enam_ex),
      SUM(duabelas_op), SUM(duabelas_wr), SUM(duabelas_ex),
      SUM(duaempat_op), SUM(duaempat_wr), SUM(duaempat_ex),
      SUM(tigapuluh_op), SUM(tigapuluh_wr), SUM(tigapuluh_ex)
    FROM kpi_data
    GROUP BY region_nama, region_urut
    ORDER BY region_nama, (CASE WHEN branch = 'total' THEN 1 ELSE 0 END) ASC;
  `;

  return new Promise((resolve, reject) => {
    db.query(query, (error, results) => {
      if (error) return reject(error);

      if (!results || results.length === 0) {
        return resolve({ detail: [], summaryText: 'Data tidak ditemukan' });
      }

      const regionTotals = results.filter((item) => item.branch === 'total');
      const branchDetails = results.filter((item) => item.branch !== 'total');

      const getShortName = (name) => (name ? name.substring(0, 3).toUpperCase() : 'N/A');

      // TTR 3 JAM
      // --- 1. CARI DATA TERBESAR UNTUK OPEN (3 JAM) ---
      const topRegOpt3 = [...regionTotals].sort((a, b) => (b.tot_tiga_op || 0) - (a.tot_tiga_op || 0))[0];
      const topBraOpt3 = branchDetails.filter((b) => b.region_nama === topRegOpt3.region_nama).sort((a, b) => (b.tot_tiga_op || 0) - (a.tot_tiga_op || 0))[0];

      // --- 2. CARI DATA TERBESAR UNTUK WARNING (3 JAM) ---
      const topRegWrt3 = [...regionTotals].sort((a, b) => (b.tot_tiga_wr || 0) - (a.tot_tiga_wr || 0))[0];
      const topBraWrt3 = branchDetails.filter((b) => b.region_nama === topRegWrt3.region_nama).sort((a, b) => (b.tot_tiga_wr || 0) - (a.tot_tiga_wr || 0))[0];

      // --- 3. CARI DATA TERBESAR UNTUK EXPIRED (3 JAM) ---
      const topRegExt3 = [...regionTotals].sort((a, b) => (b.tot_tiga_ex || 0) - (a.tot_tiga_ex || 0))[0];
      const topBraExt3 = branchDetails.filter((b) => b.region_nama === topRegExt3.region_nama).sort((a, b) => (b.tot_tiga_ex || 0) - (a.tot_tiga_ex || 0))[0];

      // TTR 3 MANJA
      // --- 1. CARI DATA TERBESAR UNTUK OPEN (3 JAM MANJA) ---
      const topRegOptm = [...regionTotals].sort((a, b) => (b.tot_tigam_op || 0) - (a.tot_tigam_op || 0))[0];
      const topBraOptm = branchDetails.filter((b) => b.region_nama === topRegOptm.region_nama).sort((a, b) => (b.tot_tigam_op || 0) - (a.tot_tigam_op || 0))[0];

      // --- 2. CARI DATA TERBESAR UNTUK WARNING (3 JAM MANJA) ---
      const topRegWrtm = [...regionTotals].sort((a, b) => (b.tot_tigam_wr || 0) - (a.tot_tigam_wr || 0))[0];
      const topBraWrtm = branchDetails.filter((b) => b.region_nama === topRegWrtm.region_nama).sort((a, b) => (b.tot_tigam_wr || 0) - (a.tot_tigam_wr || 0))[0];

      // --- 3. CARI DATA TERBESAR UNTUK EXPIRED (3 JAM MANJA) ---
      const topRegExtm = [...regionTotals].sort((a, b) => (b.tot_tigam_ex || 0) - (a.tot_tigam_ex || 0))[0];
      const topBraExtm = branchDetails.filter((b) => b.region_nama === topRegExtm.region_nama).sort((a, b) => (b.tot_tigam_ex || 0) - (a.tot_tigam_ex || 0))[0];

      // TTR 6 MANJA
      // --- 1. CARI DATA TERBESAR UNTUK OPEN (3 JAM) ---
      const topRegOpt6 = [...regionTotals].sort((a, b) => (b.tot_enam_op || 0) - (a.tot_enam_op || 0))[0];
      const topBraOpt6 = branchDetails.filter((b) => b.region_nama === topRegOpt6.region_nama).sort((a, b) => (b.tot_enam_op || 0) - (a.tot_enam_op || 0))[0];

      // --- 2. CARI DATA TERBESAR UNTUK WARNING (3 JAM) ---
      const topRegWrt6 = [...regionTotals].sort((a, b) => (b.tot_enam_wr || 0) - (a.tot_enam_wr || 0))[0];
      const topBraWrt6 = branchDetails.filter((b) => b.region_nama === topRegWrt6.region_nama).sort((a, b) => (b.tot_enam_wr || 0) - (a.tot_enam_wr || 0))[0];

      // --- 3. CARI DATA TERBESAR UNTUK EXPIRED (3 JAM) ---
      const topRegExt6 = [...regionTotals].sort((a, b) => (b.tot_enam_ex || 0) - (a.tot_enam_ex || 0))[0];
      const topBraExt6 = branchDetails.filter((b) => b.region_nama === topRegExt6.region_nama).sort((a, b) => (b.tot_enam_ex || 0) - (a.tot_enam_ex || 0))[0];

      // TTR 12 MANJA
      // --- 1. CARI DATA TERBESAR UNTUK OPEN (3 JAM) ---
      const topRegOpt12 = [...regionTotals].sort((a, b) => (b.tot_duabelas_op || 0) - (a.tot_duabelas_op || 0))[0];
      const topBraOpt12 = branchDetails.filter((b) => b.region_nama === topRegOpt12.region_nama).sort((a, b) => (b.tot_duabelas_op || 0) - (a.tot_duabelas_op || 0))[0];

      // --- 2. CARI DATA TERBESAR UNTUK WARNING (3 JAM) ---
      const topRegWrt12 = [...regionTotals].sort((a, b) => (b.tot_duabelas_wr || 0) - (a.tot_duabelas_wr || 0))[0];
      const topBraWrt12 = branchDetails.filter((b) => b.region_nama === topRegWrt12.region_nama).sort((a, b) => (b.tot_duabelas_wr || 0) - (a.tot_duabelas_wr || 0))[0];

      // --- 3. CARI DATA TERBESAR UNTUK EXPIRED (3 JAM) ---
      const topRegExt12 = [...regionTotals].sort((a, b) => (b.tot_duabelas_ex || 0) - (a.tot_duabelas_ex || 0))[0];
      const topBraExt12 = branchDetails.filter((b) => b.region_nama === topRegExt12.region_nama).sort((a, b) => (b.tot_duabelas_ex || 0) - (a.tot_duabelas_ex || 0))[0];

      // TTR 24 MANJA
      // --- 1. CARI DATA TERBESAR UNTUK OPEN (3 JAM) ---
      const topRegOpt24 = [...regionTotals].sort((a, b) => (b.tot_duaempat_op || 0) - (a.tot_duaempat_op || 0))[0];
      const topBraOpt24 = branchDetails.filter((b) => b.region_nama === topRegOpt24.region_nama).sort((a, b) => (b.tot_duaempat_op || 0) - (a.tot_duaempat_op || 0))[0];

      // --- 2. CARI DATA TERBESAR UNTUK WARNING (3 JAM) ---
      const topRegWrt24 = [...regionTotals].sort((a, b) => (b.tot_duaempat_wr || 0) - (a.tot_duaempat_wr || 0))[0];
      const topBraWrt24 = branchDetails.filter((b) => b.region_nama === topRegWrt24.region_nama).sort((a, b) => (b.tot_duaempat_wr || 0) - (a.tot_duaempat_wr || 0))[0];

      // --- 3. CARI DATA TERBESAR UNTUK EXPIRED (3 JAM) ---
      const topRegExt24 = [...regionTotals].sort((a, b) => (b.tot_duaempat_ex || 0) - (a.tot_duaempat_ex || 0))[0];
      const topBraExt24 = branchDetails.filter((b) => b.region_nama === topRegExt24.region_nama).sort((a, b) => (b.tot_duaempat_ex || 0) - (a.tot_duaempat_ex || 0))[0];

      // TTR 36 MANJA
      // --- 1. CARI DATA TERBESAR UNTUK OPEN (3 JAM) ---
      const topRegOpt36 = [...regionTotals].sort((a, b) => (b.tot_tigapuluh_op || 0) - (a.tot_tigapuluh_op || 0))[0];
      const topBraOpt36 = branchDetails.filter((b) => b.region_nama === topRegOpt36.region_nama).sort((a, b) => (b.tot_tigapuluh_op || 0) - (a.tot_tigapuluh_op || 0))[0];

      // --- 2. CARI DATA TERBESAR UNTUK WARNING (3 JAM) ---
      const topRegWrt36 = [...regionTotals].sort((a, b) => (b.tot_tigapuluh_wr || 0) - (a.tot_tigapuluh_wr || 0))[0];
      const topBraWrt36 = branchDetails.filter((b) => b.region_nama === topRegWrt36.region_nama).sort((a, b) => (b.tot_tigapuluh_wr || 0) - (a.tot_tigapuluh_wr || 0))[0];

      // --- 3. CARI DATA TERBESAR UNTUK EXPIRED (3 JAM) ---
      const topRegExt36 = [...regionTotals].sort((a, b) => (b.tot_tigapuluh_ex || 0) - (a.tot_tigapuluh_ex || 0))[0];
      const topBraExt36 = branchDetails.filter((b) => b.region_nama === topRegExt36.region_nama).sort((a, b) => (b.tot_tigapuluh_ex || 0) - (a.tot_tigapuluh_ex || 0))[0];

      // --- FORMAT SUMMARY ---
      // Menggunakan pemisahan per kategori agar terlihat siapa yang paling kritis di tiap status
      const summaryString = `TTRC 3H (D,V)
Open- ${topRegOpt3.region_nama} (${topRegOpt3.tot_tiga_op})-> Dis ${getShortName(topBraOpt3.branch)} (${topBraOpt3.tot_tiga_op})
Warn- ${topRegWrt3.region_nama} (${topRegWrt3.tot_tiga_wr})-> Dis ${getShortName(topBraWrt3.branch)} (${topBraWrt3.tot_tiga_wr})
Expi- ${topRegExt3.region_nama} (${topRegExt3.tot_tiga_ex})-> Dis ${getShortName(topBraExt3.branch)} (${topBraExt3.tot_tiga_ex})

TTRC 3H (Manja)
Open- ${topRegOptm.region_nama} (${topRegOptm.tot_tigam_op})-> Dis ${getShortName(topBraOptm.branch)} (${topBraOptm.tot_tigam_op})
Warn- ${topRegWrtm.region_nama} (${topRegWrtm.tot_tigam_wr})-> Dis ${getShortName(topBraWrtm.branch)} (${topBraWrtm.tot_tigam_wr})
Expi- ${topRegExtm.region_nama} (${topRegExtm.tot_tigam_ex})-> Dis ${getShortName(topBraExtm.branch)} (${topBraExtm.tot_tigam_ex})

TTRC 6H (Platinum)
Open- ${topRegOpt6.region_nama} (${topRegOpt6.tot_enam_op})-> Dis ${getShortName(topBraOpt6.branch)} (${topBraOpt6.tot_enam_op})
Warn- ${topRegWrt6.region_nama} (${topRegWrt6.tot_enam_wr})-> Dis ${getShortName(topBraWrt6.branch)} (${topBraWrt6.tot_enam_wr})
Expi- ${topRegExt6.region_nama} (${topRegExt6.tot_enam_ex})-> Dis ${getShortName(topBraExt6.branch)} (${topBraExt6.tot_enam_ex})

TTRC 12H (Gold)
Open- ${topRegOpt12.region_nama} (${topRegOpt12.tot_duabelas_op})-> Dis ${getShortName(topBraOpt12.branch)} (${topBraOpt12.tot_duabelas_op})
Warn- ${topRegWrt12.region_nama} (${topRegWrt12.tot_duabelas_wr})-> Dis ${getShortName(topBraWrt12.branch)} (${topBraWrt12.tot_duabelas_wr})
Expi- ${topRegExt12.region_nama} (${topRegExt12.tot_duabelas_ex})-> Dis ${getShortName(topBraExt12.branch)} (${topBraExt12.tot_duabelas_ex})

TTRC 24H (Reguler)
Open- ${topRegOpt24.region_nama} (${topRegOpt24.tot_duaempat_op})-> Dis ${getShortName(topBraOpt24.branch)} (${topBraOpt24.tot_duaempat_op})
Warn- ${topRegWrt24.region_nama} (${topRegWrt24.tot_duaempat_wr})-> Dis ${getShortName(topBraWrt24.branch)} (${topBraWrt24.tot_duaempat_wr})
Expi- ${topRegExt24.region_nama} (${topRegExt24.tot_duaempat_ex})-> Dis ${getShortName(topBraExt24.branch)} (${topBraExt24.tot_duaempat_ex})

TTRC 36H (Non HVC)
Open- ${topRegOpt36.region_nama} (${topRegOpt36.tot_tigapuluh_op})-> Dis ${getShortName(topBraOpt36.branch)} (${topBraOpt36.tot_tigapuluh_op})
Warn- ${topRegWrt36.region_nama} (${topRegWrt36.tot_tigapuluh_wr})-> Dis ${getShortName(topBraWrt36.branch)} (${topBraWrt36.tot_tigapuluh_wr})
Expi- ${topRegExt36.region_nama} (${topRegExt36.tot_tigapuluh_ex})-> Dis ${getShortName(topBraExt36.branch)} (${topBraExt36.tot_tigapuluh_ex})
      `;
      resolve({
        detail: results,
        summaryText: summaryString,
      });
    });
  });
}

// getPerformanceReport();
module.exports = { getPerformanceReport };
