// Enhanced background.js with debugging and improved functionality

console.log('MetaPeek background script loaded');

// Improved listener for extension icon clicks
chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked for tab:', tab.url);
  
  // Check if the URL is a chrome:// URL
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
    console.log('Special URL detected, showing notification');
    chrome.action.setPopup({ popup: '' });
    
    // Show a notification or open help page instead
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'MetaPeek',
      message: 'MetaPeek cannot analyze browser system pages. Please try it on a regular website.',
      priority: 1
    });
    
    return;
  }
  
  console.log('Setting popup for tab:', tab.id);
  // For non-special URLs, open the popup
  chrome.action.setPopup({
    tabId: tab.id,
    popup: 'popup.html'
  });
});

// Enhanced tab update handler
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    console.log('Tab update complete:', tab.url);
    
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
      console.log('Special URL detected, removing popup for tab:', tabId);
      // Remove popup for special URLs
      chrome.action.setPopup({
        tabId: tabId,
        popup: ''
      });
    } else {
      console.log('Regular URL detected, setting popup for tab:', tabId);
      // Set popup for regular URLs
      chrome.action.setPopup({
        tabId: tabId,
        popup: 'popup.html'
      });
    }
  }
});

// Add a listener for runtime errors
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed or updated:', details.reason);
  
  if (details.reason === 'install') {
    // Open a welcome page on first install
    chrome.tabs.create({
      url: 'https://github.com/masoudtahsiri/metapeek#readme'
    });
  }
});

// Listen for content script communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message.type);
  
  if (message.type === 'metadataUpdated') {
    console.log('Metadata updated for tab:', sender.tab?.id);
    // We could store this in extension storage for faster access
    // when popup opens
    
    sendResponse({ received: true });
  }
  
  return true; // Keep message channel open for async responses
}); 