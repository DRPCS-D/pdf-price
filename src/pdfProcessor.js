import * as pdfjsLib from 'pdfjs-dist';

// Configurar el worker de PDF.js usando CDN cdnjs
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Loads a PDF document.
 * @param {File} file - The uploaded PDF file.
 * @returns {Promise<pdfjsLib.PDFDocumentProxy>} The loaded PDF document.
 */
export async function loadPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  return loadingTask.promise;
}

/**
 * Renders a PDF page to a canvas and returns the text matches found on it.
 * @param {pdfjsLib.PDFDocumentProxy} pdfDoc - The PDF document.
 * @param {number} pageNum - The page number to render (1-indexed).
 * @param {HTMLCanvasElement} canvas - The canvas to render onto.
 * @param {number} scale - The scale factor for rendering.
 * @param {Map<string, number>} excelPrices - The map of codes and prices to match.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of matched items on the page.
 */
export async function renderPageAndMatchCodes(pdfDoc, pageNum, canvas, scale, excelPrices) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  const ctx = canvas.getContext('2d');
  
  // Render PDF page into canvas context
  const renderContext = {
    canvasContext: ctx,
    viewport: viewport
  };
  await page.render(renderContext).promise;
  
  // Extract text content
  const textContent = await page.getTextContent();
  const matchedItems = [];
  
  // Create a copy of the list of codes in excel to search for
  const codesToSearch = Array.from(excelPrices.keys());
  
  for (const item of textContent.items) {
    if (!item.str || item.str.trim() === '') continue;
    
    const textStr = item.str.trim();
    let isMatched = false;
    let matchedCode = '';
    let matchedPrice = 0;
    
    // 1. Intentar buscar correspondencia con códigos de Excel
    for (const code of codesToSearch) {
      const cleanTextStr = textStr.toLowerCase();
      const cleanCode = code.toLowerCase();
      
      let isMatch = false;
      if (cleanTextStr === cleanCode) {
        isMatch = true;
      } else if (cleanTextStr.includes(cleanCode)) {
        if (code.length >= 4) {
          isMatch = true;
        } else {
          const regex = new RegExp(`\\b${escapeRegExp(cleanCode)}\\b`);
          isMatch = regex.test(cleanTextStr);
        }
      }
      
      if (isMatch) {
        isMatched = true;
        matchedCode = code;
        matchedPrice = excelPrices.get(code);
        break;
      }
    }
    
    // 2. Si no coincide, auto-detectar el patrón estándar de catálogo: 000-000-00
    if (!isMatched) {
      const catalogPattern = /\b\d{3}-\d{3}-\d{2}\b/;
      const matchPattern = textStr.match(catalogPattern);
      if (matchPattern) {
        isMatched = true;
        matchedCode = matchPattern[0];
        matchedPrice = excelPrices.get(matchedCode) || 0;
      }
    }
    
    if (isMatched) {
      // Convert PDF coordinates (item.transform) to viewport coordinates
      const tx = item.transform[4];
      const ty = item.transform[5];
      
      // convertToViewportPoint converts [x, y] in PDF space to [x, y] in Viewport space (top-left origin)
      const [x, y] = viewport.convertToViewportPoint(tx, ty);
      
      // We estimate the width of the matched text in viewport pixels
      const fontSize = Math.abs(item.transform[0]) * scale;
      const width = item.width * scale;
      const height = fontSize;

      matchedItems.push({
        code: matchedCode,
        matchedText: item.str,
        price: matchedPrice,
        // We store the original PDF coordinates (in PDF points) for export later
        pdfX: tx,
        pdfY: ty,
        pdfWidth: item.width,
        pdfHeight: Math.abs(item.transform[0]), // approximate height in PDF points
        // Viewport coordinates for display
        x: x,
        y: y,
        width: width,
        height: height,
        pageNum: pageNum
      });
    }
  }
  
  return matchedItems;
}

/**
 * Searches a specific code string across all PDF pages.
 * @param {pdfjsLib.PDFDocumentProxy} pdfDoc - The PDF document.
 * @param {string} code - The code to search.
 * @param {number} scale - Current rendering scale.
 * @returns {Promise<Array<Object>>} List of matched coordinates and metadata.
 */
export async function searchCodeInPDF(pdfDoc, code, scale) {
  const matches = [];
  const numPages = pdfDoc.numPages;
  const cleanCode = code.toLowerCase().trim();
  
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const textContent = await page.getTextContent();
    
    for (const item of textContent.items) {
      if (!item.str || item.str.trim() === '') continue;
      
      const textStr = item.str.trim();
      const cleanTextStr = textStr.toLowerCase();
      
      let isMatch = false;
      if (cleanTextStr === cleanCode) {
        isMatch = true;
      } else if (cleanTextStr.includes(cleanCode)) {
        if (cleanCode.length >= 4) {
          isMatch = true;
        } else {
          const regex = new RegExp(`\\b${escapeRegExp(cleanCode)}\\b`);
          isMatch = regex.test(cleanTextStr);
        }
      }
      
      if (isMatch) {
        const tx = item.transform[4];
        const ty = item.transform[5];
        const [x, y] = viewport.convertToViewportPoint(tx, ty);
        const fontSize = Math.abs(item.transform[0]) * scale;
        const width = item.width * scale;
        
        matches.push({
          code: code,
          matchedText: item.str,
          price: 0, // Default to 0, to be filled manually
          pdfX: tx,
          pdfY: ty,
          pdfWidth: item.width,
          pdfHeight: Math.abs(item.transform[0]),
          x: x,
          y: y,
          width: width,
          height: fontSize,
          pageNum: pageNum
        });
      }
    }
  }
  
  return matches;
}

/**
 * Escapes regex special characters.
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

