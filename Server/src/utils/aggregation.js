/**
 * Shared aggregation helpers (P2-6).
 *
 * `shapeGroups` was implemented identically in dashboardController.js and
 * analyticsController.js; both now import it from here so the shaping logic
 * cannot drift between the two surfaces.
 */

/** [{ _id, total, count }] -> [{ name, total, count }] sorted desc by total. */
const shapeGroups = (rows) =>
  rows.map((row) => ({
    name: row._id || "Unknown",
    total: Number(row.total.toFixed(2)),
    count: row.count,
  }));

module.exports = { shapeGroups };
