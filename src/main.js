import { parseExcelPrices } from './excelParser';
import { loadPDF, renderPageAndMatchCodes, searchCodeInPDF } from './pdfProcessor';
import { exportAnnotatedPDF } from './pdfExporter';

// State management
let state = {
  excelPrices: new Map(), // Map<code, price>
  pdfDocument: null,      // PDFDocumentProxy
  matchedItems: [],       // Array of matches across all pages
  zoom: 1.0,              // Current zoom scale
  pricePosition: 'right', // Price label position ('right', 'left', 'above', 'below')
  priceSize: 11,          // Default price font size in px
  priceMargin: 5,         // Default spacing in px/points
  showCurrency: true,     // Whether to show currency symbol
  currencySymbol: 'Gs',   // Currency symbol (default: 'Gs')
  priceColor: '#D92D20',  // Custom price color (default vibrant red)
  showBorder: true,       // Whether to show price text outline border
  borderColor: 'white',   // Price border color ('white' or 'black')
  originalPdfFile: null,
  originalExcelFile: null,
  isProcessing: false,
  selectedMatchIndex: -1  // Index in matchedItems for editing
};

// DOM Elements
const excelDropzone = document.getElementById('excel-dropzone');
const excelFileInput = document.getElementById('excel-file');
const excelFileName = document.getElementById('excel-file-name');

const pdfDropzone = document.getElementById('pdf-dropzone');
const pdfFileInput = document.getElementById('pdf-file');
const pdfFileName = document.getElementById('pdf-file-name');

const globalStatus = document.getElementById('global-status');
const statsPanel = document.getElementById('stats-panel');
const statExcelTotal = document.getElementById('stat-excel-total');
const statPdfDetected = document.getElementById('stat-pdf-detected');

const pricePositionSelect = document.getElementById('price-position');
const priceSizeSlider = document.getElementById('price-size');
const priceSizeValDisplay = document.getElementById('price-size-val');
const priceMarginSlider = document.getElementById('price-margin');
const priceMarginValDisplay = document.getElementById('price-margin-val');
const priceShowCurrencyCheckbox = document.getElementById('price-show-currency');
const priceCurrencySymbolInput = document.getElementById('price-currency-symbol');
const priceColorInput = document.getElementById('price-color');
const priceColorHexDisplay = document.getElementById('price-color-hex');
const priceShowBorderCheckbox = document.getElementById('price-show-border');
const priceBorderColorSelect = document.getElementById('price-border-color');
const codeSearchInput = document.getElementById('code-search');
const manualCodeInput = document.getElementById('manual-code');
const manualPriceInput = document.getElementById('manual-price');
const btnSavePrice = document.getElementById('btn-save-price');
const btnDownloadPdf = document.getElementById('btn-download-pdf');

const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnZoomFit = document.getElementById('btn-zoom-fit');
const zoomValueDisplay = document.getElementById('zoom-value');
const currentPageDisplay = document.getElementById('current-page');
const totalPagesDisplay = document.getElementById('total-pages');

const pdfScrollContainer = document.getElementById('pdf-scroll-container');
const viewerWelcome = document.getElementById('viewer-welcome-message');
const pdfPagesWrapper = document.getElementById('pdf-pages-wrapper');

const priceEditPopover = document.getElementById('price-edit-popover');
const popoverCodeDisplay = document.getElementById('popover-code');
const popoverPriceInput = document.getElementById('popover-price-input');
const popoverPositionSelect = document.getElementById('popover-position-select');
const btnPopoverCancel = document.getElementById('btn-popover-cancel');
const btnPopoverSave = document.getElementById('btn-popover-save');

const loadingOverlay = document.getElementById('loading-overlay');
const loadingOverlayText = document.getElementById('loading-overlay-text');

function showLoading(text) {
  loadingOverlayText.textContent = text;
  loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  loadingOverlay.classList.add('hidden');
}

// Formatting helper: "150.000" (thousands separator dot, no decimals)
const priceFormatter = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
function formatPrice(value) {
  return priceFormatter.format(Math.round(value || 0));
}

function getFormattedPriceText(value) {
  const formatted = formatPrice(value);
  if (state.showCurrency) {
    return `${state.currencySymbol} ${formatted}`;
  }
  return formatted;
}

// Initialize Events
document.addEventListener('DOMContentLoaded', () => {
  setupFileDropzones();
  setupManualForm();
  setupZoomControls();
  setupPopover();
  setupScrollTracking();
  setupSettings();
});

// 1. Settings & Price Placement Positioning / Sizing
function setupSettings() {
  // Set initial CSS variables
  document.documentElement.style.setProperty('--price-size', `${state.priceSize}px`);
  document.documentElement.style.setProperty('--price-margin', `${state.priceMargin * state.zoom}px`);
  document.documentElement.style.setProperty('--price-color', state.priceColor);
  updatePriceBorderCSS();

  pricePositionSelect.addEventListener('change', (e) => {
    state.pricePosition = e.target.value;
    if (state.pdfDocument) {
      updateStatus('Reposicionando etiquetas...', 'loading');
      redrawAllOverlays();
      updateStatus('Etiquetas reposicionadas', 'success');
    }
  });

  priceSizeSlider.addEventListener('input', (e) => {
    const newSize = parseInt(e.target.value);
    state.priceSize = newSize;
    priceSizeValDisplay.textContent = newSize;
    document.documentElement.style.setProperty('--price-size', `${newSize}px`);
  });

  priceMarginSlider.addEventListener('input', (e) => {
    const newMargin = parseInt(e.target.value);
    state.priceMargin = newMargin;
    priceMarginValDisplay.textContent = newMargin;
    document.documentElement.style.setProperty('--price-margin', `${newMargin * state.zoom}px`);
  });

  priceShowCurrencyCheckbox.addEventListener('change', (e) => {
    state.showCurrency = e.target.checked;
    if (state.pdfDocument) {
      redrawAllOverlays();
    }
  });

  priceCurrencySymbolInput.addEventListener('input', (e) => {
    state.currencySymbol = e.target.value;
    if (state.pdfDocument) {
      redrawAllOverlays();
    }
  });

  priceColorInput.addEventListener('input', (e) => {
    const newColor = e.target.value;
    state.priceColor = newColor;
    priceColorHexDisplay.textContent = newColor.toUpperCase();
    document.documentElement.style.setProperty('--price-color', newColor);
  });

  priceShowBorderCheckbox.addEventListener('change', (e) => {
    state.showBorder = e.target.checked;
    updatePriceBorderCSS();
    if (state.pdfDocument) {
      redrawAllOverlays();
    }
  });

  priceBorderColorSelect.addEventListener('change', (e) => {
    state.borderColor = e.target.value;
    updatePriceBorderCSS();
    if (state.pdfDocument) {
      redrawAllOverlays();
    }
  });
}

function updatePriceBorderCSS() {
  if (!state.showBorder) {
    document.documentElement.style.setProperty('--price-text-shadow', 'none');
  } else if (state.borderColor === 'white') {
    document.documentElement.style.setProperty(
      '--price-text-shadow',
      '-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, 0px 1px 2px rgba(0, 0, 0, 0.15)'
    );
  } else {
    document.documentElement.style.setProperty(
      '--price-text-shadow',
      '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0px 1px 2px rgba(255, 255, 255, 0.15)'
    );
  }
}

function redrawAllOverlays() {
  const pages = pdfPagesWrapper.querySelectorAll('.pdf-page-container');
  pages.forEach(pageContainer => {
    const pageNum = parseInt(pageContainer.getAttribute('data-page-number'));
    const overlay = pageContainer.querySelector('.price-overlay-layer');
    const matchesOnPage = state.matchedItems.filter(item => item.pageNum === pageNum);
    drawPriceBadges(overlay, matchesOnPage, pageNum);
  });
}

// 2. File Upload & Dropzone Handling
function setupFileDropzones() {
  // Excel Dropzone events
  excelDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!state.isProcessing) excelDropzone.style.borderColor = 'var(--accent-primary)';
  });

  excelDropzone.addEventListener('dragleave', () => {
    excelDropzone.style.borderColor = '';
  });

  excelDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    if (state.isProcessing) return;
    excelDropzone.style.borderColor = '';
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleExcelFile(files[0]);
    }
  });

  excelFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleExcelFile(e.target.files[0]);
    }
  });

  // PDF Dropzone events
  pdfDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!state.isProcessing && !pdfDropzone.classList.contains('disabled')) {
      pdfDropzone.style.borderColor = 'var(--accent-primary)';
    }
  });

  pdfDropzone.addEventListener('dragleave', () => {
    pdfDropzone.style.borderColor = '';
  });

  pdfDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    if (state.isProcessing || pdfDropzone.classList.contains('disabled')) return;
    pdfDropzone.style.borderColor = '';
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handlePDFFile(files[0]);
    }
  });

  pdfFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handlePDFFile(e.target.files[0]);
    }
  });
}

async function handleExcelFile(file) {
  showLoading('Cargando base de datos de precios (Excel)...');
  updateStatus('Cargando Excel...', 'loading');
  state.isProcessing = true;
  
  setTimeout(async () => {
    try {
      const pricesMap = await parseExcelPrices(file);
      state.excelPrices = pricesMap;
      state.originalExcelFile = file;
      
      // UI Update
      excelDropzone.classList.add('success-loaded');
      excelFileName.textContent = file.name;
      
      // Enable PDF Upload
      pdfDropzone.classList.remove('disabled');
      pdfFileInput.removeAttribute('disabled');
      
      // Update Stats
      statExcelTotal.textContent = pricesMap.size;
      statsPanel.classList.remove('hidden');
      
      updateStatus('Excel cargado. Suba el PDF.', 'success');
    } catch (error) {
      updateStatus(error.message, 'idle');
      alert(error.message);
    } finally {
      state.isProcessing = false;
      hideLoading();
    }
  }, 100);
}

async function handlePDFFile(file) {
  showLoading('Cargando PDF y buscando códigos...');
  updateStatus('Cargando PDF y buscando códigos...', 'loading');
  state.isProcessing = true;
  state.originalPdfFile = file;
  pdfFileName.textContent = file.name;
  pdfDropzone.classList.add('success-loaded');

  setTimeout(async () => {
    try {
      // Load PDF Document
      state.pdfDocument = await loadPDF(file);
      totalPagesDisplay.textContent = state.pdfDocument.numPages;
      currentPageDisplay.textContent = '1';

      // Clear previous viewer state
      pdfPagesWrapper.innerHTML = '';
      viewerWelcome.classList.add('hidden');
      state.matchedItems = [];

      // Render pages and find matches
      await renderAllPages();
      
      // Enable other controls
      codeSearchInput.removeAttribute('disabled');
      btnDownloadPdf.removeAttribute('disabled');
      btnZoomIn.removeAttribute('disabled');
      btnZoomOut.removeAttribute('disabled');
      btnZoomFit.removeAttribute('disabled');

      // Show stats
      statsPanel.classList.remove('hidden');
      updateMatchedStats();
      
      updateStatus('Catálogo procesado con éxito', 'success');
    } catch (error) {
      updateStatus('Error al cargar PDF', 'idle');
      console.error(error);
      alert('Error al procesar el PDF: ' + error.message);
    } finally {
      state.isProcessing = false;
      hideLoading();
    }
  }, 100);
}

function updateStatus(text, type) {
  globalStatus.textContent = text;
  globalStatus.className = `status-badge ${type}`;
}

function updateMatchedStats() {
  const uniqueMatchedCodes = new Set(state.matchedItems.map(item => item.code));
  statPdfDetected.textContent = uniqueMatchedCodes.size;
}

// 3. Rendering the PDF catalog
async function renderAllPages() {
  if (!state.pdfDocument) return;
  
  pdfPagesWrapper.innerHTML = '';
  const numPages = state.pdfDocument.numPages;
  
  // Clear match coordinates, we will recalculate on render
  state.matchedItems = [];
  
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    // Create DOM structure for the page
    const pageContainer = document.createElement('div');
    pageContainer.className = 'pdf-page-container';
    pageContainer.setAttribute('data-page-number', pageNum);
    
    const canvas = document.createElement('canvas');
    const overlay = document.createElement('div');
    overlay.className = 'price-overlay-layer';
    
    pageContainer.appendChild(canvas);
    pageContainer.appendChild(overlay);
    pdfPagesWrapper.appendChild(pageContainer);
    
    // Render page and match codes
    const matchesOnPage = await renderPageAndMatchCodes(
      state.pdfDocument,
      pageNum,
      canvas,
      state.zoom,
      state.excelPrices
    );
    
    // Add matches to state
    state.matchedItems.push(...matchesOnPage);
    
    // Draw price overlays on the page
    drawPriceBadges(overlay, matchesOnPage, pageNum);
  }
  
  // Update UI search autocomplete or bindings
  setupSearchAutocomplete();
}

function drawPriceBadges(overlayElement, matches, pageNum) {
  overlayElement.innerHTML = '';
  
  matches.forEach(match => {
    const pos = (match.position && match.position !== 'default') ? match.position : state.pricePosition;
    const badge = document.createElement('div');
    badge.className = `price-badge pos-${pos}`;
    
    // Position base coordinates in pixels (for browser display, margin is added via CSS transforms)
    let left = match.x;
    let top = match.y;
    
    if (pos === 'right') {
      left = match.x + match.width;
      top = match.y - match.height / 2;
    } else if (pos === 'left') {
      left = match.x;
      top = match.y - match.height / 2;
    } else if (pos === 'above') {
      left = match.x + match.width / 2;
      top = match.y - match.height;
    } else if (pos === 'below') {
      left = match.x + match.width / 2;
      top = match.y;
    }
    
    badge.style.left = `${left}px`;
    badge.style.top = `${top}px`;
    
    // Format price according to settings
    badge.textContent = getFormattedPriceText(match.price);
    
    badge.setAttribute('data-code', match.code);
    badge.setAttribute('title', `Código: ${match.code}\nHaz clic para editar`);
    
    // Click event to edit price
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      openPopover(badge, match);
    });
    
    overlayElement.appendChild(badge);
  });
}

// 4. Zoom Controls
function setupZoomControls() {
  btnZoomIn.addEventListener('click', () => {
    if (state.zoom < 3.0) {
      state.zoom = parseFloat((state.zoom + 0.2).toFixed(1));
      applyZoom();
    }
  });

  btnZoomOut.addEventListener('click', () => {
    if (state.zoom > 0.6) {
      state.zoom = parseFloat((state.zoom - 0.2).toFixed(1));
      applyZoom();
    }
  });

  btnZoomFit.addEventListener('click', () => {
    // Fit to width calculation
    if (!state.pdfDocument) return;
    const containerWidth = pdfScrollContainer.clientWidth - 48; // padding
    
    // Get first page width to estimate scale
    state.pdfDocument.getPage(1).then(page => {
      const viewport = page.getViewport({ scale: 1.0 });
      state.zoom = parseFloat((containerWidth / viewport.width).toFixed(2));
      applyZoom();
    });
  });
}

async function applyZoom() {
  zoomValueDisplay.textContent = `${Math.round(state.zoom * 100)}%`;
  document.documentElement.style.setProperty('--price-margin', `${state.priceMargin * state.zoom}px`);
  showLoading('Redimensionando visor y re-ajustando catálogo...');
  updateStatus('Redimensionando páginas...', 'loading');
  
  setTimeout(async () => {
    try {
      // Render pages at the new scale
      await renderAllPages();
      updateStatus('Visualización actualizada', 'success');
    } catch (err) {
      console.error(err);
    } finally {
      hideLoading();
    }
  }, 100);
}

// 5. Popover / Quick Edit modal
function setupPopover() {
  btnPopoverCancel.addEventListener('click', closePopover);
  
  btnPopoverSave.addEventListener('click', () => {
    const newPrice = parseFloat(popoverPriceInput.value);
    if (isNaN(newPrice) || newPrice < 0) {
      alert('Por favor ingrese un precio válido.');
      return;
    }
    
    const newPos = popoverPositionSelect.value;
    saveMatchPrice(state.selectedMatchIndex, newPrice, newPos);
    closePopover();
  });

  // Bind directional arrow buttons
  const arrowButtons = priceEditPopover.querySelectorAll('.btn-arrow');
  arrowButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetPos = btn.getAttribute('data-pos');
      popoverPositionSelect.value = targetPos;
      updateArrowButtonsActiveState(targetPos);
      const newPrice = parseFloat(popoverPriceInput.value) || 0;
      saveMatchPrice(state.selectedMatchIndex, newPrice, targetPos);
    });
  });

  popoverPositionSelect.addEventListener('change', (e) => {
    updateArrowButtonsActiveState(e.target.value);
    const newPrice = parseFloat(popoverPriceInput.value) || 0;
    saveMatchPrice(state.selectedMatchIndex, newPrice, e.target.value);
  });

  // Close popover if clicked outside
  document.addEventListener('click', (e) => {
    if (!priceEditPopover.contains(e.target) && !e.target.classList.contains('price-badge')) {
      closePopover();
    }
  });
}

function updateArrowButtonsActiveState(currentPos) {
  const pos = currentPos || 'default';
  const arrowButtons = priceEditPopover.querySelectorAll('.btn-arrow');
  arrowButtons.forEach(btn => {
    if (btn.getAttribute('data-pos') === pos) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function openPopover(badgeElement, match) {
  // Find index in main state array
  const matchIndex = state.matchedItems.findIndex(
    item => item.code === match.code && item.pageNum === match.pageNum && item.pdfX === match.pdfX
  );
  
  state.selectedMatchIndex = matchIndex;
  
  popoverCodeDisplay.textContent = `Código: ${match.code} (Pág. ${match.pageNum})`;
  popoverPriceInput.value = Math.round(match.price || 0);
  const currentPos = match.position || 'default';
  popoverPositionSelect.value = currentPos;
  updateArrowButtonsActiveState(currentPos);
  
  // Highlight badge
  document.querySelectorAll('.price-badge').forEach(b => b.classList.remove('selected'));
  badgeElement.classList.add('selected');
  
  // Position popover
  const badgeRect = badgeElement.getBoundingClientRect();
  priceEditPopover.classList.remove('hidden');
  
  const popoverWidth = priceEditPopover.offsetWidth;
  const popoverHeight = priceEditPopover.offsetHeight;
  
  // Center above badge, or below if it overflows window
  let top = badgeRect.top + window.scrollY - popoverHeight - 8;
  if (top < 0) {
    top = badgeRect.bottom + window.scrollY + 8;
  }
  
  let left = badgeRect.left + window.scrollX + (badgeRect.width / 2) - (popoverWidth / 2);
  // Boundary check left/right
  if (left < 10) left = 10;
  if (left + popoverWidth > window.innerWidth - 10) {
    left = window.innerWidth - popoverWidth - 10;
  }
  
  priceEditPopover.style.top = `${top}px`;
  priceEditPopover.style.left = `${left}px`;
  
  setTimeout(() => popoverPriceInput.focus(), 50);
}

function closePopover() {
  priceEditPopover.classList.add('hidden');
  document.querySelectorAll('.price-badge').forEach(b => b.classList.remove('selected'));
  state.selectedMatchIndex = -1;
}

function saveMatchPrice(matchIndex, newPrice, newPosition = null) {
  if (matchIndex === -1 || matchIndex >= state.matchedItems.length) return;
  
  const match = state.matchedItems[matchIndex];
  
  // Update price globally in the Excel database map
  state.excelPrices.set(match.code, newPrice);
  
  if (newPosition) {
    match.position = newPosition;
  }

  // Update price in all matches for this code
  state.matchedItems.forEach((item) => {
    if (item.code === match.code) {
      item.price = newPrice;
    }
  });

  // Re-draw overlays so position change is rendered
  redrawAllOverlays();

  // Update sidebar forms if matching current code
  if (manualCodeInput.value.trim() === match.code) {
    manualPriceInput.value = Math.round(newPrice);
  }
  
  updateMatchedStats();
  updateStatus('Precio y posición actualizados', 'success');
}

// 6. Search & Manual Entry Form
function setupManualForm() {
  manualCodeInput.addEventListener('input', () => {
    const code = manualCodeInput.value.trim();
    if (code) {
      btnSavePrice.removeAttribute('disabled');
      // If code is in database, load price to facilitate editing
      if (state.excelPrices.has(code)) {
        manualPriceInput.value = Math.round(state.excelPrices.get(code));
      } else {
        manualPriceInput.value = '';
      }
    } else {
      btnSavePrice.setAttribute('disabled', 'true');
    }
  });

  btnSavePrice.addEventListener('click', () => {
    const code = manualCodeInput.value.trim();
    const price = parseFloat(manualPriceInput.value);
    
    if (!code) return;
    if (isNaN(price) || price < 0) {
      alert('Por favor ingrese un precio válido.');
      return;
    }
    
    // 1. Update in local Excel database
    state.excelPrices.set(code, price);
    statExcelTotal.textContent = state.excelPrices.size;

    // 2. Check if code exists in PDF matched items
    let matchesFound = false;
    state.matchedItems.forEach(item => {
      if (item.code.toLowerCase() === code.toLowerCase()) {
        item.price = price;
        matchesFound = true;
        
        // Update DOM overlay badge
        const pageContainer = document.querySelector(`.pdf-page-container[data-page-number="${item.pageNum}"]`);
        if (pageContainer) {
          const badges = pageContainer.querySelectorAll(`.price-badge[data-code="${item.code}"]`);
          badges.forEach(badge => {
            badge.textContent = getFormattedPriceText(price);
          });
        }
      }
    });

    if (matchesFound) {
      updateStatus(`Precio de '${code}' actualizado en PDF`, 'success');
      scrollToCode(code);
    } else {
      // If not found in current overlay badges, search PDF dynamically
      updateStatus(`Buscando '${code}' en el PDF...`, 'loading');
      searchCodeInPDF(state.pdfDocument, code, state.zoom).then(pdfMatches => {
        if (pdfMatches.length > 0) {
          pdfMatches.forEach(item => {
            item.price = price;
            state.matchedItems.push(item);
            
            // Draw new badge on page
            const pageContainer = document.querySelector(`.pdf-page-container[data-page-number="${item.pageNum}"]`);
            if (pageContainer) {
              const overlay = pageContainer.querySelector('.price-overlay-layer');
              const matchesOnPage = state.matchedItems.filter(m => m.pageNum === item.pageNum);
              drawPriceBadges(overlay, matchesOnPage, item.pageNum);
            }
          });
          updateStatus(`Código '${code}' encontrado en PDF y precio asignado`, 'success');
          scrollToCode(code);
        } else {
          updateStatus(`Código '${code}' guardado (no encontrado en PDF)`, 'success');
        }
        updateMatchedStats();
      });
    }
    
    // Clean input
    manualCodeInput.value = '';
    manualPriceInput.value = '';
    btnSavePrice.setAttribute('disabled', 'true');
  });

  // Export PDF Button
  btnDownloadPdf.addEventListener('click', async () => {
    if (!state.originalPdfFile || state.matchedItems.length === 0) return;
    
    showLoading('Generando catálogo PDF con precios anotados...');
    updateStatus('Generando catálogo PDF...', 'loading');
    btnDownloadPdf.setAttribute('disabled', 'true');

    setTimeout(async () => {
      try {
        const annotatedBlob = await exportAnnotatedPDF(
          state.originalPdfFile,
          state.matchedItems,
          state.pricePosition,
          state.priceSize,
          state.priceMargin,
          state.showCurrency,
          state.currencySymbol,
          state.priceColor,
          state.showBorder,
          state.borderColor
        );
        
        // Trigger download
        const url = URL.createObjectURL(annotatedBlob);
        const a = document.createElement('a');
        a.href = url;
        
        // Append "_precios" to original file name
        const origName = state.originalPdfFile.name;
        const extensionIdx = origName.lastIndexOf('.');
        const newName = origName.substring(0, extensionIdx) + '_precios.pdf';
        
        a.download = newName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        updateStatus('Descarga completada', 'success');
      } catch (err) {
        console.error(err);
        updateStatus('Error al exportar PDF', 'idle');
        alert('Error al exportar el catálogo PDF: ' + err.message);
      } finally {
        btnDownloadPdf.removeAttribute('disabled');
        hideLoading();
      }
    }, 100);
  });
}

// 7. Search Autocomplete & Navigation
function setupSearchAutocomplete() {
  codeSearchInput.addEventListener('input', () => {
    const query = codeSearchInput.value.toLowerCase().trim();
    if (!query) {
      removeSearchDropdown();
      return;
    }
    
    // Filter existing matches first
    let matches = state.matchedItems.filter(item => 
      item.code.toLowerCase().includes(query)
    );
    
    // If no match found in existing matchedItems, check PDF text directly!
    if (matches.length === 0 && query.length >= 4 && state.pdfDocument) {
      searchCodeInPDF(state.pdfDocument, codeSearchInput.value, state.zoom).then(pdfMatches => {
        if (pdfMatches.length > 0) {
          renderSearchDropdown(pdfMatches.slice(0, 8));
        } else {
          removeSearchDropdown();
        }
      });
    } else {
      // Group matches to show unique codes
      const uniqueMatches = [];
      const seen = new Set();
      matches.forEach(item => {
        if (!seen.has(item.code)) {
          seen.add(item.code);
          uniqueMatches.push(item);
        }
      });
      renderSearchDropdown(uniqueMatches.slice(0, 8));
    }
  });

  // Close search dropdown on click outside
  document.addEventListener('click', (e) => {
    if (!codeSearchInput.contains(e.target) && !e.target.closest('.search-dropdown')) {
      removeSearchDropdown();
    }
  });
}

function renderSearchDropdown(items) {
  removeSearchDropdown();
  
  if (items.length === 0) return;
  
  const dropdown = document.createElement('div');
  dropdown.className = 'search-dropdown';
  
  // Position it right below search input
  dropdown.style.position = 'absolute';
  dropdown.style.width = `${codeSearchInput.offsetWidth}px`;
  dropdown.style.top = `${codeSearchInput.offsetTop + codeSearchInput.offsetHeight + 4}px`;
  dropdown.style.left = `${codeSearchInput.offsetLeft}px`;
  
  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'search-dropdown-item';
    
    const existingMatch = state.matchedItems.find(m => m.code.toLowerCase() === item.code.toLowerCase());
    const displayPrice = existingMatch ? existingMatch.price : (state.excelPrices.get(item.code) || 0);
    
    el.innerHTML = `
      <span class="search-item-code">${item.code}</span>
      <span class="search-item-info">Pág. ${item.pageNum} - ${displayPrice > 0 ? getFormattedPriceText(displayPrice) : 'Sin precio'}</span>
    `;
    
    el.addEventListener('click', () => {
      codeSearchInput.value = item.code;
      
      // If not in main matchedItems state list, register it
      const exists = state.matchedItems.some(existing => 
        existing.code.toLowerCase() === item.code.toLowerCase() && 
        existing.pageNum === item.pageNum && 
        existing.pdfX === item.pdfX
      );
      
      if (!exists) {
        if (state.excelPrices.has(item.code)) {
          item.price = state.excelPrices.get(item.code);
        }
        state.matchedItems.push(item);
        
        // Append badge in DOM
        const pageContainer = document.querySelector(`.pdf-page-container[data-page-number="${item.pageNum}"]`);
        if (pageContainer) {
          const overlay = pageContainer.querySelector('.price-overlay-layer');
          const matchesOnPage = state.matchedItems.filter(m => m.pageNum === item.pageNum);
          drawPriceBadges(overlay, matchesOnPage, item.pageNum);
        }
      }
      
      scrollToCode(item.code);
      removeSearchDropdown();
      
      // Load in manual form for quick edit
      manualCodeInput.value = item.code;
      const currentPriceVal = displayPrice || state.excelPrices.get(item.code) || 0;
      manualPriceInput.value = currentPriceVal > 0 ? Math.round(currentPriceVal) : '';
      btnSavePrice.removeAttribute('disabled');
      
      // Open popover directly on the newly created badge
      setTimeout(() => {
        const pageContainer = document.querySelector(`.pdf-page-container[data-page-number="${item.pageNum}"]`);
        if (pageContainer) {
          const badge = pageContainer.querySelector(`.price-badge[data-code="${item.code}"]`);
          if (badge) {
            const currentMatch = state.matchedItems.find(m => 
              m.code.toLowerCase() === item.code.toLowerCase() && 
              m.pageNum === item.pageNum && 
              m.pdfX === item.pdfX
            );
            openPopover(badge, currentMatch || item);
          }
        }
      }, 600); // Wait for scroll to start/finish
    });
    
    dropdown.appendChild(el);
  });
  
  codeSearchInput.parentNode.appendChild(dropdown);
}

function removeSearchDropdown() {
  const existing = document.querySelector('.search-dropdown');
  if (existing) existing.remove();
}

function scrollToCode(code) {
  // Find first match of this code
  const firstMatch = state.matchedItems.find(item => item.code.toLowerCase() === code.toLowerCase());
  if (!firstMatch) return;
  
  const pageContainer = document.querySelector(`.pdf-page-container[data-page-number="${firstMatch.pageNum}"]`);
  if (!pageContainer) return;
  
  // Scroll page container into view
  pageContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
  // Highlight the badge on the page
  setTimeout(() => {
    const badge = pageContainer.querySelector(`.price-badge[data-code="${firstMatch.code}"]`);
    if (badge) {
      badge.classList.add('selected');
      
      // Temporary scaling for focus
      const currentClassName = badge.className;
      badge.style.transform = getFocusTransform(state.pricePosition);
      badge.style.color = '#10B981'; // Green accent flash
      
      setTimeout(() => {
        badge.style.transform = '';
        badge.style.color = '';
        badge.classList.remove('selected');
      }, 2500);
    }
  }, 500);
}

function getFocusTransform(position) {
  if (position === 'right') return 'translate(0, -50%) scale(1.4)';
  if (position === 'left') return 'translate(-100%, -50%) scale(1.4)';
  if (position === 'above') return 'translate(-50%, -100%) scale(1.4)';
  return 'translate(-50%, 0) scale(1.4)';
}

// 8. Scroll Tracking to update current page
function setupScrollTracking() {
  pdfScrollContainer.addEventListener('scroll', () => {
    if (!state.pdfDocument) return;
    
    const pages = pdfPagesWrapper.querySelectorAll('.pdf-page-container');
    const containerTop = pdfScrollContainer.getBoundingClientRect().top;
    
    let closestPage = 1;
    let minDistance = Infinity;
    
    pages.forEach(page => {
      const pageRect = page.getBoundingClientRect();
      const distance = Math.abs(pageRect.top - containerTop);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestPage = parseInt(page.getAttribute('data-page-number') || '1');
      }
    });
    
    currentPageDisplay.textContent = closestPage;
  });
}
