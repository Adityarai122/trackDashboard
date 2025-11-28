const fs = require("fs");
const csv = require("csv-parser");

/**
 * Parses a CSV file and returns an array of objects representing each row.
 * 
 * @param {string} filePath - The path to the CSV file to be parsed
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of row objects
 * @throws {Error} If there's an error reading or parsing the file
 */
module.exports = async function parseCSV(filePath) {
  const rows = []; // Array to store parsed rows

  // Wrap the stream processing in a Promise for async/await support
  await new Promise((resolve, reject) => {
    // Create a read stream from the file
    fs.createReadStream(filePath)
      // Pipe the file stream through the CSV parser
      .pipe(csv())
      // Process each row of data
      .on("data", (row) => {
        // Create a new object to store cleaned row data
        const cleaned = {};
        
        // Iterate through each key-value pair in the row
        for (let k in row) {
          // Trim whitespace from keys and add to cleaned object
          cleaned[k.trim()] = row[k];
        }
        
        // Add the cleaned row to our results array
        rows.push(cleaned);
      })
      // Handle successful completion
      .on("end", resolve)
      // Handle any errors during processing
      .on("error", (error) => {
        console.error(`Error parsing CSV file: ${filePath}`, error);
        reject(error);
      });
  });

  return rows; // Return the array of parsed rows
};