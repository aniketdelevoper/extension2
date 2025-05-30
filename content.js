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
