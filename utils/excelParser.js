import XLSX from 'xlsx';

/**
 * Parses an Excel file and returns an array of objects representing each row.
 * 
 * @param {string} filePath - Path to the Excel file to be parsed
 * @returns {Array<Object>} Array of row objects with cleaned keys
 * @throws {Error} If there's an error reading or parsing the file
 */
const parseExcel = (filePath) => {
  // Read the Excel file with specific options
  // - cellDates: Parse dates as Date objects
  // - raw: Set to false to get formatted values (e.g., dates as strings)
  const workbook = XLSX.readFile(filePath, {
    cellDates: true,
    raw: false,
  });

  // Find the appropriate worksheet to parse:
  // 1. First try to find a sheet with "out" in its name (case-insensitive)
  // 2. Fall back to the first sheet if no match is found
  const sheetName =
    workbook.SheetNames.find((n) => n.toLowerCase().includes("out")) ||
    workbook.SheetNames[0];

  // Get the worksheet by name
  const sheet = workbook.Sheets[sheetName];

  // Convert the worksheet to an array of objects
  // - defval: Default value for empty cells (empty string)
  let rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  // Clean the data by normalizing the keys:
  // 1. Trim whitespace from keys
  // 2. Replace multiple spaces with a single space
  rows = rows.map((row) => {
    const cleaned = {};
    for (let k in row) {
      cleaned[k.trim().replace(/\s+/g, " ")] = row[k];
    }
    return cleaned;
  });

  return rows;
};

export default parseExcel;