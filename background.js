// Listen for clicks on the extension icon
chrome.action.onClicked.addListener((tab) => {
  // Check if the URL is a chrome:// URL
  if (tab.url.startsWith('chrome://')) {
    // Don't open the popup for chrome:// URLs
    return;
  }
  
  // For non-chrome:// URLs, open the popup
  chrome.action.setPopup({
    tabId: tab.id,
    popup: 'popup.html'
  });
});

// Reset popup when tab is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    if (tab.url.startsWith('chrome://')) {
      // Remove popup for chrome:// URLs
      chrome.action.setPopup({
        tabId: tabId,
        popup: ''
      });
    } else {
      // Set popup for regular URLs
      chrome.action.setPopup({
        tabId: tabId,
        popup: 'popup.html'
      });
    }
  }
}); 