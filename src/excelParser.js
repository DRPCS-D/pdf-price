import * as XLSX from 'xlsx';

/**
 * Parses an Excel file to extract codes and their corresponding prices.
 * @param {File} file - The uploaded Excel file.
 * @returns {Promise<Map<string, number>>} A map from code (string) to price (number).
 */
export function parseExcelPrices(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Get the first worksheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert worksheet to JSON (array of arrays or array of objects)
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length === 0) {
          reject(new Error("El archivo Excel está vacío."));
          return;
        }

        const priceMap = new Map();
        
        // Find column indices for Code and Price
        let codeIndex = -1;
        let priceIndex = -1;

        // Common column header variations
        const codeHeaders = ['codigo', 'código', 'code', 'cod', 'referencia', 'ref', 'id', 'item'];
        const priceHeaders = ['precio', 'price', 'valor', 'costo', 'cost', 'pvp', 'monto'];

        // Let's analyze the first few rows to find headers
        // Sometimes headers are not in the first row. We'll search up to the first 5 rows.
        let headerRowIndex = 0;
        for (let r = 0; r < Math.min(jsonData.length, 5); r++) {
          const row = jsonData[r];
          if (!row) continue;
          
          for (let c = 0; c < row.length; c++) {
            const cellVal = String(row[c] || '').toLowerCase().trim();
            if (codeIndex === -1 && codeHeaders.some(h => cellVal.includes(h) || h.includes(cellVal))) {
              codeIndex = c;
            }
            if (priceIndex === -1 && priceHeaders.some(h => cellVal.includes(h) || h.includes(cellVal))) {
              priceIndex = c;
            }
          }
          if (codeIndex !== -1 && priceIndex !== -1) {
            headerRowIndex = r;
            break;
          }
        }

        // Fallback: If not found, assume column 0 is code and column 1 is price
        if (codeIndex === -1) codeIndex = 0;
        if (priceIndex === -1) priceIndex = 1;

        // Read the data rows
        for (let r = headerRowIndex + 1; r < jsonData.length; r++) {
          const row = jsonData[r];
          if (!row) continue;

          const rawCode = row[codeIndex];
          const rawPrice = row[priceIndex];

          if (rawCode === undefined || rawCode === null) continue;

          const codeStr = String(rawCode).trim();
          if (codeStr === '') continue;

          // Parse price
          let priceNum = 0;
          if (rawPrice !== undefined && rawPrice !== null) {
            // Remove currency symbols, commas and other characters, leaving only numbers and dots/commas for decimal
            const cleanedPrice = String(rawPrice)
              .replace(/[^\d.,-]/g, '')
              .replace(/,/g, '.'); // Replace commas with dots for parseFloat
            priceNum = parseFloat(cleanedPrice);
          }

          if (!isNaN(priceNum) && codeStr) {
            priceMap.set(codeStr, priceNum);
          }
        }

        resolve(priceMap);
      } catch (err) {
        reject(new Error("Error al analizar el Excel: " + err.message));
      }
    };

    reader.onerror = () => {
      reject(new Error("No se pudo leer el archivo Excel."));
    };

    reader.readAsArrayBuffer(file);
  });
}
