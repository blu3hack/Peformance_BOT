// Pastikan file ini terpisah dari file koneksi database untuk menghindari circular dependency
const db = require('./connection');

async function getPerformanceReport() {
  const query = `
    WITH alert_gamas_access AS (
      SELECT
        service_area,
        sto,
        branch,
        region_urut,
        region_tsel,
        CASE
          WHEN branch_kode IS NULL THEN
            'TOTAL'
          ELSE
            branch_kode
        END AS branch_kode,
        SUM(gamas_olt_op) AS gamas_olt_op,
        SUM(gamas_olt_wr) AS gamas_olt_wr,
        SUM(gamas_olt_ex) AS gamas_olt_ex,
        SUM(gamas_feeder_op) AS gamas_feeder_op,
        SUM(gamas_feeder_wr) AS gamas_feeder_wr,
        SUM(gamas_feeder_ex) AS gamas_feeder_ex,
        SUM(gamas_distribusi_op) AS gamas_distribusi_op,
        SUM(gamas_distribusi_wr) AS gamas_distribusi_wr,
        SUM(gamas_distribusi_ex) AS gamas_distribusi_ex,
        SUM(gamas_odp_op) AS gamas_odp_op,
        SUM(gamas_odp_wr) AS gamas_odp_wr,
        SUM(gamas_odp_ex) AS gamas_odp_ex
      FROM
        (
          SELECT
            service_area,
            a.sto,
            branch,
            CASE
              WHEN a.region_tsel = 'BALI NUSRA' THEN
                3
              WHEN a.region_tsel = 'JATENG-DIY' THEN
                1
              ELSE
                2
            END AS region_urut,
            CASE
              WHEN a.region_tsel = 'BALI NUSRA' THEN
                'BALNUS'
              WHEN a.region_tsel = 'JATENG-DIY' THEN
                'JATENG'
              ELSE
                a.region_tsel
            END AS region_tsel,
            a.branch AS branch_kode,
            COUNT(DISTINCT olt.incident) AS gamas_olt_op,
            COUNT(DISTINCT CASE WHEN olt.ttr >= 2 AND olt.ttr < 3 THEN olt.incident END) AS gamas_olt_wr,
            COUNT(DISTINCT CASE WHEN olt.ttr >= 3 THEN olt.incident END) AS gamas_olt_ex,
            COUNT(DISTINCT feeder.incident) AS gamas_feeder_op,
            COUNT(DISTINCT CASE WHEN feeder.ttr >= 8 AND feeder.ttr < 10 THEN feeder.incident END) AS gamas_feeder_wr,
            COUNT(DISTINCT CASE WHEN feeder.ttr >= 10 THEN feeder.incident END) AS gamas_feeder_ex,
            COUNT(DISTINCT dist.incident) AS gamas_distribusi_op,
            COUNT(DISTINCT CASE WHEN dist.ttr >= 3 AND dist.ttr < 4 THEN dist.incident END) AS gamas_distribusi_wr,
            COUNT(DISTINCT CASE WHEN dist.ttr >= 4 THEN dist.incident END) AS gamas_distribusi_ex,
            COUNT(DISTINCT odp.incident) AS gamas_odp_op,
            COUNT(DISTINCT CASE WHEN odp.ttr >= 2 AND odp.ttr < 3 THEN odp.incident END) AS gamas_odp_wr,
            COUNT(DISTINCT CASE WHEN odp.ttr >= 3 THEN odp.incident END) AS gamas_odp_ex
          FROM
            metabase.mapping_sektor a
            LEFT JOIN metabase_tif3.view_tiket_aktif_gamas_olt olt ON olt.workzone = a.sto
            LEFT JOIN metabase_tif3.view_tiket_aktif_gamas_feeder feeder ON feeder.workzone = a.sto
            LEFT JOIN metabase_tif3.view_tiket_aktif_gamas_distribusi dist ON dist.workzone = a.sto
            LEFT JOIN metabase_tif3.view_tiket_aktif_gamas_odp odp ON odp.workzone = a.sto
          GROUP BY
            region_urut,
            sto,
            branch,
            region_tsel,
            service_area
        ) base
      GROUP BY
        region_urut,
        sto,
        branch,
        region_tsel,
        service_area
      ORDER BY
        region_urut,
        branch_kode,
        sto
    )

    SELECT
      region_tsel,
      branch,
      SUM(gamas_olt_op) AS gamas_olt_op,
      SUM(gamas_olt_wr) AS gamas_olt_wr,
      SUM(gamas_olt_ex) AS gamas_olt_ex,
      SUM(gamas_feeder_op) AS gamas_feeder_op,
      SUM(gamas_feeder_wr) AS gamas_feeder_wr,
      SUM(gamas_feeder_ex) AS gamas_feeder_ex,
      SUM(gamas_distribusi_op) AS gamas_distribusi_op,
      SUM(gamas_distribusi_wr) AS gamas_distribusi_wr,
      SUM(gamas_distribusi_ex) AS gamas_distribusi_ex,
      SUM(gamas_odp_op) AS gamas_odp_op,
      SUM(gamas_odp_wr) AS gamas_odp_wr,
      SUM(gamas_odp_ex) AS gamas_odp_ex
    FROM
      alert_gamas_access
    GROUP BY region_tsel, branch

    UNION ALL 

    SELECT
      region_tsel,
      'total',
      SUM(gamas_olt_op) AS gamas_olt_op,
      SUM(gamas_olt_wr) AS gamas_olt_wr,
      SUM(gamas_olt_ex) AS gamas_olt_ex,
      SUM(gamas_feeder_op) AS gamas_feeder_op,
      SUM(gamas_feeder_wr) AS gamas_feeder_wr,
      SUM(gamas_feeder_ex) AS gamas_feeder_ex,
      SUM(gamas_distribusi_op) AS gamas_distribusi_op,
      SUM(gamas_distribusi_wr) AS gamas_distribusi_wr,
      SUM(gamas_distribusi_ex) AS gamas_distribusi_ex,
      SUM(gamas_odp_op) AS gamas_odp_op,
      SUM(gamas_odp_wr) AS gamas_odp_wr,
      SUM(gamas_odp_ex) AS gamas_odp_ex
    FROM
      alert_gamas_access
    GROUP BY region_tsel

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

      // ++++++++++++++ OLT ++++++++++++++++++++++++++
      const topRegGamas_olt_op = getTop(regionTotals, 'gamas_olt_op');
      const topBragamas_olt_op = getTop(branchDetails, 'gamas_olt_op', (b) => b.region_tsel === topRegGamas_olt_op.region_tsel);

      const topRegGamas_olt_wr = getTop(regionTotals, 'gamas_olt_wr');
      const topBragamas_olt_wr = getTop(branchDetails, 'gamas_olt_wr', (b) => b.region_tsel === topRegGamas_olt_wr.region_tsel);

      const topRegGamas_olt_ex = getTop(regionTotals, 'gamas_olt_ex');
      const topBragamas_olt_ex = getTop(branchDetails, 'gamas_olt_ex', (b) => b.region_tsel === topRegGamas_olt_ex.region_tsel);

      // ++++++++++++++ FEEDER ++++++++++++++++++++++++++
      const topRegGamas_feeder_op = getTop(regionTotals, 'gamas_feeder_op');
      const topBragamas_feeder_op = getTop(branchDetails, 'gamas_feeder_op', (b) => b.region_tsel === topRegGamas_feeder_op.region_tsel);

      const topRegGamas_feeder_wr = getTop(regionTotals, 'gamas_feeder_wr');
      const topBragamas_feeder_wr = getTop(branchDetails, 'gamas_feeder_wr', (b) => b.region_tsel === topRegGamas_feeder_wr.region_tsel);

      const topRegGamas_feeder_ex = getTop(regionTotals, 'gamas_feeder_ex');
      const topBragamas_feeder_ex = getTop(branchDetails, 'gamas_feeder_ex', (b) => b.region_tsel === topRegGamas_feeder_ex.region_tsel);

      // ++++++++++++++ DISTRIBUSI ++++++++++++++++++++++++++
      const topRegGamas_distribusi_op = getTop(regionTotals, 'gamas_distribusi_op');
      const topBragamas_distribusi_op = getTop(branchDetails, 'gamas_distribusi_op', (b) => b.region_tsel === topRegGamas_distribusi_op.region_tsel);

      const topRegGamas_distribusi_wr = getTop(regionTotals, 'gamas_distribusi_wr');
      const topBragamas_distribusi_wr = getTop(branchDetails, 'gamas_distribusi_wr', (b) => b.region_tsel === topRegGamas_distribusi_wr.region_tsel);

      const topRegGamas_distribusi_ex = getTop(regionTotals, 'gamas_distribusi_ex');
      const topBragamas_distribusi_ex = getTop(branchDetails, 'gamas_distribusi_ex', (b) => b.region_tsel === topRegGamas_distribusi_ex.region_tsel);

      // ++++++++++++++ ODP ++++++++++++++++++++++++++
      const topRegGamas_odp_op = getTop(regionTotals, 'gamas_odp_op');
      const topBragamas_odp_op = getTop(branchDetails, 'gamas_odp_op', (b) => b.region_tsel === topRegGamas_odp_op.region_tsel);

      const topRegGamas_odp_wr = getTop(regionTotals, 'gamas_odp_wr');
      const topBragamas_odp_wr = getTop(branchDetails, 'gamas_odp_wr', (b) => b.region_tsel === topRegGamas_odp_wr.region_tsel);

      const topRegGamas_odp_ex = getTop(regionTotals, 'gamas_odp_ex');
      const topBragamas_odp_ex = getTop(branchDetails, 'gamas_odp_ex', (b) => b.region_tsel === topRegGamas_odp_ex.region_tsel);

      // Gunakan Optional Chaining dan Default Value
      const summaryString = `<b>OLT</b>
Open - ${topRegGamas_olt_op.region_tsel || 'N/A'} (${topRegGamas_olt_op.gamas_olt_op || 0}) -> Dis ${getShortName(topBragamas_olt_op.branch)} (${topBragamas_olt_op.gamas_olt_op || 0})
Warn - ${topRegGamas_olt_wr.region_tsel || 'N/A'} (${topRegGamas_olt_wr.gamas_olt_wr || 0}) -> Dis ${getShortName(topBragamas_olt_wr.branch)} (${topBragamas_olt_wr.gamas_olt_wr || 0})
Expi - ${topRegGamas_olt_ex.region_tsel || 'N/A'} (${topRegGamas_olt_ex.gamas_olt_ex || 0}) -> Dis ${getShortName(topBragamas_olt_ex.branch)} (${topBragamas_olt_ex.gamas_olt_ex || 0})

<b>FEEDER</b>
Open - ${topRegGamas_feeder_op.region_tsel || 'N/A'} (${topRegGamas_feeder_op.gamas_feeder_op || 0}) -> Dis ${getShortName(topBragamas_feeder_op.branch)} (${topBragamas_feeder_op.gamas_feeder_op || 0})
Warn - ${topRegGamas_feeder_wr.region_tsel || 'N/A'} (${topRegGamas_feeder_wr.gamas_feeder_wr || 0}) -> Dis ${getShortName(topBragamas_feeder_wr.branch)} (${topBragamas_feeder_wr.gamas_feeder_wr || 0})
Expi - ${topRegGamas_feeder_ex.region_tsel || 'N/A'} (${topRegGamas_feeder_ex.gamas_feeder_ex || 0}) -> Dis ${getShortName(topBragamas_feeder_ex.branch)} (${topBragamas_feeder_ex.gamas_feeder_ex || 0})

<b>DISTRIBUSI</b>
Open - ${topRegGamas_distribusi_op.region_tsel || 'N/A'} (${topRegGamas_distribusi_op.gamas_distribusi_op || 0}) -> Dis ${getShortName(topBragamas_distribusi_op.branch)} (${topBragamas_distribusi_op.gamas_distribusi_op || 0})
Warn - ${topRegGamas_distribusi_wr.region_tsel || 'N/A'} (${topRegGamas_distribusi_wr.gamas_distribusi_wr || 0}) -> Dis ${getShortName(topBragamas_distribusi_wr.branch)} (${topBragamas_distribusi_wr.gamas_distribusi_wr || 0})
Expi - ${topRegGamas_distribusi_ex.region_tsel || 'N/A'} (${topRegGamas_distribusi_ex.gamas_distribusi_ex || 0}) -> Dis ${getShortName(topBragamas_distribusi_ex.branch)} (${topBragamas_distribusi_ex.gamas_distribusi_ex || 0})

<b>ODP</b>
Open - ${topRegGamas_odp_op.region_tsel || 'N/A'} (${topRegGamas_odp_op.gamas_odp_op || 0}) -> Dis ${getShortName(topBragamas_odp_op.branch)} (${topBragamas_odp_op.gamas_odp_op || 0})
Warn - ${topRegGamas_odp_wr.region_tsel || 'N/A'} (${topRegGamas_odp_wr.gamas_odp_wr || 0}) -> Dis ${getShortName(topBragamas_odp_wr.branch)} (${topBragamas_odp_wr.gamas_odp_wr || 0})
Expi - ${topRegGamas_odp_ex.region_tsel || 'N/A'} (${topRegGamas_odp_ex.gamas_odp_ex || 0}) -> Dis ${getShortName(topBragamas_odp_ex.branch)} (${topBragamas_odp_ex.gamas_odp_ex || 0})

`;
      resolve({
        detail: results,
        summaryText: summaryString,
      });
    });
  });
}

module.exports = { getPerformanceReport };
