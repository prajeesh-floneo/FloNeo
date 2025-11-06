// const ExcelJS = require("exceljs");

// function toCSVBuffer(rows, headers = []) {
//   if (!rows || !rows.length) return { buffer: Buffer.from("") };
//   const keys = headers.length ? headers : Object.keys(rows[0]);
//   const esc = (v) => {
//     if (v === null || v === undefined) return "";
//     const s = String(v);
//     return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
//   };
//   const lines = [];
//   lines.push(keys.join(","));
//   for (const row of rows) lines.push(keys.map((k) => esc(row[k])).join(","));
//   return { buffer: Buffer.from(lines.join("\n"), "utf8") };
// }

// async function toExcelBuffer(rows, headers = [], sheetName = "Sheet1") {
//   const workbook = new ExcelJS.Workbook();
//   const sheet = workbook.addWorksheet(sheetName);

//   const keys = headers.length ? headers : Object.keys(rows[0] || {});
//   sheet.addRow(keys);
//   rows.forEach((row) => sheet.addRow(keys.map((k) => row[k])));

//   const buffer = await workbook.xlsx.writeBuffer();
//   return { buffer: Buffer.from(buffer) };
// }

// module.exports = { toCSVBuffer, toExcelBuffer };

// server/utils/exporters.js
const ExcelJS = require("exceljs");
const { Parser } = require("json2csv");

/**
 * Export data to CSV or Excel format
 * @param {Array} data
 * @param {Array} columns
 * @param {"csv" | "excel"} format
 * @returns {Buffer}
 */
async function exportTableData(data, columns, format = "csv") {
  if (!data || data.length === 0) {
    throw new Error("No data available to export");
  }

  // Handle CSV export
  if (format === "csv") {
    const parser = new Parser({ fields: columns.map(c => c.name) });
    const csv = parser.parse(data);
    return Buffer.from(csv, "utf-8");
  }

  // Handle Excel export
  if (format === "excel") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Table Data");

    // Add column headers
    sheet.columns = columns.map(col => ({
      header: col.name,
      key: col.name,
      width: 20,
    }));

    // Add rows
    data.forEach(row => sheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  throw new Error("Unsupported export format");
}

module.exports = { exportTableData };
