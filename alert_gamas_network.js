const db = require('./connection');

async function getPerformanceReport() {
  const query = `
    WITH alert_gamas_network AS (
      SELECT
        service_area,
        a.sto,
        branch,
        CASE
          WHEN a.region_tsel = 'BALI NUSRA' THEN
            'BALNUS'
          WHEN a.region_tsel = 'JATENG-DIY' THEN
            'JATENG'
          ELSE
            a.region_tsel
        END AS region_tsel,
        CASE
          WHEN a.region_tsel = 'BALI NUSRA' THEN
            3
          WHEN a.region_tsel = 'JATENG-DIY' THEN
            1
          ELSE
            2
        END AS region_urut,
        COUNT(DISTINCT rcv.incident) AS recovery_op,
        COUNT(DISTINCT CASE WHEN rcv.ttr >= 2 AND rcv.ttr < 3 THEN rcv.incident END) AS recovery_wr,
        COUNT(DISTINCT CASE WHEN rcv.ttr > 3 THEN rcv.incident END) AS recovery_ex,
        COUNT(DISTINCT rep.incident) AS repair_op,
        COUNT(DISTINCT CASE WHEN rep.ttr > 8 AND rep.ttr <= 10 THEN rep.incident END) AS repair_wr,
        COUNT(DISTINCT CASE WHEN rep.ttr >= 10 THEN rep.incident END) AS repair_ex,
        COUNT(DISTINCT pro.incident) AS proactive
      FROM
        metabase.mapping_sektor a
        LEFT JOIN metabase_tif3.view_network_recovery_ip_transport rcv ON rcv.sto = a.sto
        AND rcv.jenis_tiket IN ('ip', 'transport')
        LEFT JOIN metabase_tif3.view_network_repair_ip_transport rep ON rep.sto = a.sto
        AND rep.jenis_tiket IN ('ip', 'transport')
        LEFT JOIN metabase_tif3.view_proactive pro ON pro.sto = a.sto
      GROUP BY
        region_urut,
        a.sto,
        branch,
        region_tsel,
        service_area
      ORDER BY
        region_urut
    )

    -- SELECT * FROM alert_gamas_network

    SELECT
      region_tsel,
      branch,
      SUM(recovery_op) AS recovery_op,
      SUM(recovery_wr) AS recovery_wr,
      SUM(recovery_ex) AS recovery_ex,
      SUM(repair_op) AS repair_op,
      SUM(repair_wr) AS repair_wr,
      SUM(repair_ex) AS repair_ex,
      SUM(proactive) AS proactive
      
    FROM
      alert_gamas_network
    GROUP BY branch

    UNION ALL 

    SELECT
      region_tsel,
      'total',
      SUM(recovery_op) AS recovery_op,
      SUM(recovery_wr) AS recovery_wr,
      SUM(recovery_ex) AS recovery_ex,
      SUM(repair_op) AS repair_op,
      SUM(repair_wr) AS repair_wr,
      SUM(repair_ex) AS repair_ex,
      SUM(proactive) AS proactive
      
    FROM
      alert_gamas_network
    GROUP BY region_tsel
    ORDER BY
    region_tsel,
    CASE WHEN branch = 'total' THEN 2 ELSE 1 END

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
