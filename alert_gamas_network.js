// Pastikan file ini terpisah dari file koneksi database untuk menghindari circular dependency
const db = require('./connection');

async function getPerformanceReport() {
  const query = `
    WITH alert_gamas_network AS (
      SELECT
        a.service_area, a.sto, a.branch,
        CASE
          WHEN a.region_tsel = 'BALI NUSRA' THEN 'BALNUS'
          WHEN a.region_tsel = 'JATENG-DIY' THEN 'JATENG'
          ELSE a.region_tsel
        END AS region_tsel,
        COUNT(DISTINCT rcv.incident) AS recovery_op,
        COUNT(DISTINCT CASE WHEN rcv.ttr >= 2 AND rcv.ttr < 3 THEN rcv.incident END) AS recovery_wr,
        COUNT(DISTINCT CASE WHEN rcv.ttr > 3 THEN rcv.incident END) AS recovery_ex,
        COUNT(DISTINCT rep.incident) AS repair_op,
        COUNT(DISTINCT CASE WHEN rep.ttr > 8 AND rep.ttr <= 10 THEN rep.incident END) AS repair_wr,
        COUNT(DISTINCT CASE WHEN rep.ttr >= 10 THEN rep.incident END) AS repair_ex,
        COUNT(DISTINCT pro.incident) AS proactive
      FROM
        metabase.mapping_sektor a
        LEFT JOIN metabase_tif3.view_network_recovery_ip_transport rcv 
          ON rcv.sto = a.sto 
          AND rcv.jenis_tiket COLLATE utf8mb4_unicode_ci IN ('ip', 'transport')
        LEFT JOIN metabase_tif3.view_network_repair_ip_transport rep 
          ON rep.sto = a.sto 
          AND rep.jenis_tiket COLLATE utf8mb4_unicode_ci IN ('ip', 'transport')
        LEFT JOIN metabase_tif3.view_proactive pro 
          ON pro.sto = a.sto
      GROUP BY 1, 2, 3, 4
    )

    SELECT
      region_tsel, branch,
      SUM(recovery_op) AS recovery_op, SUM(recovery_wr) AS recovery_wr,
      SUM(recovery_ex) AS recovery_ex, SUM(repair_op) AS repair_op,
      SUM(proactive) AS proactive
    FROM alert_gamas_network
    GROUP BY region_tsel, branch

    UNION ALL 

    SELECT
      region_tsel, 'total' AS branch,
      SUM(recovery_op) AS recovery_op, SUM(recovery_wr) AS recovery_wr,
      SUM(recovery_ex) AS recovery_ex, SUM(repair_op) AS repair_op,
      SUM(proactive) AS proactive
    FROM alert_gamas_network
    GROUP BY region_tsel
    
    ORDER BY region_tsel, CASE WHEN branch = 'total' THEN 2 ELSE 1 END
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

      // Helper untuk mencari top data agar tidak repetitif
      const getTop = (arr, key, filterFn = null) => {
        let target = filterFn ? arr.filter(filterFn) : arr;
        return [...target].sort((a, b) => (b[key] || 0) - (a[key] || 0))[0] || {};
      };

      // ++++++++++++++ Recovery ++++++++++++++++++++++++++
      const topRegRecop = getTop(regionTotals, 'recovery_op');
      const topBraRecop = getTop(branchDetails, 'recovery_op', (b) => b.region_tsel === topRegRecop.region_tsel);

      const topRegRecwr = getTop(regionTotals, 'recovery_wr');
      const topBraRecwr = getTop(branchDetails, 'recovery_wr', (b) => b.region_tsel === topRegRecwr.region_tsel);

      const topRegRecex = getTop(regionTotals, 'recovery_ex');
      const topBraRecex = getTop(branchDetails, 'recovery_ex', (b) => b.region_tsel === topRegRecex.region_tsel);

      // ++++++++++++++ Repair ++++++++++++++++++++++++++
      const topRegRepop = getTop(regionTotals, 'repair_op');
      const topBraRepop = getTop(branchDetails, 'repair_op', (b) => b.region_tsel === topRegRepop.region_tsel);

      const topRegRepwr = getTop(regionTotals, 'repair_wr');
      const topBraRepwr = getTop(branchDetails, 'repair_wr', (b) => b.region_tsel === topRegRepwr.region_tsel);

      const topRegRepex = getTop(regionTotals, 'repair_ex');
      const topBraRepex = getTop(branchDetails, 'repair_ex', (b) => b.region_tsel === topRegRepex.region_tsel);

      // +++++++++++++++ Proactive +++++++++++++++
      const topRegPro = getTop(regionTotals, 'proactive');
      const topBraPro = getTop(branchDetails, 'proactive', (b) => b.region_tsel === topRegPro.region_tsel);

      // Gunakan Optional Chaining dan Default Value
      const summaryString = `<b>Recovery</b>
Open - ${topRegRecop.region_tsel || 'N/A'} (${topRegRecop.recovery_op || 0}) -> Dis ${getShortName(topBraRecop.branch)} (${topBraRecop.recovery_op || 0})
Warn - ${topRegRecwr.region_tsel || 'N/A'} (${topRegRecwr.recovery_wr || 0}) -> Dis ${getShortName(topBraRecwr.branch)} (${topBraRecwr.recovery_wr || 0})
Expi - ${topRegRecex.region_tsel || 'N/A'} (${topRegRecex.recovery_wr || 0}) -> Dis ${getShortName(topBraRecex.branch)} (${topBraRecex.recovery_wr || 0})

<b>Repair</b>
Open - ${topRegRepop.region_tsel || 'N/A'} (${topRegRepop.repair_op || 0}) -> Dis ${getShortName(topBraRepop.branch)} (${topBraRepop.repair_op || 0})
Warn - ${topRegRepwr.region_tsel || 'N/A'} (${topRegRepwr.repair_wr || 0}) -> Dis ${getShortName(topBraRepwr.branch)} (${topBraRepwr.repair_wr || 0})
Expi - ${topRegRepex.region_tsel || 'N/A'} (${topRegRepex.repair_ex || 0}) -> Dis ${getShortName(topBraRepex.branch)} (${topBraRepex.repair_ex || 0})

<b>Proactive</b>
All - ${topRegPro.region_tsel || 'N/A'} (${topRegPro.proactive || 0}) -> Dis ${getShortName(topBraPro.branch)} (${topBraPro.proactive || 0})

`;
      resolve({
        detail: results,
        summaryText: summaryString,
      });
    });
  });
}

module.exports = { getPerformanceReport };
