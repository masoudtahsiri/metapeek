// Enhanced background.js with improved error handling and modularization

console.log('MetaPeek background script loaded');

/**
 * Constants
 */
const SPECIAL_URLS = ['chrome://', 'edge://', 'about:'];
const WELCOME_PAGE = 'https://github.com/masoudtahsiri/metapeek#readme';

/**
 * Check if a URL is a special browser URL that can't be analyzed
 * @param {string} url - The URL to check
 * @returns {boolean} - True if the URL is special
 */
function isSpecialUrl(url) {
  return SPECIAL_URLS.some(prefix => url.startsWith(prefix));
}

/**
 * Show a notification to the user
 * @param {string} message - The message to display
 */
function showNotification(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'MetaPeek',
    message: message,
    priority: 1
  });
}

/**
 * Set the popup for a tab based on its URL
 * @param {number} tabId - The ID of the tab
 * @param {string} url - The URL of the tab
 */
function configurePopupForTab(tabId, url) {
  const popupPath = isSpecialUrl(url) ? '' : 'popup.html';
  
  chrome.action.setPopup({
    tabId: tabId,
    popup: popupPath
  });
  
  if (isSpecialUrl(url)) {
    console.log('Special URL detected, removing popup for tab:', tabId);
  }
}

// Listen for extension icon clicks
chrome.action.onClicked.addListener((tab) => {
  console.log('Extension icon clicked for tab:', tab.url);
  
  if (isSpecialUrl(tab.url)) {
    // Show a notification for special URLs
    showNotification('MetaPeek cannot analyze browser system pages. Please try it on a regular website.');
    return;
  }
  
  // For non-special URLs, configure the popup
  configurePopupForTab(tab.id, tab.url);
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    configurePopupForTab(tabId, tab.url);
  }
});

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed or updated:', details.reason);
  
  if (details.reason === 'install') {
    // Open a welcome page on first install
    chrome.tabs.create({ url: WELCOME_PAGE });
  }
});

// Listen for content script communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message.type);
  
  switch (message.type) {
    case 'metadataUpdated':
      console.log('Metadata updated for tab:', sender.tab?.id);
      // We could store this in extension storage for faster access
      // when popup opens
      sendResponse({ received: true });
      break;
    
    default:
      console.log('Unknown message type:', message.type);
      break;
  }
  
  return true; // Keep message channel open for async responses
}); 