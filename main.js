
// --- theme.js ---
// Theme management
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

function getTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
}

// Initialize theme
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    
    if (savedTheme) {
        setTheme(savedTheme);
    } else if (prefersDark.matches) {
        setTheme('dark');
    }

    // Theme toggle button
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', () => {
        const currentTheme = getTheme();
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    });

    // Listen for system theme changes
    prefersDark.addListener((e) => {
        if (!localStorage.getItem('theme')) {
            setTheme(e.matches ? 'dark' : 'light');
        }
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initTheme);


// --- loader.js ---
// Loader functionality for PDF to Excel Converter
(function() {
    function setupLoaderHandlers() {
        const cssLoader = document.getElementById('cssLoader');
        const spinner = document.getElementById('spinner');
        const blurOverlay = document.getElementById('blurOverlay');
        const demoBtn = document.getElementById('demoBtn');

        // Observer for spinner display changes
        if (spinner && cssLoader) {
            const observer = new MutationObserver(() => {
                if (spinner.style.display !== 'none') {
                    cssLoader.style.display = 'block';
                } else {
                    cssLoader.style.display = 'none';
                }
            });
            observer.observe(spinner, { attributes: true, attributeFilter: ['style'] });
        }

        // Blur overlay handling
        if (demoBtn) {
            demoBtn.addEventListener('click', () => {
                blurOverlay.classList.add('active');
            });
        }

        // Processing events
        window.addEventListener('processing-start', () => {
            if (blurOverlay) {
                blurOverlay.classList.add('active');
                startSmoothProgress();
            }
        });
        
        window.addEventListener('processing-end', () => {
            if (blurOverlay) {
                stopSmoothProgress();
                blurOverlay.classList.remove('active');
            }
        });

        // Smooth progress animation
        let progressInterval;
        const dots = document.querySelectorAll('.dot');
        
        function startSmoothProgress() {
            let currentDot = 0;
            dots.forEach(dot => dot.classList.remove('active'));
            
            progressInterval = setInterval(() => {
                dots.forEach(dot => dot.classList.remove('active'));
                dots[currentDot].classList.add('active');
                currentDot = (currentDot + 1) % dots.length;
            }, 600);
        }
        
        function stopSmoothProgress() {
            clearInterval(progressInterval);
            dots.forEach(dot => dot.classList.add('active'));
        }
    }

    // Wait for DOM to be ready and setup handlers
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', setupLoaderHandlers);
    } else {
        setupLoaderHandlers();
    }
})();


// --- popup.js ---
document.getElementById('demoBtn').addEventListener('click', function() {
  const statusElement = document.getElementById('status');
  const blurOverlay = document.getElementById('blurOverlay');
  const processingText = document.querySelector('.processing-text');
  const fileNameInput = document.getElementById('fileNameInput');
  
  console.log('Button clicked, starting Excel conversion...');
  
  // Show processing overlay
  blurOverlay.classList.add('active');
  
  let processingSteps = [
    "Analyzing PDF content",
    "Preparing Excel file",
  ];

  let currentStep = 0;
  const updateText = setInterval(() => {
    if (currentStep < processingSteps.length) {
      processingText.textContent = processingSteps[currentStep];
      currentStep++;
    } else {
      clearInterval(updateText);
    }
  }, 1000);

  // Instead of just using ExcelJS, let's try the simpler XLSX library first
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs.length === 0) {
      statusElement.textContent = 'Error: No active tab found.';
      blurOverlay.classList.remove('active');
      clearInterval(updateText);
      return;
    }
    
    console.log('Active tab found, checking URL...');
    
    if (tabs[0].url.startsWith('chrome://') || tabs[0].url.startsWith('edge://')) {
      statusElement.textContent = 'Extension cannot run on browser system pages';
      statusElement.className = 'status error-message';
      blurOverlay.classList.remove('active');
      clearInterval(updateText);
      return;
    }

    const targetUrl = 'https://www.repotic.in/pdftotally';
    if (!tabs[0].url.toLowerCase().includes(targetUrl.toLowerCase())) {
      statusElement.textContent = 'Please visit www.repotic.in/pdftotally to use this extension';
      statusElement.className = 'status error-message';
      blurOverlay.classList.remove('active');
      clearInterval(updateText);
      return;
    }

    console.log('Injecting content script...');
    
    // Inject content script
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ['content.js']
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Content script injection error:', chrome.runtime.lastError);
        statusElement.textContent = 'Error: ' + chrome.runtime.lastError.message;
        statusElement.className = 'status error-message';
        blurOverlay.classList.remove('active');
        clearInterval(updateText);
        return;
      }

      console.log('Content script injected, requesting table data...');
      
      // Send message to content script
      chrome.tabs.sendMessage(tabs[0].id, { action: 'extractTable' });
    });
  });

  // Listen for table data from content script
  chrome.runtime.onMessage.addListener(function handler(request, sender, sendResponse) {
    console.log('Message received:', request);

    if (request.action === 'extractData') {
      chrome.runtime.onMessage.removeListener(handler);
      
      if (request.error) {
        console.error('Content script error:', request.error);
        statusElement.textContent = 'Error: ' + request.error;
        blurOverlay.classList.remove('active');
        clearInterval(updateText);
        return;
      }

      const data = request.data;
      console.log('Table data received:', data);

      if (!Array.isArray(data) || data.length === 0) {
        console.error('Invalid data received');
        statusElement.textContent = 'Error: No valid table data found';
        statusElement.className = 'status error-message';
        blurOverlay.classList.remove('active');
        clearInterval(updateText);
        return;
      }

      try {
        // First find the Action column index from the header row
        const headerRow = data[0];
        const actionColumnIndex = headerRow.findIndex(cell => 
          cell && typeof cell === 'string' && cell.trim().toLowerCase() === 'action'
        );

        // Remove Action column from all rows
        const processedData = data.map(row => {
          return row.filter((_, index) => index !== actionColumnIndex);
        });

        console.log('Processed data (Action column removed):', processedData);

        // Use XLSX with processed data
        const ws = XLSX.utils.aoa_to_sheet(processedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

        // Generate filename
        let fileName = fileNameInput.value.trim();
        if (!fileName) {
          const now = new Date();
          const day = String(now.getDate()).padStart(2, '0');
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const year = now.getFullYear();
          const hours = String(now.getHours()).padStart(2, '0');
          const minutes = String(now.getMinutes()).padStart(2, '0');
          
          fileName = `BANK_STATEMENT_${day}-${month}-${year}_${hours}-${minutes}`;
        }
        fileName = fileName.replace(/[^a-z0-9\-_]/gi, '_');

        // Convert to blob
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        console.log('Excel file created, attempting download...');

        // Try downloading using chrome.downloads API
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({
          url: url,
          filename: `${fileName}.xlsx`,
          saveAs: true
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error('Download API error:', chrome.runtime.lastError);
            statusElement.textContent = 'Error: ' + chrome.runtime.lastError.message;
            statusElement.className = 'status error-message';
          } else {
            console.log('Download initiated:', downloadId);
            statusElement.textContent = 'Successfully converted and downloaded!';
            statusElement.className = 'status success-message';
          }
          URL.revokeObjectURL(url);
          blurOverlay.classList.remove('active');
          clearInterval(updateText);
        });

      } catch (error) {
        console.error('Excel generation error:', error);
        statusElement.textContent = 'Error: ' + (error.message || 'Failed to generate Excel file');
        statusElement.className = 'status error-message';
        blurOverlay.classList.remove('active');
        clearInterval(updateText);
      }
    }
  });
});


// --- content.js ---
// Content script for PDF Table to Excel Converter
// Extracts table data and sends it to the popup as plain array (no formatting)
(function() {
  function extractTableData() {
    const tables = document.querySelectorAll('table');
    if (!tables.length) {
      chrome.runtime.sendMessage({ action: 'extractData', error: 'No tables found on this page.' });
      return;
    }
    // Only extract the first table for simplicity (can be extended)
    const table = tables[0];
    const rows = Array.from(table.rows);
    const data = rows.map(row => Array.from(row.cells).map(cell => cell.textContent.trim()));
    chrome.runtime.sendMessage({ action: 'extractData', data });
  }

  // Listen for a message from the popup to start extraction
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'extractTable') {
      extractTableData();
    }
  });

  // Notify popup that content script is ready
  chrome.runtime.sendMessage({ action: 'contentScriptReady' });
})();

