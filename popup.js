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
