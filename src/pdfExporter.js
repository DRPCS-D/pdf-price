import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Generates a new PDF by overlaying price badges next to the matched codes.
 * @param {File} originalPdfFile - The original PDF file uploaded by the user.
 * @param {Array<Object>} matchedItems - Array of matched items containing pdfX, pdfY, pageNum, price, etc.
 * @returns {Promise<Blob>} The generated PDF as a Blob.
 */
export async function exportAnnotatedPDF(originalPdfFile, matchedItems, position = 'right', customFontSize = 11) {
  const arrayBuffer = await originalPdfFile.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();
  
  // Embed Helvetica Bold font
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // German locale outputs dot for thousands and has no decimals when decimals are configured to 0
  const formatter = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  
  // Process matches
  for (const match of matchedItems) {
    const pageIndex = match.pageNum - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    
    const page = pages[pageIndex];
    
    // Format: "150.000" (no currency symbol, thousands separator dot, no decimals)
    const priceVal = parseFloat(match.price || 0);
    const priceText = formatter.format(Math.round(priceVal));
    
    // Use custom font size chosen by user
    const fontSize = customFontSize;
    
    // Measure text width using pdf-lib font utility
    const textWidth = font.widthOfTextAtSize(priceText, fontSize);
    
    let drawX = match.pdfX;
    let drawY = match.pdfY;
    
    // Position offset calculations (in PDF points, starting bottom-left)
    const margin = 5; // spacing in points
    
    if (position === 'right') {
      drawX = match.pdfX + match.pdfWidth + margin;
      drawY = match.pdfY;
    } else if (position === 'left') {
      drawX = match.pdfX - textWidth - margin;
      drawY = match.pdfY;
    } else if (position === 'above') {
      // Center horizontally relative to the code, place above code height
      drawX = match.pdfX + (match.pdfWidth - textWidth) / 2;
      drawY = match.pdfY + match.pdfHeight + margin;
    } else if (position === 'below') {
      // Center horizontally relative to the code, place below baseline
      drawX = match.pdfX + (match.pdfWidth - textWidth) / 2;
      drawY = match.pdfY - fontSize - margin;
    }
    
    // Draw price text directly in Red color, no background box
    page.drawText(priceText, {
      x: drawX,
      y: drawY,
      size: fontSize,
      font: font,
      color: rgb(0.85, 0.05, 0.05) // Rojo intenso
    });
  }
  
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

