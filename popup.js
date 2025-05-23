/**
 * MetaPeek Popup - FIXED FOR MEMORY LEAKS AND PERFORMANCE
 * Displays metadata and SEO information for the current page
 */

console.log('MetaPeek popup initialized');

// Configuration
const CONFIG = {
  loadingTimeout: 5000,            // Timeout for loading data (ms)
  toastDuration: 3000,             // Duration to show toast messages (ms)
};

// Initialize MetaPeek namespace if it doesn't exist
window.MetaPeek = window.MetaPeek || {
  initialized: false,
  listeners: new Map(),
  domCache: new Map()
};

// State
const state = {
  metadata: null,
  darkMode: false,
  loading: {
    metadata: false
  },
  errors: {
    metadata: null
  }
};

// Global preview state
const previewState = {
  currentPlatform: 'google',
  currentDevice: 'desktop',
  editMode: false,
  originalMetadata: null,
  editedMetadata: null,
  pageHostname: null,
  previewsGenerated: false // Track if previews have been generated
};

// Global preview state
const socialPreviewState = {
  currentPlatform: 'google',
  currentDevice: 'desktop',
  originalMetadata: null,
  pageHostname: null
};

/**
 * Optimize font loading without violating CSP
 */
function optimizeFontLoading() {
  // Check if fonts are already loaded
  if (document.fonts && document.fonts.check('1em Inter')) {
    return;
  }

  // Create font link dynamically
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
  document.head.appendChild(fontLink);
  
  // Add class when fonts load
  if (document.fonts) {
    document.fonts.ready.then(() => {
      document.body.classList.add('fonts-loaded');
    });
  }
}

/**
 * Cache DOM queries for better performance
 */
function cacheDOM() {
  const cache = window.MetaPeek.domCache;
  
  // Clear existing cache
  cache.clear();
  
  // Cache commonly used elements
  cache.set('themeToggle', document.getElementById('theme-toggle'));
  cache.set('toast', document.getElementById('toast'));
  cache.set('globalTooltip', document.getElementById('global-tooltip'));
  cache.set('scoreCircle', document.querySelector('.score-circle'));
  cache.set('scoreValue', document.querySelector('.score-value'));
  cache.set('scoreTitle', document.querySelector('.score-title'));
  cache.set('scoreDescription', document.querySelector('.score-description'));
  
  // Cache containers
  cache.set('allIssues', document.getElementById('all-issues'));
  cache.set('highIssues', document.getElementById('high-issues'));
  cache.set('mediumIssues', document.getElementById('medium-issues'));
  cache.set('lowIssues', document.getElementById('low-issues'));
  
  // Cache impact containers
  cache.set('impactContainers', {
    all: document.getElementById('all-issues'),
    high: document.getElementById('high-issues'),
    medium: document.getElementById('medium-issues'),
    low: document.getElementById('low-issues')
  });
  
  // Cache tab elements
  cache.set('impactTabs', {
    all: document.querySelector('[data-impact="all"]'),
    high: document.querySelector('[data-impact="high"]'),
    medium: document.querySelector('[data-impact="medium"]'),
    low: document.querySelector('[data-impact="low"]')
  });
  
  return cache;
}

/**
 * Get cached DOM element
 */
function getCached(key) {
  return window.MetaPeek.domCache.get(key);
}

/**
 * Document Ready Handler
 * Initialize the app when the DOM is fully loaded
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup DOM loaded');
  
  // Optimize font loading
  optimizeFontLoading();
  
  // Cache DOM elements
  cacheDOM();
  
  // Initialize UI components
  initUI();
  
  // Load data from the active tab
  loadPageData();
  initMetaSectionTabs();
  
  // Cleanup on window unload
  window.addEventListener('beforeunload', cleanup);
});

/**
 * Cleanup function to prevent memory leaks and reset state
 * Clears all intervals, timeouts, event listeners, and cached data
 */
function cleanup() {
  console.log('Cleaning up popup resources');
  
  try {
    // Clear all intervals/timeouts more efficiently
    const highestId = setTimeout(() => {}, 0);
    for (let i = 0; i < highestId; i++) {
      clearTimeout(i);
      clearInterval(i);
    }
    
    // Remove all tracked event listeners
    if (window.MetaPeek?.listeners) {
  window.MetaPeek.listeners.forEach((listener, element) => {
        try {
          if (element?.removeEventListener && listener?.type && listener?.handler) {
      element.removeEventListener(listener.type, listener.handler);
          }
        } catch (error) {
          console.warn('Error removing event listener:', error);
    }
  });
  window.MetaPeek.listeners.clear();
    }
  
  // Clear DOM cache
    if (window.MetaPeek?.domCache) {
  window.MetaPeek.domCache.clear();
    }
    
    // Clear impact containers cache
    if (typeof impactContainers !== 'undefined' && impactContainers?.clear) {
      impactContainers.clear();
    }
    
    // Clear all stored references
    const statesToClear = [
      previewState,
      socialPreviewState,
      state
    ];
    
    statesToClear.forEach(stateObj => {
      if (stateObj) {
        Object.keys(stateObj).forEach(key => {
          if (key === 'metadata' || key === 'originalMetadata' || key === 'editedMetadata') {
            stateObj[key] = null;
          }
        });
      }
    });
  
    // Reset initialization state
    if (window.MetaPeek) {
  window.MetaPeek.initialized = false;
    }
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

/**
 * Add event listener with tracking for cleanup
 */
function addTrackedListener(element, type, handler) {
  if (!element) return;
  
  element.addEventListener(type, handler);
  window.MetaPeek.listeners.set(element, { type, handler });
}

/**
 * Initialize all UI components
 */
function initUI() {
  try {
    initThemeToggle();
    initTabNavigation();
    initSocialPreviews();
    initExcelExport();
    initImpactTabs();
  } catch (error) {
    console.error('Error initializing UI:', error);
  }
}

/**
 * Load data from the active tab
 */
function loadPageData() {
  console.log('Loading page metadata...');
  
  // Set loading state
  state.loading.metadata = true;
  state.errors.metadata = null;
  
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (!tabs || !tabs[0]) {
      console.error('No active tab found');
      showError('Unable to access current tab');
      return;
    }
    
    const activeTab = tabs[0];
    updateUrlDisplay(activeTab.url);
    // Store the real hostname for previews (for both previewState and socialPreviewState)
    try {
      previewState.pageHostname = new URL(activeTab.url).hostname;
      socialPreviewState.pageHostname = new URL(activeTab.url).hostname;
    } catch (e) {
      previewState.pageHostname = activeTab.url;
      socialPreviewState.pageHostname = activeTab.url;
    }
    console.log('Getting metadata for tab:', activeTab.id);
    
    // Add a timeout to prevent indefinite waiting
    let responseReceived = false;
    const timeoutId = setTimeout(() => {
      if (!responseReceived) {
        console.error('Timeout waiting for metadata response');
        showError('Timeout getting metadata from page. Please refresh and try again.');
      }
    }, CONFIG.loadingTimeout);
    
    // Request metadata from content script
    chrome.tabs.sendMessage(activeTab.id, { type: 'getMetadata' }, (response) => {
      // Clear timeout
      clearTimeout(timeoutId);
      responseReceived = true;
      state.loading.metadata = false;
      
      if (chrome.runtime.lastError) {
        // Improved error handling to show the actual error message
        const errorMessage = chrome.runtime.lastError.message || 'Unknown error occurred';
        console.error('Error getting metadata:', errorMessage);
        showError(`Failed to connect to page: ${errorMessage}. Please refresh and try again.`);
        return;
      }
      
      if (!response) {
        console.error('No response received from content script');
        showError('No data received from page. The content script may not be loaded properly.');
        return;
      }
      
      console.log('Received metadata', response);
      state.metadata = response;
      populateUI(response);
    });
  });
}

/**
 * Show error message in all data containers
 * @param {string} message - Error message to display
 */
function showError(message) {
  console.error('Error:', message);
  
  const errorHTML = `
    <div class="error-indicator">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <div class="error-text">${message}</div>
    </div>
  `;
  
  document.querySelectorAll('.loading-indicator').forEach(el => {
    if (el.parentNode) {
      el.parentNode.innerHTML = errorHTML;
    }
  });
}

/**
 * Update the displayed URL
 * @param {string} url - URL to display
 */
function updateUrlDisplay(url) {
  const urlDisplay = document.getElementById('url-text');
  if (!urlDisplay) return;
  
  try {
    const displayUrl = new URL(url).hostname;
    urlDisplay.textContent = displayUrl;
  } catch (e) {
    urlDisplay.textContent = url;
  }
}

/**
 * Populate the UI with metadata
 * @param {Object} metadata - Metadata from content script
 */
function populateUI(metadata) {
  console.log('Populating UI with metadata');
  try {
    // Update SEO score
    updateSEOScore(metadata.seoScore);
    
    // Update priority issues
    updatePriorityIssues(metadata);
    
    // Update meta tag summary in Overview tab
    updateMetaTagSummary(metadata);
    
    // Update meta tags in Meta Tags tab
    updateBasicMetaTags(metadata.basicMeta || []);
    updateOGMetaTags(metadata.ogMeta || []);
    updateTwitterMetaTags(metadata.twitterMeta || []);
    updateCanonicalURL(metadata.canonicalUrl || '');
    updateSchemaData(metadata.schemaData || []);
    
    // Update social previews ONLY ONCE
    if (!previewState.previewsGenerated) {
      updateSocialPreviews(metadata);
      previewState.previewsGenerated = true;
    }
    
    console.log('UI update complete');
  } catch (error) {
    console.error('Error populating UI:', error);
    showError('Error displaying data: ' + error.message);
  }
}

/**
 * Update meta tag summary in Overview tab
 * @param {Object} metadata - Metadata from content script
 */
function updateMetaTagSummary(metadata) {
  const summaryGrid = document.querySelector('.summary-grid');
  if (!summaryGrid) return;
  
  const cards = summaryGrid.querySelectorAll('.summary-card');
  
  // Update title card
  if (cards[0]) {
    const title = metadata.basicMeta?.find(tag => tag.label === 'Title') || { 
      status: 'error'
    };
    
    const statusBadge = cards[0].querySelector('.status-badge');
    if (statusBadge) {
      const statusText = title.status === 'good' ? 'Good' : 
                         title.status === 'warning' ? 'Warning' : 'Missing';
      
      statusBadge.className = 'status-badge ' + title.status;
      statusBadge.textContent = statusText;
    }
  }
  
  // Update description card
  if (cards[1]) {
    const description = metadata.basicMeta?.find(tag => tag.label === 'Description') || { 
      status: 'error'
    };
    
    const statusBadge = cards[1].querySelector('.status-badge');
    if (statusBadge) {
      const statusText = description.status === 'good' ? 'Good' : 
                         description.status === 'warning' ? 'Warning' : 'Missing';
      
      statusBadge.className = 'status-badge ' + description.status;
      statusBadge.textContent = statusText;
    }
  }
  
  // Update canonical URL card
  if (cards[2]) {
    const hasCanonical = metadata.canonicalUrl && metadata.canonicalUrl.length > 0;
    const status = hasCanonical ? 'good' : 'error';
    
    const statusBadge = cards[2].querySelector('.status-badge');
    if (statusBadge) {
      statusBadge.className = 'status-badge ' + status;
      statusBadge.textContent = hasCanonical ? 'Good' : 'Missing';
    }
  }
  
  // Update mobile optimization card
  if (cards[3]) {
    const viewport = metadata.basicMeta?.find(tag => tag.label === 'Viewport') || { status: 'error' };
    
    const statusBadge = cards[3].querySelector('.status-badge');
    if (statusBadge) {
      statusBadge.className = 'status-badge ' + viewport.status;
      statusBadge.textContent = viewport.status === 'good' ? 'Good' : 'Missing';
    }
  }
}

/**
 * Update Status Overview with progress bars
 * @param {Object} scoreData - Score data containing validation results
 */
function updateSEOScore(scoreData) {
  if (!scoreData) return;
  
  const metadata = state.metadata || {};
  
  // Basic Meta Tags
  const basicMetaTotal = 5; // Title, Description, Keywords, Viewport, Robots
  const basicMetaGood = (metadata.basicMeta || []).filter(tag => tag.status === 'good').length;
  updateProgressBar('basic-meta', basicMetaGood, basicMetaTotal);
  
  // Open Graph Tags
  const ogTotal = 6; // og:title, og:description, og:image, og:url, og:type, og:site_name
  const ogGood = (metadata.ogMeta || []).filter(tag => tag.status === 'good').length;
  updateProgressBar('og', ogGood, ogTotal);
  
  // Twitter Card Tags
  const twitterTotal = 5; // twitter:card, twitter:title, twitter:description, twitter:image, twitter:site
  const twitterGood = (metadata.twitterMeta || []).filter(tag => tag.status === 'good').length;
  updateProgressBar('twitter', twitterGood, twitterTotal);
  
  // Schema.org Data
  const hasSchema = metadata.schemaData && metadata.schemaData.length > 0;
  const hasValidSchema = hasSchema && metadata.schemaData.every(s => s.valid);
  updateSchemaStatus(hasSchema, hasValidSchema);
}

/**
 * Update individual progress bar
 * @param {string} category - Category identifier
 * @param {number} completed - Number of completed items
 * @param {number} total - Total number of items
 */
function updateProgressBar(category, completed, total) {
  const progressBar = document.querySelector(`.${category}-progress`);
  const countElement = progressBar?.closest('.status-category')?.querySelector('.category-count');
  
  if (progressBar) {
    const percentage = (completed / total) * 100;
    progressBar.style.width = `${percentage}%`;
    
    // Set color based on completion
    progressBar.classList.remove('complete', 'partial', 'incomplete');
    if (percentage === 100) {
      progressBar.classList.add('complete');
    } else if (percentage >= 50) {
      progressBar.classList.add('partial');
    } else {
      progressBar.classList.add('incomplete');
    }
  }
  
  if (countElement) {
    countElement.textContent = `${completed}/${total}`;
  }
}

/**
 * Update Schema.org status
 * @param {boolean} hasSchema - Whether schema data exists
 * @param {boolean} isValid - Whether schema data is valid
 */
function updateSchemaStatus(hasSchema, isValid) {
  const progressBar = document.querySelector('.schema-progress');
  const statusElement = progressBar?.closest('.status-category')?.querySelector('.category-status');
  
  if (progressBar) {
    progressBar.classList.remove('complete', 'partial', 'incomplete');
    
    if (!hasSchema) {
      progressBar.style.width = '0%';
      progressBar.classList.add('incomplete');
    } else if (isValid) {
      progressBar.style.width = '100%';
      progressBar.classList.add('complete');
    } else {
      progressBar.style.width = '50%';
      progressBar.classList.add('partial');
    }
  }
  
  if (statusElement) {
    if (!hasSchema) {
      statusElement.textContent = 'Not detected';
      statusElement.className = 'category-status status-none';
    } else if (isValid) {
      statusElement.textContent = 'Valid ✓';
      statusElement.className = 'category-status status-valid';
    } else {
      statusElement.textContent = 'Has errors';
      statusElement.className = 'category-status status-error';
    }
  }
}

/**
 * Update priority issues section with tabbed interface
 * @param {Object} metadata - Metadata from content script
 */
function updatePriorityIssues(metadata) {
  // Initialize impact tabs
  initImpactTabs();
  
  const allIssuesContainer = getCached('allIssues');
  const highIssuesContainer = getCached('highIssues');
  const mediumIssuesContainer = getCached('mediumIssues');
  const lowIssuesContainer = getCached('lowIssues');
  const issueBadge = document.querySelector('.section-title .badge');
  
  if (!allIssuesContainer || !metadata.seoScore) return;
  
  // Clear existing issues
  allIssuesContainer.innerHTML = '';
  highIssuesContainer.innerHTML = '';
  mediumIssuesContainer.innerHTML = '';
  lowIssuesContainer.innerHTML = '';
  
  // Get recommendations from metadata
  const recommendations = metadata.seoScore.recommendations || [];
  
  // Categorize issues by impact level
  const allIssues = [];
  const highIssues = [];
  const mediumIssues = [];
  const lowIssues = [];
  
  recommendations.forEach(category => {
    if (category.items) {
      category.items.forEach(item => {
        const issueItem = {
          title: item.issue,
          description: item.details,
          impact: item.impact || 'Low',
          category: category.category
        };
        
        allIssues.push(issueItem);
        
        if (item.impact === 'High') {
          highIssues.push(issueItem);
        } else if (item.impact === 'Medium') {
          mediumIssues.push(issueItem);
        } else {
          lowIssues.push(issueItem);
        }
      });
    }
  });
  
  // Sort allIssues by impact level (High > Medium > Low), normalizing case
  allIssues.sort((a, b) => {
    const impactOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
    const normalize = v => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
    const impactA = normalize(a.impact);
    const impactB = normalize(b.impact);
    return (impactOrder[impactA] || 99) - (impactOrder[impactB] || 99);
  });
  
  // Update issue counts in tabs
  updateTabCounter('all', allIssues.length);
  updateTabCounter('high', highIssues.length);
  updateTabCounter('medium', mediumIssues.length);
  updateTabCounter('low', lowIssues.length);
  
  // Update total issue count in badge
  if (issueBadge) {
    issueBadge.textContent = allIssues.length;
  }
  
  // Render issues in each container
  renderIssues(allIssuesContainer, allIssues);
  renderIssues(highIssuesContainer, highIssues);
  renderIssues(mediumIssuesContainer, mediumIssues);
  renderIssues(lowIssuesContainer, lowIssues);
}

/**
 * Render issues in a container with concise formatting
 * @param {HTMLElement} container - Container element
 * @param {Array} issues - Array of issues to render
 */
function renderIssues(container, issues) {
  if (!container) return;
  
  if (issues.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No issues found.</p>
      </div>
    `;
    return;
  }
  
  // Helper function to map impact to status class
  const getStatusClass = (impact) => {
    if (impact === 'High') return 'error';
    if (impact === 'Medium') return 'warning';
    if (impact === 'Low') return 'low';
    return 'warning';
  };

  // Helper function to create impact badge
  const getImpactBadge = (impact, description) => {
    const impactClass = impact.toLowerCase();
    const statusClass = getStatusClass(impact);
    return `<span class="status-badge ${impactClass} ${statusClass}" data-tooltip="${description}">${impact}
      <svg class="info-icon" width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2"/><rect x="9" y="8" width="2" height="5" rx="1" fill="currentColor"/><rect x="9" y="5" width="2" height="2" rx="1" fill="currentColor"/></svg>
    </span>`;
  };
  
  // Create document fragment for better performance
  const fragment = document.createDocumentFragment();
  const wrapper = document.createElement('div');
  
  // Build all HTML at once
  const html = issues.map(issue => `
      <div class="issue-item ${issue.impact.toLowerCase()}" style="position:relative;">
        <div class="issue-header">
          <h4>${issue.title}</h4>
          ${getImpactBadge(issue.impact, issue.description)}
        </div>
        <div class="issue-category-wrapper">
          <span class="issue-category">${issue.category}</span>
        </div>
      </div>
  `).join('');
  
  wrapper.innerHTML = html;
  
  // Move all children to fragment
  while (wrapper.firstChild) {
    fragment.appendChild(wrapper.firstChild);
  }
  
  // Single DOM update
  container.innerHTML = '';
  container.appendChild(fragment);
  
  // Initialize tooltips after rendering
  requestAnimationFrame(() => initTooltips());
}

/**
 * Update the counter in a tab
 * @param {string} impactLevel - Impact level identifier
 * @param {number} count - Number of issues
 */
function updateTabCounter(impactLevel, count) {
  const tab = document.querySelector(`.impact-tab[data-impact="${impactLevel}"]`);
  if (!tab) return;
  
  let counter = tab.querySelector('.count');
  if (!counter) {
    counter = document.createElement('span');
    counter.className = 'count';
    tab.appendChild(counter);
  }
  
  counter.textContent = count;
}

/**
 * Update basic meta tags in Meta Tags tab with tooltips
 * @param {Array} metaTags - Basic meta tags
 */
function updateBasicMetaTags(metaTags) {
  const container = document.getElementById('basic-meta-content');
  if (!container) return;
  
  // Find the meta-table div, not the entire container
  let metaTable = container.querySelector('.meta-table');
  if (!metaTable) {
    metaTable = document.createElement('div');
    metaTable.className = 'meta-table';
    container.appendChild(metaTable);
  }
  
  if (!metaTags || metaTags.length === 0) {
    metaTable.innerHTML = `
      <div class="empty-state">
        <p>No basic meta tags found on this page.</p>
      </div>
    `;
    return;
  }
  
  metaTable.innerHTML = '';
  
  metaTags.forEach(tag => {
    const row = document.createElement('div');
    row.className = 'meta-row';
    
    const isEmpty = !tag.value || tag.value.trim() === '';
    const valueClass = isEmpty ? 'meta-cell value empty' : 'meta-cell value';
    
    // Add tooltip attribute for the status badge
    const statusTooltip = tag.message || getStatusMessage(tag.status, tag.label);
    
    row.innerHTML = `
      <div class="meta-cell name">${tag.label}</div>
      <div class="${valueClass}">${isEmpty ? 'Not set' : tag.value}</div>
      <div class="meta-cell status">
        <span class="status-badge ${tag.status || 'warning'}" data-tooltip="${statusTooltip}">
          ${tag.status || 'Missing'}
          <svg class="info-icon" width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2"/><rect x="9" y="8" width="2" height="5" rx="1" fill="currentColor"/><rect x="9" y="5" width="2" height="2" rx="1" fill="currentColor"/></svg>
        </span>
      </div>
    `;
    
    metaTable.appendChild(row);
  });
  
  // Initialize tooltips after updating the badges
  initTooltips();
}

/**
 * Update Open Graph meta tags in Meta Tags tab with tooltips
 * @param {Array} metaTags - OG meta tags
 */
function updateOGMetaTags(metaTags) {
  const container = document.getElementById('og-meta-content');
  if (!container) return;
  
  if (!metaTags || metaTags.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No Open Graph tags found on this page.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  metaTags.forEach(tag => {
    const row = document.createElement('div');
    row.className = 'meta-row';
    
    const isEmpty = !tag.value || tag.value.trim() === '';
    const valueClass = isEmpty ? 'meta-cell value empty' : 'meta-cell value';
    
    // Add tooltip attribute for the status badge
    const statusTooltip = tag.message || getStatusMessage(tag.status, tag.label);
    
    row.innerHTML = `
      <div class="meta-cell name">${tag.label}</div>
      <div class="${valueClass}">${isEmpty ? 'Not set' : tag.value}</div>
      <div class="meta-cell status">
        <span class="status-badge ${tag.status || 'warning'}" data-tooltip="${statusTooltip}">
          ${tag.status || 'Missing'}
          <svg class="info-icon" width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2"/><rect x="9" y="8" width="2" height="5" rx="1" fill="currentColor"/><rect x="9" y="5" width="2" height="2" rx="1" fill="currentColor"/></svg>
        </span>
      </div>
    `;
    
    container.appendChild(row);
  });
  
  // Initialize tooltips after updating the badges
  initTooltips();
}

/**
 * Update Twitter Card meta tags in Meta Tags tab with tooltips
 * @param {Array} metaTags - Twitter meta tags
 */
function updateTwitterMetaTags(metaTags) {
  const container = document.getElementById('twitter-meta-content');
  if (!container) return;
  
  if (!metaTags || metaTags.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No Twitter Card tags found on this page.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  metaTags.forEach(tag => {
    const row = document.createElement('div');
    row.className = 'meta-row';
    
    const isEmpty = !tag.value || tag.value.trim() === '';
    const valueClass = isEmpty ? 'meta-cell value empty' : 'meta-cell value';
    
    // Add tooltip attribute for the status badge
    const statusTooltip = tag.message || getStatusMessage(tag.status, tag.label);
    
    row.innerHTML = `
      <div class="meta-cell name">${tag.label}</div>
      <div class="${valueClass}">${isEmpty ? 'Not set' : tag.value}</div>
      <div class="meta-cell status">
        <span class="status-badge ${tag.status || 'warning'}" data-tooltip="${statusTooltip}">
          ${tag.status || 'Missing'}
          <svg class="info-icon" width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2"/><rect x="9" y="8" width="2" height="5" rx="1" fill="currentColor"/><rect x="9" y="5" width="2" height="2" rx="1" fill="currentColor"/></svg>
        </span>
      </div>
    `;
    
    container.appendChild(row);
  });
  
  // Initialize tooltips after updating the badges
  initTooltips();
}

/**
 * Get a generic status message if a specific one isn't provided
 * @param {string} status - Status value (good, warning, error)
 * @param {string} tagName - Name of the meta tag
 * @returns {string} Status message
 */
function getStatusMessage(status, tagName) {
  switch (status) {
    case 'good':
      return `${tagName} is properly optimized.`;
    case 'warning':
      return `${tagName} needs attention. It may be too short, too long, or missing recommended content.`;
    case 'error':
    default:
      return `${tagName} is missing or has critical issues that need to be addressed.`;
  }
}

/**
 * Update canonical URL in Meta Tags tab
 * @param {string} canonicalUrl - Canonical URL
 */
function updateCanonicalURL(canonicalUrl) {
  const container = document.getElementById('canonical-content');
  if (!container) return;
  
  if (!canonicalUrl) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No canonical URL found on this page.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  const row = document.createElement('div');
  row.className = 'meta-row';
  
  row.innerHTML = `
    <div class="meta-cell name">canonical</div>
    <div class="meta-cell value">${canonicalUrl}</div>
    <div class="meta-cell status">
      <span class="status-badge good">Good</span>
    </div>
  `;
  
  container.appendChild(row);
}

/**
 * Initialize social preview functionality with improved error handling
 */
function initSocialPreviews() {
  try {
    console.log('Initializing social previews');
    // Make sure we have the basic structure first
    if (!ensureBasicPreviewStructure()) {
      console.error('Failed to create basic preview structure');
      return;
    }
    
    // Initialize platform tabs
    initSocialTabs();
    
    console.log('Social previews initialized successfully');
  } catch (error) {
    console.error('Error initializing social previews:', error);
    showErrorInSocialTab('Failed to initialize social previews');
  }
}

/**
 * Ensure the basic preview structure exists and create it if it doesn't
 * @returns {boolean} True if the structure exists or was created successfully
 */
function ensureBasicPreviewStructure() {
  try {
    // Make sure we have a container for the previews
    const previewTab = document.getElementById('social-preview-tab');
    if (!previewTab) {
      console.error('Social preview tab not found in the DOM');
      return false;
    }

    // Make sure we have social tabs
    if (!previewTab.querySelector('.social-tabs')) {
      console.log('Creating social tabs container');
      const socialTabs = document.createElement('div');
      socialTabs.className = 'social-tabs';
      socialTabs.innerHTML = `
        <button class="social-tab active" data-preview="google">Google</button>
        <button class="social-tab" data-preview="facebook">Facebook</button>
        <button class="social-tab" data-preview="twitter">Twitter</button>
        <button class="social-tab" data-preview="linkedin">LinkedIn</button>
      `;
      previewTab.prepend(socialTabs);
    }

    // Make sure we have a preview container
    if (!previewTab.querySelector('.preview-container')) {
      console.log('Creating preview container');
      const previewContainer = document.createElement('div');
      previewContainer.className = 'preview-container desktop-view';
      
      // Create basic preview panes
      previewContainer.innerHTML = `
        <!-- Google Preview -->
        <div id="google-preview" class="preview-content active">
          <div class="loading-indicator">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading Google preview...</div>
          </div>
        </div>
        
        <!-- Facebook Preview -->
        <div id="facebook-preview" class="preview-content">
          <div class="loading-indicator">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading Facebook preview...</div>
          </div>
        </div>
        
        <!-- Twitter Preview -->
        <div id="twitter-preview" class="preview-content">
          <div class="loading-indicator">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading Twitter preview...</div>
          </div>
        </div>

        <!-- LinkedIn Preview -->
        <div id="linkedin-preview" class="preview-content">
          <div class="loading-indicator">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading LinkedIn preview...</div>
          </div>
        </div>
      `;
      
      // Insert at appropriate position
      const socialTabs = previewTab.querySelector('.social-tabs');
      if (socialTabs) {
        socialTabs.after(previewContainer);
      } else {
        previewTab.appendChild(previewContainer);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error creating preview structure:', error);
    return false;
  }
}

/**
 * Show error message in social preview tab
 * @param {string} message - Error message to display
 */
function showErrorInSocialTab(message) {
  const previewTab = document.getElementById('social-preview-tab');
  if (!previewTab) return;
  
  const existingError = previewTab.querySelector('.social-preview-error');
  if (existingError) {
    existingError.textContent = message;
    return;
  }
  
  const errorElement = document.createElement('div');
  errorElement.className = 'social-preview-error error-indicator';
  errorElement.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
    <div class="error-text">${message}</div>
  `;
  
  // Insert at beginning of tab
  previewTab.prepend(errorElement);
}

/**
 * Initialize social tabs functionality - FIXED TO NOT REGENERATE CONTENT
 * Only toggles visibility without regenerating content
 */
function initSocialTabs() {
  const tabs = document.querySelectorAll('.social-tab');
  if (!tabs.length) return;

  tabs.forEach(tab => {
    addTrackedListener(tab, 'click', () => {
      try {
        // Get the target preview ID
        const previewId = tab.getAttribute('data-preview');
        if (!previewId) return;
        
        // Skip if already active
        if (tab.classList.contains('active')) return;
        
        // Remove active class from all tabs and previews
        document.querySelectorAll('.social-tab').forEach(t => {
          t.classList.remove('active');
        });
        
        document.querySelectorAll('.preview-content').forEach(content => {
          content.classList.remove('active');
        });
        
        // Add active class to clicked tab
        tab.classList.add('active');
        
        // Find and activate corresponding preview
        const previewElement = document.getElementById(`${previewId}-preview`);
        if (previewElement) {
          previewElement.classList.add('active');
          // Just update the current platform in state, DON'T regenerate content
          socialPreviewState.currentPlatform = previewId;
        } else {
          console.warn(`Preview element #${previewId}-preview not found`);
        }
        // Adjust the preview container height after switching
        adjustPreviewContainerHeight();
      } catch (error) {
        console.error('Error handling tab click:', error);
      }
    });
  });
  // Adjust height on load
  setTimeout(adjustPreviewContainerHeight, 0);
}

/**
 * Adjust the preview container's height to match the active preview
 */
function adjustPreviewContainerHeight() {
  const container = document.querySelector('.preview-container');
  if (!container) return;
  const activePreview = container.querySelector('.preview-content.active');
  if (!activePreview) return;

  // Special case for LinkedIn: use a fixed height for centering
  if (activePreview.id === 'linkedin-preview') {
    container.style.height = '97px';
  } else {
    // Dynamic height for other previews
    container.style.height = 'auto';
    const targetHeight = activePreview.offsetHeight;
    container.style.height = targetHeight + 'px';
  }
}

/**
 * Update all social previews with metadata - ONLY RUNS ONCE
 * Generate all previews only ONCE when metadata is loaded
 */
function updateSocialPreviews(metadata) {
  if (!metadata) {
    console.warn('No metadata provided to update social previews');
    return;
  }
  
  console.log('Updating social previews with metadata');
  
  // Extract metadata from the response
  const title = metadata.basicMeta?.find(tag => tag.label === 'Title')?.value || '';
  const description = metadata.basicMeta?.find(tag => tag.label === 'Description')?.value || '';
  const ogTitle = metadata.ogMeta?.find(tag => tag.label === 'og:title')?.value || '';
  const ogDescription = metadata.ogMeta?.find(tag => tag.label === 'og:description')?.value || '';
  const ogImage = metadata.ogMeta?.find(tag => tag.label === 'og:image')?.value || '';
  const twitterTitle = metadata.twitterMeta?.find(tag => tag.label === 'twitter:title')?.value || '';
  const twitterDescription = metadata.twitterMeta?.find(tag => tag.label === 'twitter:description')?.value || '';
  const twitterImage = metadata.twitterMeta?.find(tag => tag.label === 'twitter:image')?.value || '';
  const siteName = metadata.ogMeta?.find(tag => tag.label === 'og:site_name')?.value || '';

  // Store metadata in state, including canonicalUrl, ogUrl, and url
  socialPreviewState.originalMetadata = {
    title,
    description,
    ogTitle,
    ogDescription,
    ogImage,
    twitterTitle,
    twitterDescription,
    twitterImage,
    siteName,
    canonicalUrl: metadata.canonicalUrl || '',
    ogUrl: metadata.ogMeta?.find(tag => tag.label === 'og:url')?.value || '',
    url: metadata.url || ''
  };
  
  // Generate social preview content for all platforms
  generateAllPreviews();
  
  // Activate the first tab if none is active
  const activeTab = document.querySelector('.social-tab.active');
  if (!activeTab) {
    const firstTab = document.querySelector('.social-tab');
    if (firstTab) {
      firstTab.click();
    }
  }
}

/**
 * Generate preview content for all platforms
 * This runs only once when metadata is loaded
 */
function generateAllPreviews() {
  console.log('Generating all social preview content');
  
  if (!socialPreviewState.originalMetadata) {
    console.warn('No metadata available for previews');
    return;
  }
  
  const metadata = socialPreviewState.originalMetadata;
  const hostname = socialPreviewState.pageHostname || 'example.com';
  // Debug log for canonicalUrl, ogUrl, url
  console.log('Google preview path debug:', {
    canonicalUrl: metadata.canonicalUrl,
    ogUrl: metadata.ogUrl,
    url: metadata.url
  });
  // Prefer canonical, then og:url, then url
  const pageUrl = metadata.canonicalUrl || metadata.ogUrl || metadata.url || '';
  
  // Get values with fallbacks
  const title = metadata.title || metadata.ogTitle || metadata.twitterTitle || '';
  const description = metadata.description || metadata.ogDescription || metadata.twitterDescription || '';
  const image = metadata.ogImage || metadata.twitterImage || '';
  const siteName = metadata.siteName || '';

  // Generate previews for each platform
  generateGooglePreview(hostname, title, description, pageUrl, siteName);
  generateFacebookPreview(hostname, metadata.ogTitle || title, metadata.ogDescription || description, image, siteName);
  generateTwitterPreview(metadata, hostname, metadata.twitterTitle || metadata.ogTitle || title, metadata.twitterDescription || metadata.ogDescription || description, metadata.twitterImage || image);
  generateLinkedInPreview(hostname, metadata.ogTitle || title, metadata.ogDescription || description, image, siteName);
  generateSlackPreview(hostname, metadata.ogTitle || title, metadata.ogDescription || description, image, siteName);
}

/**
 * Generate Google preview with metadata
 */
function generateGooglePreview(hostname, title, description, url, siteName) {
  const preview = document.getElementById('google-preview');
  if (!preview) return;

  // Use og:site_name if available, otherwise fallback to hostname
  const displaySiteName = siteName || hostname.replace(/^www\./, '');

  // Get the domain for favicon
  const domain = hostname.replace(/^www\./, '');
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}`;

  // Format the preview path as full canonical/og:url (with protocol and www) › Capitalized first path segment
  let formattedPath = '';
  if (url) {
    try {
      const parsed = new URL(url);
      const canonical = parsed.origin.replace(/\/$/, ''); // protocol + domain (with www if present)
      let firstSegment = parsed.pathname.split('/').filter(Boolean)[0] || '';
      if (firstSegment) {
        firstSegment = firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1);
        formattedPath = `${parsed.origin} › ${firstSegment}`;
      } else {
        formattedPath = parsed.origin;
      }
    } catch (e) {
      formattedPath = url;
    }
  } else {
    formattedPath = domain;
  }

  preview.innerHTML = `
    <div class="google-preview">
      <div class="preview-url">
        <img src="${faviconUrl}" alt="favicon" class="google-favicon" />
        <span class="site-name">${displaySiteName}</span>
      </div>
      <div class="preview-path">${formattedPath}</div>
      <div class="preview-title">${title || 'No title available'}</div>
      <div class="preview-description">${description || 'No description available'}</div>
    </div>
  `;
}

/**
 * Generate Facebook preview with metadata
 */
function generateFacebookPreview(hostname, title, description, image, siteName) {
  const preview = document.getElementById('facebook-preview');
  if (!preview) return;

  let facebookImage = image;
  if (!facebookImage || typeof facebookImage !== 'string' || facebookImage.trim() === '') {
    facebookImage = 'https://via.placeholder.com/1200x630?text=No+Image';
  }

  // Strip 'www.' from hostname for display
  const domain = hostname.replace(/^www\./, '');

  preview.innerHTML = `
    <div class="card-seo-facebook">
      ${facebookImage ? 
        `<img class="card-seo-facebook__image" src="${facebookImage}" alt="Facebook preview image">` :
        `<div class="preview-image-placeholder">No image available</div>`
      }
      <div class="card-seo-facebook__footer">
        <div class="card-seo-facebook__domain">${domain.toUpperCase()}</div>
        <div class="card-seo-facebook__title">${title || 'No title available'}</div>
        <div class="card-seo-facebook__description">${description || 'No description available'}</div>
      </div>
    </div>
  `;
}

/**
 * Generate Twitter preview with metadata
 */
function generateTwitterPreview(metadata, hostname, title, description, image) {
  const preview = document.getElementById('twitter-preview');
  if (!preview) return;

  // Fallback logic for Twitter card
  const cardImage = metadata.twitterImage || metadata.ogImage || image || '';
  const cardTitle = metadata.twitterTitle || metadata.ogTitle || title || '';
  const cardDescription = metadata.twitterDescription || metadata.ogDescription || description || '';
  // Strip 'www.' from hostname for display
  const cardDomain = (hostname || '').replace(/^www\./, '');

  preview.innerHTML = `
    <div class="card-seo-twitter">
      ${cardImage ?
        `<img class="card-seo-twitter__image" src="${cardImage}" alt="Twitter preview image">` :
        `<div class="preview-image-placeholder">No image available</div>`
      }
      <div class="card-seo-twitter__footer">
        <div class="card-seo-twitter__title">${cardTitle || 'No title available'}</div>
        <div class="card-seo-twitter__description">${cardDescription || 'No description available'}</div>
        <div class="card-seo-twitter__domain">${cardDomain}</div>
      </div>
    </div>
  `;
}

/**
 * Generate LinkedIn preview with metadata
 */
function generateLinkedInPreview(hostname, title, description, image, siteName) {
  const preview = document.getElementById('linkedin-preview');
  if (!preview) return;

  // Always use the hostname (domain) for LinkedIn preview, strip 'www.' if present
  const domain = hostname.replace(/^www\./, '');

  preview.innerHTML = `
    <div class="linkedin-preview">
      <img src="${image || ''}" alt="preview image" class="thumbnail" />
      <div class="text-content">
        <h3 class="title">${title || 'No title available'}</h3>
        <div class="domain">${domain || ''}</div>
      </div>
    </div>
  `;
}

/**
 * Generate Slack preview with metadata
 */
function generateSlackPreview(hostname, title, description, image, siteName) {
  const preview = document.getElementById('slack-preview');
  if (!preview) return;

  const domain = siteName || hostname;
  // Always use the actual favicon, not og:image
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}`;

  preview.innerHTML = `
    <div class="card-seo-slack">
      <div class="card-seo-slack__bar"></div>
      <div class="card-seo-slack__content">
        <div class="flex">
          <img src="${faviconUrl}" class="card-seo-slack__favicon" alt="favicon">
          <span class="card-seo-slack__link js-preview-site-name">${domain || ''}</span>
        </div>
        <div class="card-seo-slack__title js-preview-title">${title || 'No title available'}</div>
        <span class="card-seo-slack__description js-preview-description">${description || ''}</span>
        ${image ? `<div class="card-seo-slack__image js-preview-image js-slack-image" style="background-image:url('${image}')"></div>` : ''}
      </div>
    </div>
  `;
}

/**
 * Initialize theme toggle functionality
 */
function initThemeToggle() {
  const themeToggle = getCached('themeToggle');
  if (!themeToggle) return;
  
  const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  
  // Set initial theme based on user preference or localStorage
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.body.setAttribute('data-theme', savedTheme);
    state.darkMode = savedTheme === 'dark';
  } else if (prefersDarkScheme.matches) {
    document.body.setAttribute('data-theme', 'dark');
    state.darkMode = true;
  } else {
    document.body.setAttribute('data-theme', 'light');
    state.darkMode = false;
  }
  
  addTrackedListener(themeToggle, 'click', () => {
    state.darkMode = !state.darkMode;
    const newTheme = state.darkMode ? 'dark' : 'light';
    
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  });
}

/**
 * Initialize tab navigation functionality
 */
function initTabNavigation() {
  const tabButtons = document.querySelectorAll('.tab-button');
  
  tabButtons.forEach(button => {
    if (!button) return;
    
    addTrackedListener(button, 'click', () => {
      // Get the target tab ID
      const tabId = button.getAttribute('data-tab');
      if (!tabId) {
        console.warn('Tab button missing data-tab attribute');
        return;
      }
      
      // Skip if already active
      if (button.classList.contains('active')) return;
      
      // Remove active class from all tab buttons and panes
      document.querySelectorAll('.tab-button').forEach(tab => {
        if (tab && tab.classList) {
          tab.classList.remove('active');
        }
      });
      
      document.querySelectorAll('.tab-pane').forEach(pane => {
        if (pane && pane.classList) {
          pane.classList.remove('active');
        }
      });
      
      // Add active class to clicked tab button and corresponding pane
      button.classList.add('active');
      
      // Special handling for social preview tab
      const targetPaneId = tabId === 'social' ? 'social-preview-tab' : `${tabId}-tab`;
      const targetPane = document.getElementById(targetPaneId);
      
      if (targetPane && targetPane.classList) {
        targetPane.classList.add('active');
        // If this is the social preview tab, adjust the preview container height
        if (targetPaneId === 'social-preview-tab') {
          setTimeout(adjustPreviewContainerHeight, 0);
        }
      } else {
        console.warn(`Target tab pane #${targetPaneId} not found`);
      }
      
      // Initialize tooltips after tab change
      initTooltips();
    });
  });
}

/**
 * Initialize Excel export functionality
 */
function initExcelExport() {
  const exportButton = document.getElementById('export-excel');
  if (!exportButton) return;

  addTrackedListener(exportButton, 'click', async () => {
    try {
      // Add loading state
      exportButton.disabled = true;
      exportButton.classList.add('loading');
      
      await generateExcelReport();
      showToast('Excel report generated successfully!');
    } catch (error) {
      console.error('Error generating Excel report:', error);
      showToast('Failed to generate Excel report');
    } finally {
      // Remove loading state
      exportButton.disabled = false;
      exportButton.classList.remove('loading');
    }
  });
}

/**
 * Initialize impact tabs functionality
 */
function initImpactTabs() {
  const impactTabs = document.querySelectorAll('.impact-tab');
  
  impactTabs.forEach(tab => {
    addTrackedListener(tab, 'click', () => {
      // Get the target impact level
      const impactLevel = tab.getAttribute('data-impact');
      if (!impactLevel) return;
      
      // Remove active class from all tabs and panes
      document.querySelectorAll('.impact-tab').forEach(t => {
        t.classList.remove('active');
      });
      
      document.querySelectorAll('.impact-pane').forEach(pane => {
        pane.classList.remove('active');
      });
      
      // Add active class to clicked tab
      tab.classList.add('active');
      
      // Add active class to corresponding pane
      const targetPane = document.getElementById(`${impactLevel}-issues`);
      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
  });
}

/**
 * Initialize tooltips with event delegation
 */
function initTooltips() {
  // Remove any existing global handler first
  if (window.MetaPeek.tooltipHandler) {
    document.removeEventListener('mouseover', window.MetaPeek.tooltipHandler);
    document.removeEventListener('mouseout', window.MetaPeek.tooltipOutHandler);
  }

  const globalTooltip = getCached('globalTooltip');
  if (!globalTooltip) return;

  // Create handlers for event delegation
  window.MetaPeek.tooltipHandler = function(e) {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;

    const tooltipText = target.getAttribute('data-tooltip');
      if (!tooltipText) return;

      // Always define isDark at the top
      const isDark = document.body.getAttribute('data-theme') === 'dark';
    
      // Find the closest .meta-section-content ancestor
    let container = target.closest('.meta-section-content');
      if (!container) {
        container = document.body;
      }

      globalTooltip.textContent = tooltipText;
      globalTooltip.style.display = 'block';

    const rect = target.getBoundingClientRect();
      const tooltipRect = globalTooltip.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Always open below the badge (arrow on top)
      let left = rect.left - containerRect.left + (rect.width / 2) - (tooltipRect.width / 2);
      let top = rect.bottom - containerRect.top + 10;

      // Adjust if tooltip would go off screen horizontally
      if (left < 10) {
        left = 10;
      } else if (left + tooltipRect.width > containerRect.width - 10) {
        left = containerRect.width - tooltipRect.width - 10;
      }

      globalTooltip.style.left = `${left + containerRect.left}px`;
      globalTooltip.style.top = `${top + containerRect.top}px`;

    // Add arrow
      let arrow = document.createElement('div');
      arrow.className = 'tooltip-arrow';
      arrow.style.position = 'absolute';
      const badgeCenter = rect.left + rect.width / 2;
      const tooltipLeft = left + containerRect.left;
      let arrowLeft = badgeCenter - tooltipLeft;
      arrowLeft = Math.max(8, Math.min(arrowLeft, tooltipRect.width - 8));
      arrow.style.left = `${arrowLeft}px`;
      arrow.style.transform = 'translateX(-50%)';
      arrow.style.width = '0';
      arrow.style.height = '0';
      arrow.style.zIndex = '100000';
      arrow.style.top = '-6px';
      arrow.style.borderLeft = '6px solid transparent';
      arrow.style.borderRight = '6px solid transparent';
      arrow.style.borderBottom = isDark ? '6px solid #fff' : '6px solid #1f2937';
      arrow.style.borderTop = 'none';
      globalTooltip.appendChild(arrow);

    // Get computed colors
      const computedStyle = getComputedStyle(document.body);
      const borderLight = computedStyle.getPropertyValue('--border-light').trim();
      const statusGood = computedStyle.getPropertyValue('--status-good').trim();
      const statusWarning = computedStyle.getPropertyValue('--status-warning').trim();
      const statusError = computedStyle.getPropertyValue('--status-error').trim();
      const lowBgLight = computedStyle.getPropertyValue('--low-bg-light').trim();
      const lowBgDark = computedStyle.getPropertyValue('--low-bg-dark').trim();

      // Set left border based on status
      globalTooltip.style.borderLeft = '';
    if (target.classList.contains('good')) {
        globalTooltip.style.borderLeft = `7px solid ${statusGood}`;
    } else if (target.classList.contains('warning')) {
        globalTooltip.style.borderLeft = `7px solid ${statusWarning}`;
    } else if (target.classList.contains('error')) {
        globalTooltip.style.borderLeft = `7px solid ${statusError}`;
    } else if (target.classList.contains('low')) {
        globalTooltip.style.borderLeft = `7px solid ${isDark ? lowBgDark : lowBgLight}`;
      }

    // Set other borders
      globalTooltip.style.borderTop = `3px solid ${borderLight}`;
      globalTooltip.style.borderRight = `3px solid ${borderLight}`;
      globalTooltip.style.borderBottom = `3px solid ${borderLight}`;
  };

  window.MetaPeek.tooltipOutHandler = function(e) {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;
    
      globalTooltip.style.display = 'none';
      globalTooltip.textContent = '';
    const arrow = globalTooltip.querySelector('.tooltip-arrow');
      if (arrow) arrow.remove();
  };

  // Use event delegation on document
  addTrackedListener(document, 'mouseover', window.MetaPeek.tooltipHandler);
  addTrackedListener(document, 'mouseout', window.MetaPeek.tooltipOutHandler);
}

/**
 * REPLACE the updateSchemaData function (around line 680-750) with this:
 */
function updateSchemaData(schemaData) {
  const container = document.getElementById('schema-content');
  if (!container) return;
  
  if (!schemaData || schemaData.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No Schema.org data found on this page.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  
  const schemaTooltip = "Schema.org markup is structured data that helps search engines understand your content.";
  
  // Group schemas by type
  const groupedSchemas = groupSchemasByType(schemaData);

  // Sort schema types so 'Person' (Author) is last
  const schemaTypeEntries = Object.entries(groupedSchemas);
  schemaTypeEntries.sort(([a], [b]) => {
    if (a === 'Person') return 1;
    if (b === 'Person') return -1;
    return 0;
  });

  Object.entries(groupedSchemas).forEach(([schemaType, schemas], index) => {
    // Create collapsible card for each schema type
    const displayType = schemaType === 'Person' ? 'Author' : schemaType;
    const schemaCard = document.createElement('div');
    schemaCard.className = 'schema-card';
    schemaCard.setAttribute('data-schema-type', schemaType);
    
    // Create header with toggle functionality
    const header = document.createElement('div');
    header.className = 'schema-card-header collapsed';
    header.innerHTML = `
      <div class="schema-type-info">
        <span class="schema-type-name">${displayType}</span>
      </div>
      <svg class="expand-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;
    
    // Create content container
    const content = document.createElement('div');
    content.className = 'schema-card-content collapsed';
    
    // Add properties for all schemas of this type
    schemas.forEach((schema, schemaIndex) => {
      if (schema.valid && schema.data) {
        // Properties to check in order
        let propertiesToCheck = [
          { key: '@type', label: '@type' },
          { key: 'url', label: 'url' },
          { key: 'name', label: 'name' },
          { key: 'description', label: 'description' },
          { key: 'datePublished', label: 'datePublished' },
          { key: 'dateModified', label: 'dateModified' },
          { key: 'author', label: 'author name', isAuthor: true }
        ];
        // Remove description for Person/author
        if (schemaType === 'Person') {
          propertiesToCheck = propertiesToCheck.filter(p => p.key !== 'description');
        }
        
        // Check each property and add rows for ones that have values
        propertiesToCheck.forEach(prop => {
          let value = getPropertyValue(schema.data, prop);
          
          if (value) {
            const row = document.createElement('div');
            row.className = 'meta-row';
            
            row.innerHTML = `
              <div class="meta-cell name">${prop.label}</div>
              <div class="meta-cell value">${value}</div>
              <div class="meta-cell status">
                <span class="status-badge good">
                  Present
                </span>
              </div>
            `;
            
            content.appendChild(row);
          }
        });
        
        // Add separator between multiple schemas of same type
        if (schemaIndex < schemas.length - 1 && content.children.length > 0) {
          const separator = document.createElement('div');
          separator.className = 'schema-item-separator';
          content.appendChild(separator);
        }
      }
    });
    
    // Add click handler for accordion functionality
    addTrackedListener(header, 'click', function() {
      toggleSchemaCard(schemaCard);
    });
    
    schemaCard.appendChild(header);
    schemaCard.appendChild(content);
    container.appendChild(schemaCard);
  });
  
  // Initialize tooltips after updating the badges
  initTooltips();
}

/**
 * Groups schema data by their @type property
 * @param {Array<Object>} schemaData - Array of schema objects to group
 * @returns {Object} Object with schema types as keys and arrays of schemas as values
 */
function groupSchemasByType(schemaData) {
  // Early return for invalid input
  if (!Array.isArray(schemaData) || schemaData.length === 0) {
    return Object.create(null);
    }

  // Use Object.create(null) for better performance and no prototype pollution
  const grouped = Object.create(null);
  
  // Single loop with optimized type checking
  for (const schema of schemaData) {
    // Skip invalid schemas early
    if (!schema?.valid || !schema?.data?.['@type']) continue;
    
    // Get schema type, handling both array and single value cases
      const schemaType = Array.isArray(schema.data['@type']) 
        ? schema.data['@type'][0] 
        : schema.data['@type'];
      
    // Initialize array if needed and push schema
    (grouped[schemaType] ||= []).push(schema);
      }
  
  return grouped;
}

function toggleSchemaCard(clickedCard) {
  const container = document.getElementById('schema-content');
  const allCards = container.querySelectorAll('.schema-card');

  // Close all other cards
  allCards.forEach(card => {
    if (card !== clickedCard) {
      const header = card.querySelector('.schema-card-header');
      const content = card.querySelector('.schema-card-content');
      const arrow = card.querySelector('.expand-arrow');

      header.classList.remove('expanded');
      header.classList.add('collapsed');
      content.classList.remove('expanded');
      content.classList.add('collapsed');
      arrow.classList.remove('expanded');
    }
  });

  // Toggle the clicked card
  const header = clickedCard.querySelector('.schema-card-header');
  const content = clickedCard.querySelector('.schema-card-content');
  const arrow = clickedCard.querySelector('.expand-arrow');

  if (header.classList.contains('expanded')) {
    // Collapse this card
    header.classList.remove('expanded');
    header.classList.add('collapsed');
    content.classList.remove('expanded');
    content.classList.add('collapsed');
    arrow.classList.remove('expanded');
  } else {
    // Expand this card
    header.classList.remove('collapsed');
    header.classList.add('expanded');
    content.classList.remove('collapsed');
    content.classList.add('expanded');
    arrow.classList.add('expanded');
  }
}

function getPropertyValue(data, prop) {
  let value = data[prop.key];
  
  if (!value) return null;
  
  // Handle @type specifically
  if (prop.key === '@type') {
    return Array.isArray(value) ? value.join(', ') : value;
  }
  
  // Handle author name extraction
  if (prop.isAuthor) {
    return extractAuthorName(value);
  }
  
  // Handle regular properties
  if (typeof value === 'string') {
    return value;
  }
  
  if (typeof value === 'object' && value !== null) {
    // If it's an object, try to get name or @id
    if (value.name) return value.name;
    if (value['@id']) return value['@id'];
    if (value.url) return value.url;
    return '[Object]';
  }
  
  return String(value);
}

function extractAuthorName(authorData) {
  if (!authorData) return null;
  
  // If it's a string, return it directly
  if (typeof authorData === 'string') {
    return authorData;
  }
  
  // If it's an array, process each author
  if (Array.isArray(authorData)) {
    const names = authorData.map(author => {
      if (typeof author === 'string') return author;
      if (author.name) return author.name;
      if (author.givenName && author.familyName) {
        return `${author.givenName} ${author.familyName}`;
      }
      if (author.givenName) return author.givenName;
      if (author.familyName) return author.familyName;
      return null;
    }).filter(name => name);
    
    return names.length > 0 ? names.join(', ') : null;
  }
  
  // If it's an object, extract name
  if (typeof authorData === 'object') {
    if (authorData.name) return authorData.name;
    if (authorData.givenName && authorData.familyName) {
      return `${authorData.givenName} ${authorData.familyName}`;
    }
    if (authorData.givenName) return authorData.givenName;
    if (authorData.familyName) return authorData.familyName;
  }
  
  return null;
}

/**
 * Generate comprehensive Excel report with multiple sheets
 */
async function generateExcelReport() {
  // Import XLSX if not already available
  if (typeof XLSX === 'undefined') {
    throw new Error('XLSX library not loaded');
  }
  
  // Get current tab info
  const tabs = await chrome.tabs.query({active: true, currentWindow: true});
  if (!tabs || !tabs[0]) {
    throw new Error('No active tab found');
  }
  
  const currentUrl = tabs[0].url;
  const hostname = new URL(currentUrl).hostname.replace('www.', '');
  const timestamp = new Date().toISOString().split('T')[0];
  
  // Create a new workbook
  const wb = XLSX.utils.book_new();
  
  // Add sheets with comprehensive data
  addOverviewSheet(wb);
  addAllMetaTagsSheet(wb);  // UPDATED: Combined meta tags sheet
  addSchemaSheet(wb);       // UPDATED: Filtered schema properties
  addIssuesSheet(wb);
  addTechnicalDetailsSheet(wb, currentUrl);
  
  // Generate filename
  const filename = `SEO_Audit_${hostname}_${timestamp}.xlsx`;
  
  // Write the file
  XLSX.writeFile(wb, filename);
}

/**
 * Add All Meta Tags in one sheet with section headings
 */
function addAllMetaTagsSheet(wb) {
  const data = [];
  
  // Main header
  data.push(['All Meta Tags Analysis']);
  data.push([]);
  
  // Headers
  data.push(['Category', 'Tag Name', 'Value', 'Status', 'Character Count', 'Recommendation']);
  
  // === BASIC META TAGS SECTION ===
  data.push([]);
  data.push(['BASIC META TAGS', '', '', '', '', '']);
  
  const basicMeta = state.metadata?.basicMeta || [];
  basicMeta.forEach(tag => {
    const charCount = tag.value ? tag.value.length : 0;
    data.push([
      'Basic Meta',
      tag.label,
      tag.value || 'Not set',
      tag.status || 'missing',
      charCount,
      tag.message || ''
    ]);
  });
  
  // === OPEN GRAPH TAGS SECTION ===
  data.push([]);
  data.push(['OPEN GRAPH TAGS', '', '', '', '', '']);
  
  const ogMeta = state.metadata?.ogMeta || [];
  ogMeta.forEach(tag => {
    const charCount = tag.value ? tag.value.length : 0;
    data.push([
      'Open Graph',
      tag.label,
      tag.value || 'Not set',
      tag.status || 'missing',
      charCount,
      tag.message || ''
    ]);
  });
  
  // === TWITTER CARD TAGS SECTION ===
  data.push([]);
  data.push(['TWITTER CARD TAGS', '', '', '', '', '']);
  
  const twitterMeta = state.metadata?.twitterMeta || [];
  twitterMeta.forEach(tag => {
    const charCount = tag.value ? tag.value.length : 0;
    data.push([
      'Twitter Card',
      tag.label,
      tag.value || 'Not set',
      tag.status || 'missing',
      charCount,
      tag.message || ''
    ]);
  });
  
  // Add notes
  data.push([]);
  data.push(['NOTES:', '', '', '', '', '']);
  data.push(['', '• Basic Meta tags are fundamental for SEO and browser display', '', '', '', '']);
  data.push(['', '• Open Graph tags control social media previews (Facebook, LinkedIn)', '', '', '', '']);
  data.push(['', '• Twitter Card tags control how content appears on Twitter/X', '', '', '', '']);
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 15 },  // Category
    { wch: 20 },  // Tag Name
    { wch: 50 },  // Value
    { wch: 10 },  // Status
    { wch: 15 },  // Character Count
    { wch: 40 }   // Recommendation
  ];
  
  // Style headers
  // Main title
  if (ws['A1']) {
    ws['A1'].s = {
      font: { bold: true, sz: 16 },
      alignment: { horizontal: 'center' }
    };
  }
  
  // Section headers (Basic Meta Tags, Open Graph Tags, Twitter Card Tags)
  const sectionRows = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] && data[i][0].includes('TAGS')) {
      sectionRows.push(i);
    }
  }
  
  sectionRows.forEach(row => {
    const cellAddress = `A${row + 1}`;
    if (ws[cellAddress]) {
      ws[cellAddress].s = {
        font: { bold: true, sz: 14 },
        fill: { fgColor: { rgb: "E0E0E0" } }
      };
    }
  });
  
  // Merge cells for main title and section headers
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }  // Merge A1:F1 for title
  ];
  
  // Merge section header rows
  sectionRows.forEach(row => {
    ws['!merges'].push({ s: { r: row, c: 0 }, e: { r: row, c: 5 } });
  });
  
  XLSX.utils.book_append_sheet(wb, ws, 'Meta Tags');
}

/**
 * Add filtered Schema.org Data sheet
 */
function addSchemaSheet(wb) {
  const data = [];
  
  // Properties to exclude
  const excludeProperties = ['isPartOf', 'about', 'description', 'breadcrumb', 'inLanguage', '@context'];
  
  // Headers
  data.push(['Schema Type', 'Property', 'Value']);
  
  // Get schema data
  const schemaData = state.metadata?.schemaData || [];
  
  if (schemaData.length === 0) {
    data.push(['No Schema.org data found', '', '']);
  } else {
    schemaData.forEach((schema, index) => {
      if (schema.valid && schema.data) {
        const schemaType = Array.isArray(schema.data['@type']) ? 
          schema.data['@type'].join(', ') : 
          schema.data['@type'] || 'Unknown';
        
        // Add empty row between schemas
        if (index > 0) data.push(['', '', '']);
        
        // Add schema type header row
        data.push([schemaType.toUpperCase(), '', '']);
        
        // Add properties (filtered)
        Object.entries(schema.data).forEach(([key, value]) => {
          // Skip excluded properties
          if (!excludeProperties.includes(key)) {
            let displayValue = '';
            
            // Special handling for certain properties
            if (key === 'author' && typeof value === 'object') {
              displayValue = value.name || JSON.stringify(value);
            } else if (typeof value === 'object') {
              displayValue = JSON.stringify(value, null, 2);
            } else {
              displayValue = String(value);
            }
            
            data.push(['', key, displayValue]);
          }
        });
      }
    });
  }
  
  // Add note
  data.push([]);
  data.push(['Note: Schema.org structured data helps search engines understand your content and can enable rich results.']);
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 20 },  // Schema Type
    { wch: 25 },  // Property
    { wch: 60 }   // Value
  ];
  
  // Style schema type headers
  for (let i = 0; i < data.length; i++) {
    if (data[i][0] && data[i][0] === data[i][0].toUpperCase() && data[i][0].length > 1) {
      const cellAddress = `A${i + 1}`;
      if (ws[cellAddress]) {
        ws[cellAddress].s = {
          font: { bold: true, sz: 12 },
          fill: { fgColor: { rgb: "F0F0F0" } }
        };
      }
    }
  }
  
  XLSX.utils.book_append_sheet(wb, ws, 'Schema.org Data');
}

/**
 * Add Overview sheet with SEO score and summary
 */
function addOverviewSheet(wb) {
  const data = [];
  
  // Header
  data.push(['MetaPeek SEO Audit Report']);
  data.push([]);
  
  // Get SEO score data
  const scoreData = state.metadata?.seoScore || {};
  const score = scoreData.score || 0;
  const status = scoreData.status || 'error';
  
  // SEO Score section
  data.push(['SEO Score', score + '/100']);
  data.push(['Status', status.charAt(0).toUpperCase() + status.slice(1)]);
  data.push([]);
  
  // Score breakdown
  data.push(['Category', 'Score', 'Weight', 'Weighted Score']);
  data.push(['Basic Meta Tags', Math.round((scoreData.categoryScores?.basicMeta || 0) * 100) + '%', '35%', Math.round((scoreData.categoryScores?.basicMeta || 0) * 35) + '%']);
  data.push(['Social Media Tags', Math.round((scoreData.categoryScores?.socialMeta || 0) * 100) + '%', '25%', Math.round((scoreData.categoryScores?.socialMeta || 0) * 25) + '%']);
  data.push(['Technical Factors', Math.round((scoreData.categoryScores?.technical || 0) * 100) + '%', '25%', Math.round((scoreData.categoryScores?.technical || 0) * 25) + '%']);
  data.push(['Structured Data', Math.round((scoreData.categoryScores?.structured || 0) * 100) + '%', '15%', Math.round((scoreData.categoryScores?.structured || 0) * 15) + '%']);
  data.push([]);
  
  // Key findings
  data.push(['Key Findings']);
  const recommendations = scoreData.recommendations || [];
  let issueCount = 0;
  recommendations.forEach(category => {
    if (category.items) {
      issueCount += category.items.length;
    }
  });
  data.push(['Total Issues Found', issueCount]);
  data.push(['High Impact Issues', recommendations.reduce((acc, cat) => acc + (cat.items?.filter(i => i.impact === 'High')?.length || 0), 0)]);
  data.push(['Medium Impact Issues', recommendations.reduce((acc, cat) => acc + (cat.items?.filter(i => i.impact === 'Medium')?.length || 0), 0)]);
  data.push(['Low Impact Issues', recommendations.reduce((acc, cat) => acc + (cat.items?.filter(i => i.impact === 'Low')?.length || 0), 0)]);
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 25 },  // Category
    { wch: 15 },  // Score
    { wch: 15 },  // Weight
    { wch: 20 }   // Weighted Score
  ];
  
  // Style header
  if (ws['A1']) {
    ws['A1'].s = {
      font: { bold: true, sz: 16 },
      alignment: { horizontal: 'center' }
    };
  }
  
  // Merge header cells
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }  // Merge A1:D1
  ];
  
  XLSX.utils.book_append_sheet(wb, ws, 'Overview');
}

/**
 * Add Basic Meta Tags sheet
 */
function addBasicMetaSheet(wb) {
  const data = [];
  
  // Headers
  data.push(['Tag Name', 'Value', 'Status', 'Character Count', 'Recommendation']);
  
  // Get basic meta tags
  const basicMeta = state.metadata?.basicMeta || [];
  
  basicMeta.forEach(tag => {
    const charCount = tag.value ? tag.value.length : 0;
    data.push([
      tag.label,
      tag.value || 'Not set',
      tag.status || 'missing',
      charCount,
      tag.message || ''
    ]);
  });
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 15 },  // Tag Name
    { wch: 50 },  // Value
    { wch: 10 },  // Status
    { wch: 15 },  // Character Count
    { wch: 40 }   // Recommendation
  ];
  
  // Style header row
  const headerRange = XLSX.utils.decode_range(ws['!ref']);
  for (let C = headerRange.s.c; C <= headerRange.e.c; ++C) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[cellAddress]) continue;
    ws[cellAddress].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: "E0E0E0" } }
    };
  }
  
  XLSX.utils.book_append_sheet(wb, ws, 'Basic Meta Tags');
}

/**
 * Add Open Graph Tags sheet
 */
function addOpenGraphSheet(wb) {
  const data = [];
  
  // Headers
  data.push(['Property', 'Value', 'Status', 'Character Count', 'Recommendation']);
  
  // Get OG meta tags
  const ogMeta = state.metadata?.ogMeta || [];
  
  ogMeta.forEach(tag => {
    const charCount = tag.value ? tag.value.length : 0;
    data.push([
      tag.label,
      tag.value || 'Not set',
      tag.status || 'missing',
      charCount,
      tag.message || ''
    ]);
  });
  
  // Add note about Open Graph
  data.push([]);
  data.push(['Note: Open Graph tags control how your content appears when shared on social media platforms like Facebook, LinkedIn, and others.']);
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 20 },  // Property
    { wch: 50 },  // Value
    { wch: 10 },  // Status
    { wch: 15 },  // Character Count
    { wch: 40 }   // Recommendation
  ];
  
  XLSX.utils.book_append_sheet(wb, ws, 'Open Graph Tags');
}

/**
 * Add Twitter Card Tags sheet
 */
function addTwitterCardSheet(wb) {
  const data = [];
  
  // Headers
  data.push(['Property', 'Value', 'Status', 'Character Count', 'Recommendation']);
  
  // Get Twitter meta tags
  const twitterMeta = state.metadata?.twitterMeta || [];
  
  twitterMeta.forEach(tag => {
    const charCount = tag.value ? tag.value.length : 0;
    data.push([
      tag.label,
      tag.value || 'Not set',
      tag.status || 'missing',
      charCount,
      tag.message || ''
    ]);
  });
  
  // Add note about Twitter Cards
  data.push([]);
  data.push(['Note: Twitter Card tags control how your content appears when shared on Twitter/X.']);
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 20 },  // Property
    { wch: 50 },  // Value
    { wch: 10 },  // Status
    { wch: 15 },  // Character Count
    { wch: 40 }   // Recommendation
  ];
  
  XLSX.utils.book_append_sheet(wb, ws, 'Twitter Card Tags');
}

/**
 * Add Issues & Recommendations sheet
 */
function addIssuesSheet(wb) {
  const data = [];
  
  // Headers
  data.push(['Category', 'Issue', 'Impact', 'Details', 'Fix Priority']);
  
  // Get recommendations
  const recommendations = state.metadata?.seoScore?.recommendations || [];
  
  recommendations.forEach(category => {
    if (category.items) {
      category.items.forEach(item => {
        // Determine fix priority based on impact
        let priority = 'Low';
        if (item.impact === 'High') priority = 'Urgent';
        else if (item.impact === 'Medium') priority = 'Normal';
        
        data.push([
          category.category,
          item.issue,
          item.impact,
          item.details,
          priority
        ]);
      });
    }
  });
  
  if (data.length === 1) {
    data.push(['No issues found', '', '', '', '']);
  }
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 20 },  // Category
    { wch: 30 },  // Issue
    { wch: 10 },  // Impact
    { wch: 50 },  // Details
    { wch: 12 }   // Fix Priority
  ];
  
  XLSX.utils.book_append_sheet(wb, ws, 'Issues & Recommendations');
}

/**
 * Add Technical Details sheet
 */
function addTechnicalDetailsSheet(wb, url) {
  const data = [];
  
  // Headers
  data.push(['Technical SEO Audit Details']);
  data.push([]);
  
  // Page information
  data.push(['Page Information']);
  data.push(['URL', url]);
  data.push(['Audit Date', new Date().toLocaleString()]);
  data.push(['Protocol', url.startsWith('https') ? 'HTTPS (Secure)' : 'HTTP (Not Secure)']);
  data.push([]);
  
  // Canonical URL
  data.push(['Canonical Information']);
  const canonicalUrl = state.metadata?.canonicalUrl || '';
  data.push(['Canonical URL', canonicalUrl || 'Not set']);
  data.push(['Matches Current URL', canonicalUrl === url ? 'Yes' : 'No']);
  data.push([]);
  
  // Character counts
  data.push(['Content Length Analysis']);
  const title = state.metadata?.basicMeta?.find(tag => tag.label === 'Title')?.value || '';
  const description = state.metadata?.basicMeta?.find(tag => tag.label === 'Description')?.value || '';
  
  data.push(['Title Length', title.length + ' characters', title.length < 30 ? 'Too short' : title.length > 60 ? 'Too long' : 'Optimal']);
  data.push(['Description Length', description.length + ' characters', description.length < 120 ? 'Too short' : description.length > 160 ? 'Too long' : 'Optimal']);
  data.push([]);
  
  // Mobile readiness
  const viewport = state.metadata?.basicMeta?.find(tag => tag.label === 'Viewport')?.value || '';
  data.push(['Mobile Optimization']);
  data.push(['Viewport Tag', viewport || 'Not set']);
  data.push(['Mobile Ready', viewport.includes('width=device-width') ? 'Yes' : 'No']);
  data.push([]);
  
  // Robots directives
  const robots = state.metadata?.basicMeta?.find(tag => tag.label === 'Robots')?.value || '';
  data.push(['Search Engine Directives']);
  data.push(['Robots Meta', robots || 'Not set (defaults to index, follow)']);
  
  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 25 },  // Label
    { wch: 50 },  // Value
    { wch: 20 }   // Status
  ];
  
  // Style section headers
  [0, 3, 6, 10, 15, 19].forEach(row => {
    const cellAddress = `A${row + 1}`;
    if (ws[cellAddress]) {
      ws[cellAddress].s = {
        font: { bold: true, sz: 14 }
      };
    }
  });
  
  XLSX.utils.book_append_sheet(wb, ws, 'Technical Details');
}

/**
 * Initialize meta section tabs functionality
 */
function initMetaSectionTabs() {
  const metaSectionTabs = document.querySelectorAll('.meta-section-tab');
  
  metaSectionTabs.forEach(tab => {
    addTrackedListener(tab, 'click', () => {
      // Get the target pane ID
      const targetId = tab.getAttribute('data-target');
      if (!targetId) return;
      
      // Remove active class from all tabs and panes
      document.querySelectorAll('.meta-section-tab').forEach(t => {
        t.classList.remove('active');
      });
      
      document.querySelectorAll('.meta-section-pane').forEach(pane => {
        pane.classList.remove('active');
      });
      
      // Add active class to clicked tab
      tab.classList.add('active');
      
      // Add active class to corresponding pane
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
      }
      
      // Initialize tooltips after meta section tab change
      initTooltips();
    });
  });
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 */
function showToast(message) {
  const toast = getCached('toast');
  if (!toast) {
    // Create toast if it doesn't exist
    const newToast = document.createElement('div');
    newToast.id = 'toast';
    newToast.className = 'toast';
    newToast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <span>${message}</span>
    `;
    document.body.appendChild(newToast);
    
    // Cache the new toast
    window.MetaPeek.domCache.set('toast', newToast);
    
    // Show it after a brief delay
    setTimeout(() => {
      newToast.classList.add('show');
    }, 100);
    
    // Hide after 3 seconds
    setTimeout(() => {
      newToast.classList.remove('show');
    }, 3000);
    
    return;
  }
  
  const toastMessage = toast.querySelector('span');
  if (toastMessage) {
    toastMessage.textContent = message;
  }
  
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}