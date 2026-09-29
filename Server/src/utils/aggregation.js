/** Aggregation group shaping helpers. */

/** Format aggregation group results. */
const shapeGroups = (rows) =>
  rows.map((row) => ({
    name: row._id || "Unknown",
    total: Number(row.total.toFixed(2)),
    count: row.count,
  }));

module.exports = { shapeGroups };
