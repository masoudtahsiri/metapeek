/**
 * MetaPeek Background Script - FIXED FOR MEMORY LEAKS AND PERFORMANCE
 * Handles extension lifecycle, tab events, and message passing
 */

console.log('MetaPeek background script loaded');

/**
 * Constants
 */
const SPECIAL_URLS = ['chrome://', 'edge://', 'about:'];
const WELCOME_PAGE = 'https://github.com/masoudtahsiri/metapeek#readme';

/**
 * Global state to track listeners and prevent memory leaks
 */
const backgroundState = {
  listeners: new Map(),
  notificationTimeouts: new Map()
};

/**
 * Check if a URL is a special browser URL that can't be analyzed
 * @param {string} url - The URL to check
 * @returns {boolean} - True if the URL is special
 */
function isSpecialUrl(url) {
  return SPECIAL_URLS.some(prefix => url.startsWith(prefix));
}

/**
 * Show a notification to the user with cleanup
 * @param {string} message - The message to display
 */
function showNotification(message) {
  const notificationId = `metapeek-${Date.now()}`;
  
  chrome.notifications.create(notificationId, {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'MetaPeek',
    message: message,
    priority: 1
  }, (createdId) => {
    // Auto-clear notification after 5 seconds to prevent memory leaks
    const timeoutId = setTimeout(() => {
      chrome.notifications.clear(createdId);
      backgroundState.notificationTimeouts.delete(createdId);
    }, 5000);
    
    backgroundState.notificationTimeouts.set(createdId, timeoutId);
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

/**
 * Handle action icon clicks
 */
function handleActionClick(tab) {
  console.log('Extension icon clicked for tab:', tab.url);
  
  if (isSpecialUrl(tab.url)) {
    // Show a notification for special URLs
    showNotification('MetaPeek cannot analyze browser system pages. Please try it on a regular website.');
    return;
  }
  
  // For non-special URLs, configure the popup
  configurePopupForTab(tab.id, tab.url);
}

/**
 * Handle tab updates
 */
function handleTabUpdate(tabId, changeInfo, tab) {
  // Only process when navigation is complete to reduce unnecessary calls
  if (changeInfo.status === 'complete' && tab.url) {
    configurePopupForTab(tabId, tab.url);
  }
}

/**
 * Handle extension installation
 */
function handleInstall(details) {
  console.log('Extension installed or updated:', details.reason);
  
  if (details.reason === 'install') {
    // Open a welcome page on first install
    chrome.tabs.create({ url: WELCOME_PAGE });
  }
  
  // Clean up any existing notifications on install/update
  chrome.notifications.getAll((notifications) => {
    Object.keys(notifications).forEach(id => {
      chrome.notifications.clear(id);
    });
  });
}

/**
 * Handle runtime messages
 */
function handleRuntimeMessage(message, sender, sendResponse) {
  console.log('Background script received message:', message.type);
  
  switch (message.type) {
    case 'metadataUpdated':
      console.log('Metadata updated for tab:', sender.tab?.id);
      // We could store this in extension storage for faster access
      // when popup opens, but we'll avoid it to prevent memory issues
      sendResponse({ received: true });
      break;
    
    default:
      console.log('Unknown message type:', message.type);
      break;
  }
  
  return true; // Keep message channel open for async responses
}

/**
 * Initialize all listeners with proper cleanup
 */
function initializeListeners() {
  // Remove any existing listeners first
  cleanupListeners();
  
  // Listen for extension icon clicks
  chrome.action.onClicked.addListener(handleActionClick);
  backgroundState.listeners.set('action.onClicked', handleActionClick);
  
  // Handle tab updates
  chrome.tabs.onUpdated.addListener(handleTabUpdate);
  backgroundState.listeners.set('tabs.onUpdated', handleTabUpdate);
  
  // Handle extension installation
  chrome.runtime.onInstalled.addListener(handleInstall);
  backgroundState.listeners.set('runtime.onInstalled', handleInstall);
  
  // Listen for content script communication
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  backgroundState.listeners.set('runtime.onMessage', handleRuntimeMessage);
}

/**
 * Cleanup all listeners and timeouts
 */
function cleanupListeners() {
  // Remove action listener
  const actionListener = backgroundState.listeners.get('action.onClicked');
  if (actionListener) {
    chrome.action.onClicked.removeListener(actionListener);
  }
  
  // Remove tab update listener
  const tabListener = backgroundState.listeners.get('tabs.onUpdated');
  if (tabListener) {
    chrome.tabs.onUpdated.removeListener(tabListener);
  }
  
  // Remove install listener
  const installListener = backgroundState.listeners.get('runtime.onInstalled');
  if (installListener) {
    chrome.runtime.onInstalled.removeListener(installListener);
  }
  
  // Remove message listener
  const messageListener = backgroundState.listeners.get('runtime.onMessage');
  if (messageListener) {
    chrome.runtime.onMessage.removeListener(messageListener);
  }
  
  // Clear all notification timeouts
  backgroundState.notificationTimeouts.forEach(timeoutId => {
    clearTimeout(timeoutId);
  });
  backgroundState.notificationTimeouts.clear();
  
  // Clear listeners map
  backgroundState.listeners.clear();
}

/**
 * Handle extension suspension/unload
 */
chrome.runtime.onSuspend.addListener(() => {
  console.log('Extension suspending, cleaning up...');
  cleanupListeners();
  
  // Clear all notifications
  chrome.notifications.getAll((notifications) => {
    Object.keys(notifications).forEach(id => {
      chrome.notifications.clear(id);
    });
  });
});

// Initialize listeners
initializeListeners();