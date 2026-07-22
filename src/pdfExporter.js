import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Generates a new PDF by overlaying price badges next to the matched codes.
 * @param {File} originalPdfFile - The original PDF file uploaded by the user.
 * @param {Array<Object>} matchedItems - Array of matched items containing pdfX, pdfY, pageNum, price, etc.
 * @returns {Promise<Blob>} The generated PDF as a Blob.
 */
/**
 * Helper to convert a hex color string to normalized RGB values (0-1) for pdf-lib.
 * @param {string} hex - Hex color string (e.g. '#D92D20' or 'D92D20')
 * @param {Object} fallback - Fallback RGB object
 * @returns {Object} An object with { r, g, b } properties from 0.0 to 1.0.
 */
function hexToRgb(hex, fallback = { r: 0.85, g: 0.05, b: 0.05 }) {
  if (!hex) return fallback;
  const cleanHex = hex.replace(/^#/, '');
  if (cleanHex.length !== 3 && cleanHex.length !== 6) return fallback;
  
  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) return fallback;
  
  if (cleanHex.length === 3) {
    const r = ((num >> 8) & 0xf) * 17;
    const g = ((num >> 4) & 0xf) * 17;
    const b = (num & 0xf) * 17;
    return { r: r / 255, g: g / 255, b: b / 255 };
  }
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255
  };
}

/**
 * Generates a new PDF by overlaying price badges next to the matched codes.
 * @param {File} originalPdfFile - The original PDF file uploaded by the user.
 * @param {Array<Object>} matchedItems - Array of matched items containing pdfX, pdfY, pageNum, price, etc.
 * @param {string} position - Price label position ('right', 'left', 'above', 'below')
 * @param {number} customFontSize - Price font size
 * @param {number} customMargin - Spacing in points
 * @param {boolean} showCurrency - Whether to include the currency symbol
 * @param {string} currencySymbol - The currency symbol text
 * @param {string} priceColor - The hex code of the custom color
 * @returns {Promise<Blob>} The generated PDF as a Blob.
 */
export async function exportAnnotatedPDF(
  originalPdfFile,
  matchedItems,
  position = 'right',
  customFontSize = 11,
  customMargin = 5,
  showCurrency = false,
  currencySymbol = 'Gs',
  priceColor = '#D92D20',
  showBorder = true,
  borderColor = 'white'
) {
  const arrayBuffer = await originalPdfFile.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  
  // Embed Helvetica Bold font
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // German locale outputs dot for thousands and has no decimals when decimals are configured to 0
  const formatter = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  
  const { r, g, b } = hexToRgb(priceColor);
  const outlineColor = borderColor === 'white' ? rgb(1, 1, 1) : rgb(0, 0, 0);
  
  // Process matches
  for (const match of matchedItems) {
    const pageIndex = match.pageNum - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    
    const page = pages[pageIndex];
    
    // Format: "150.000" (optionally with currency symbol, thousands separator dot, no decimals)
    const priceVal = parseFloat(match.price || 0);
    const formattedPrice = formatter.format(Math.round(priceVal));
    const priceText = showCurrency ? `${currencySymbol} ${formattedPrice}` : formattedPrice;
    
    // Use custom font size chosen by user
    const fontSize = customFontSize;
    
    // Measure text width using pdf-lib font utility
    const textWidth = font.widthOfTextAtSize(priceText, fontSize);
    
    let drawX = match.pdfX;
    let drawY = match.pdfY;
    
    // Position offset calculations (in PDF points, starting bottom-left)
    const margin = customMargin; // spacing in points
    
    const itemPosition = (match.position && match.position !== 'default') ? match.position : position;
    
    if (itemPosition === 'right') {
      drawX = match.pdfX + match.pdfWidth + margin;
      drawY = match.pdfY;
    } else if (itemPosition === 'left') {
      drawX = match.pdfX - textWidth - margin;
      drawY = match.pdfY;
    } else if (itemPosition === 'above') {
      // Center horizontally relative to the code, place above code height
      drawX = match.pdfX + (match.pdfWidth - textWidth) / 2;
      drawY = match.pdfY + match.pdfHeight + margin;
    } else if (itemPosition === 'below') {
      // Center horizontally relative to the code, place below baseline
      drawX = match.pdfX + (match.pdfWidth - textWidth) / 2;
      drawY = match.pdfY - fontSize - margin;
    }
    
    // If text outline / border is enabled, draw surrounding outline in border color for contrast
    if (showBorder) {
      const offsets = [
        [-0.6, 0], [0.6, 0], [0, -0.6], [0, 0.6],
        [-0.4, -0.4], [0.4, 0.4], [-0.4, 0.4], [0.4, -0.4]
      ];
      for (const [ox, oy] of offsets) {
        page.drawText(priceText, {
          x: drawX + ox,
          y: drawY + oy,
          size: fontSize,
          font: font,
          color: outlineColor
        });
      }
    }

    // Draw main price text directly in customized color on top
    page.drawText(priceText, {
      x: drawX,
      y: drawY,
      size: fontSize,
      font: font,
      color: rgb(r, g, b)
    });
  }
  
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

