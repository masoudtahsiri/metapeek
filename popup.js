/**
 * MetaPeek Popup
 * Displays metadata and SEO information for the current page
 */

console.log('MetaPeek popup initialized');

// Configuration
const CONFIG = {
  loadingTimeout: 5000,            // Timeout for loading data (ms)
  toastDuration: 3000,             // Duration to show toast messages (ms)
  metricThresholds: {
    lcp: [2500, 4000],             // LCP thresholds in ms (good, poor)
    cls: [0.1, 0.25],              // CLS thresholds (good, poor)
    inp: [200, 500],               // INP thresholds in ms (good, poor)
    fcp: [1800, 3000],             // FCP thresholds in ms (good, poor)
    ttfb: [800, 1800]              // TTFB thresholds in ms (good, poor)
  }
};

// Initialize MetaPeek namespace if it doesn't exist
window.MetaPeek = window.MetaPeek || {
  initialized: false,
  webVitalsInitialized: false,
  cachedMetrics: null,
  lastMetricsUpdate: 0
};

// State
const state = {
  metadata: null,
  webVitalsInitialized: false,
  darkMode: false,
  loading: {
    metadata: false,
    webVitals: false
  },
  errors: {
    metadata: null,
    webVitals: null
  }
};

// Global preview state
const previewState = {
  currentPlatform: 'google',
  currentDevice: 'desktop',
  editMode: false,
  originalMetadata: null,
  editedMetadata: null,
  lastMetricsUpdate: 0,
  cachedMetrics: null,
  pageHostname: null
};

/**
 * Document Ready Handler
 * Initialize the app when the DOM is fully loaded
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup DOM loaded');
  
  // Initialize UI components
  initUI();
  
  // Load data from the active tab
  loadPageData();
  initCollapsibleSections();
});

/**
 * Initialize all UI components
 */
function initUI() {
  try {
    initThemeToggle();
    initTabNavigation();
    initSocialPreviews();
    initCopyButtons();
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
    // Store the real hostname for previews
    try {
      previewState.pageHostname = new URL(activeTab.url).hostname;
    } catch (e) {
      previewState.pageHostname = activeTab.url;
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
  
  // Initialize web vitals data collection
  initializeWebVitals();
}

/**
 * Initialize Web Vitals metrics collection
 */
function initializeWebVitals() {
  try {
    // Don't re-initialize if already done with recent data
    if (window.MetaPeek.webVitalsInitialized && 
        window.MetaPeek.cachedMetrics && 
        (Date.now() - window.MetaPeek.lastMetricsUpdate < CONFIG.loadingTimeout)) {
      // Notify that we have metrics available
      try {
        chrome.runtime.sendMessage({ 
          type: 'webVitalsUpdate', 
          data: window.MetaPeek.cachedMetrics,
          cached: true
        }).catch(() => {
          // Ignore errors from closed message channels
          console.debug('Message channel closed, metrics already cached');
        });
      } catch (error) {
        // Handle extension context invalidation
        console.debug('Extension context invalidated, using cached metrics');
      }
      
      return window.MetaPeek.cachedMetrics;
    }
    
    // Mark as initialized
    window.MetaPeek.webVitalsInitialized = true;
    
    // Create storage for metrics
    const metrics = {
      lcp: null,
      cls: null,
      inp: null,
      fcp: null, 
      ttfb: null,
      metricsCollected: false,
      partialMetricsAvailable: false,
      timestamp: Date.now()
    };
    
    window.MetaPeek.cachedMetrics = metrics;
    
    // Function to notify about metrics updates
    function notifyMetricsUpdate(updatedMetrics, metricName) {
      try {
        // Mark that we have at least some metrics
        updatedMetrics.partialMetricsAvailable = true;
        
        // Cache the metrics
        window.MetaPeek.cachedMetrics = {...updatedMetrics};
        window.MetaPeek.lastMetricsUpdate = Date.now();
        
        // Send an update with the metric that changed
        chrome.runtime.sendMessage({ 
          type: 'webVitalsUpdate', 
          data: updatedMetrics,
          updatedMetric: metricName,
          cached: false
        }).catch(() => {
          // Ignore errors from closed message channels
          console.debug('Message channel closed, metrics cached locally');
        });
      } catch (error) {
        // Handle extension context invalidation
        console.debug('Extension context invalidated, metrics cached locally');
      }
    }
    
    // Initialize Web Vitals collection
    initializeWebVitalsCollection(metrics, notifyMetricsUpdate);
    
    return metrics;
  } catch (error) {
    console.error('Error initializing web vitals:', error);
    return null;
  }
}

/**
 * Initialize Web Vitals collection using the web-vitals library or fallbacks
 * @param {Object} metrics - Metrics object to populate
 * @param {Function} notifyMetricsUpdate - Function to call when metrics are updated
 */
function initializeWebVitalsCollection(metrics, notifyMetricsUpdate) {
  try {
    // Check if web-vitals library is available
    if (typeof webVitals !== 'undefined') {
      console.log('Web Vitals library found, initializing...');
      initializeWebVitalsWithLibrary(metrics, notifyMetricsUpdate);
    } else {
      console.warn('Web Vitals library not available, using fallbacks');
      // Try to load the library from the content script
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs && tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'getWebVitals' }, (response) => {
            if (response && response.metrics) {
              // Use metrics from content script
              Object.assign(metrics, response.metrics);
              notifyMetricsUpdate(metrics, 'content-script');
            } else {
              // Fall back to Performance API
              usePerformanceAPIFallback(metrics, notifyMetricsUpdate);
            }
          });
        } else {
          // Fall back to Performance API
          usePerformanceAPIFallback(metrics, notifyMetricsUpdate);
        }
      });
    }
  } catch (error) {
    console.error('Error initializing Web Vitals:', error);
    usePerformanceAPIFallback(metrics, notifyMetricsUpdate);
  }
}

/**
 * Initialize Web Vitals using the web-vitals library
 * @param {Object} metrics - Metrics object to populate
 * @param {Function} notifyMetricsUpdate - Function to call when metrics are updated
 */
function initializeWebVitalsWithLibrary(metrics, notifyMetricsUpdate) {
  try {
    // Fast metrics - collect these first
    webVitals.onTTFB(metric => {
      metrics.ttfb = metric.value;
      notifyMetricsUpdate(metrics, 'ttfb');
    });
    
    webVitals.onFCP(metric => {
      metrics.fcp = metric.value;
      notifyMetricsUpdate(metrics, 'fcp');
    });
    
    // Slower metrics - These take longer to calculate
    webVitals.onLCP(metric => {
      metrics.lcp = metric.value;
      metrics.metricsCollected = true;
      notifyMetricsUpdate(metrics, 'lcp');
    });
    
    webVitals.onCLS(metric => {
      metrics.cls = metric.value;
      metrics.metricsCollected = true;
      notifyMetricsUpdate(metrics, 'cls');
    });
    
    webVitals.onINP(metric => {
      metrics.inp = metric.value;
      metrics.metricsCollected = true;
      notifyMetricsUpdate(metrics, 'inp');
    });
    
    console.log('Web Vitals initialized successfully');
  } catch (error) {
    console.error('Error using Web Vitals library:', error);
    usePerformanceAPIFallback(metrics, notifyMetricsUpdate);
  }
}

/**
 * Use Performance API as fallback when web-vitals library is not available
 * @param {Object} metrics - Metrics object to populate
 * @param {Function} notifyMetricsUpdate - Function to call when metrics are updated
 */
function usePerformanceAPIFallback(metrics, notifyMetricsUpdate) {
  try {
    // Basic Performance API fallback for TTFB
    const navEntry = performance.getEntriesByType('navigation')[0];
    if (navEntry) {
      metrics.ttfb = navEntry.responseStart;
      notifyMetricsUpdate(metrics, 'ttfb');
    }
    
    // Use Performance Observer for FCP
    const paintObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          metrics.fcp = entry.startTime;
          notifyMetricsUpdate(metrics, 'fcp');
        }
      }
    });
    
    paintObserver.observe({ entryTypes: ['paint'] });
    
    // Use Performance Observer for LCP
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        metrics.lcp = lastEntry.startTime;
        metrics.metricsCollected = true;
        notifyMetricsUpdate(metrics, 'lcp');
      }
    });
    
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    
    // Use Performance Observer for CLS
    const clsObserver = new PerformanceObserver((entryList) => {
      let clsValue = 0;
      for (const entry of entryList.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      metrics.cls = clsValue;
      metrics.metricsCollected = true;
      notifyMetricsUpdate(metrics, 'cls');
    });
    
    clsObserver.observe({ entryTypes: ['layout-shift'] });
    
    // Disconnect observers after 10 seconds to avoid memory leaks
    setTimeout(() => {
      paintObserver.disconnect();
      lcpObserver.disconnect();
      clsObserver.disconnect();
    }, 10000);
    
  } catch (error) {
    console.error('Error with Performance API fallback:', error);
    // Set partial metrics available flag
    metrics.partialMetricsAvailable = true;
    notifyMetricsUpdate(metrics, 'fallback');
  }
}

/**
 * Poll for Web Vitals updates
 */
function pollWebVitals() {
  if (!state.metadata) return;
  
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!tabs || !tabs[0]) return;
      
      chrome.tabs.sendMessage(tabs[0].id, { type: 'getWebVitals' })
        .then(response => {
          if (response && response.metrics) {
            updatePerformanceMetrics(response.metrics);
          }
        })
        .catch(error => {
          // Handle message channel errors gracefully
          console.debug('Error polling web vitals:', error.message);
        });
    });
  } catch (error) {
    // Handle extension context invalidation
    console.debug('Extension context invalidated during web vitals polling');
  }
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
    el.parentNode.innerHTML = errorHTML;
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
    
    // Update social previews
    updateSocialPreviews(metadata);
    
    // Update performance if available
    if (metadata.performance && (metadata.performance.partialMetricsAvailable || metadata.performance.metricsCollected)) {
      updatePerformanceMetrics(metadata.performance);
    }
    
    console.log('UI update complete');
  } catch (error) {
    console.error('Error populating UI:', error);
    showError('Error displaying data: ' + error.message);
  }
}

/**
 * Update SEO Score display
 * @param {Object} scoreData - SEO score data
 */
function updateSEOScore(scoreData) {
  if (!scoreData) return;
  
  const scoreCircle = document.querySelector('.score-circle');
  const scoreValue = document.querySelector('.score-value');
  const scoreTitle = document.querySelector('.score-title');
  const scoreDescription = document.querySelector('.score-description');
  
  if (scoreValue) {
    scoreValue.textContent = scoreData.score || '--';
  }
  
  if (scoreCircle) {
    scoreCircle.style.setProperty('--progress', `${scoreData.score || 0}%`);
    
    // Set color based on score
    if (scoreData.score >= 80) {
      scoreCircle.className = 'score-circle good';
    } else if (scoreData.score >= 60) {
      scoreCircle.className = 'score-circle warning';
    } else {
      scoreCircle.className = 'score-circle error';
    }
  }
  
  if (scoreTitle) {
    if (scoreData.score >= 80) {
      scoreTitle.textContent = 'Good SEO Health';
    } else if (scoreData.score >= 60) {
      scoreTitle.textContent = 'Average SEO Health';
    } else {
      scoreTitle.textContent = 'Poor SEO Health';
    }
  }
  
  if (scoreDescription) {
    if (scoreData.score >= 80) {
      scoreDescription.textContent = 'Your page is well-optimized for search engines.';
    } else if (scoreData.score >= 60) {
      scoreDescription.textContent = 'Your page has some optimization issues to address.';
    } else {
      scoreDescription.textContent = 'Your page needs significant SEO improvements.';
    }
  }
}

/**
 * Update priority issues section
 * @param {Object} metadata - Metadata from content script
 */
function updatePriorityIssues(metadata) {
  const issuesContainer = document.querySelector('.issues-list');
  const issueBadge = document.querySelector('.section-title .badge');
  
  if (!issuesContainer || !metadata.seoScore) return;
  
  // Clear existing issues
  issuesContainer.innerHTML = '';
  
  // Get recommendations from metadata
  const recommendations = metadata.seoScore.recommendations || [];
  
  // Filter to get only high and medium impact items
  const priorityIssues = [];
  
  recommendations.forEach(category => {
    if (category.items) {
      category.items.forEach(item => {
        if (item.impact === 'High' || item.impact === 'Medium') {
          priorityIssues.push({
            title: item.issue,
            description: item.details,
            impact: item.impact
          });
        }
      });
    }
  });
  
  // Update counter badge
  if (issueBadge) {
    issueBadge.textContent = priorityIssues.length;
  }
  
  // Add issues to container
  if (priorityIssues.length > 0) {
    priorityIssues.forEach(issue => {
      const issueElement = document.createElement('div');
      issueElement.className = `issue-item ${issue.impact.toLowerCase()}`;
      
      issueElement.innerHTML = `
        <div class="issue-header">
          <h4>${issue.title}</h4>
          <span class="issue-impact ${issue.impact.toLowerCase()}">${issue.impact} Impact</span>
        </div>
        <p class="issue-description">${issue.description}</p>
      `;
      
      issuesContainer.appendChild(issueElement);
    });
  } else {
    // Show no issues message
    issuesContainer.innerHTML = `
      <div class="empty-state">
        <p>No priority issues found. Your page is looking good!</p>
      </div>
    `;
  }
}

/**
 * Update meta tag summary in Overview tab - simplified to show only status
 * @param {Object} metadata - Metadata from content script
 */
function updateMetaTagSummary(metadata) {
  const summaryGrid = document.querySelector('.summary-grid');
  if (!summaryGrid) return;
  
  const cards = summaryGrid.querySelectorAll('.summary-card');
  
  // Update title card - only update status badge
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
    
    // Remove content element if it exists
    const contentElement = cards[0].querySelector('.summary-content');
    if (contentElement) {
      contentElement.remove();
    }
    
    // Remove warning banner if it exists
    const warningBanner = cards[0].querySelector('.warning-banner');
    if (warningBanner) {
      warningBanner.remove();
    }
  }
  
  // Update description card - only update status badge
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
    
    // Remove content element if it exists
    const contentElement = cards[1].querySelector('.summary-content');
    if (contentElement) {
      contentElement.remove();
    }
    
    // Remove warning banner if it exists
    const warningBanner = cards[1].querySelector('.warning-banner');
    if (warningBanner) {
      warningBanner.remove();
    }
  }
  
  // Update canonical URL card - only update status badge
  if (cards[2]) {
    const hasCanonical = metadata.canonicalUrl && metadata.canonicalUrl.length > 0;
    const status = hasCanonical ? 'good' : 'error';
    
    const statusBadge = cards[2].querySelector('.status-badge');
    if (statusBadge) {
      statusBadge.className = 'status-badge ' + status;
      statusBadge.textContent = hasCanonical ? 'Good' : 'Missing';
    }
    
    // Remove content element if it exists
    const contentElement = cards[2].querySelector('.summary-content');
    if (contentElement) {
      contentElement.remove();
    }
    
    // Remove warning banner if it exists
    const warningBanner = cards[2].querySelector('.warning-banner');
    if (warningBanner) {
      warningBanner.remove();
    }
  }
}

/**
 * Update basic meta tags in Meta Tags tab
 * @param {Array} metaTags - Basic meta tags
 */
function updateBasicMetaTags(metaTags) {
  const container = document.getElementById('basic-meta-content');
  if (!container) return;
  
  if (!metaTags || metaTags.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No basic meta tags found on this page.</p>
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
    
    row.innerHTML = `
      <div class="meta-cell name">${tag.label}</div>
      <div class="${valueClass}">${isEmpty ? 'Not set' : tag.value}</div>
      <div class="meta-cell status">
        <span class="status-badge ${tag.status || 'warning'}">${tag.status || 'Missing'}</span>
      </div>
    `;
    
    container.appendChild(row);
  });
}

/**
 * Update Open Graph meta tags in Meta Tags tab
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
      
      row.innerHTML = `
        <div class="meta-cell name">${tag.label}</div>
        <div class="${valueClass}">${isEmpty ? 'Not set' : tag.value}</div>
        <div class="meta-cell status">
        <span class="status-badge ${tag.status || 'warning'}">${tag.status || 'Missing'}</span>
        </div>
      `;
      
    container.appendChild(row);
    });
}

/**
 * Update Twitter Card meta tags in Meta Tags tab
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
    
    row.innerHTML = `
      <div class="meta-cell name">${tag.label}</div>
      <div class="${valueClass}">${isEmpty ? 'Not set' : tag.value}</div>
      <div class="meta-cell status">
        <span class="status-badge ${tag.status || 'warning'}">${tag.status || 'Missing'}</span>
      </div>
    `;
    
    container.appendChild(row);
  });
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
 * Update schema.org data in Meta Tags tab
 * @param {Array} schemaData - Schema.org data
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
  
  schemaData.forEach(schema => {
    if (schema.valid && schema.data) {
      const schemaType = schema.data['@type'] || 'Unknown Type';
      
      const row = document.createElement('div');
      row.className = 'meta-row';
      
      row.innerHTML = `
        <div class="meta-cell name">@type</div>
        <div class="meta-cell value">${Array.isArray(schemaType) ? schemaType.join(', ') : schemaType}</div>
        <div class="meta-cell status">
          <span class="status-badge good">Valid</span>
      </div>
    `;
    
      container.appendChild(row);
      
      // Add a few key properties if available
      const keyProperties = ['name', 'headline', 'description', 'author', 'publisher'];
      
      keyProperties.forEach(prop => {
        if (schema.data[prop]) {
          const propRow = document.createElement('div');
          propRow.className = 'meta-row';
          
          let propValue = schema.data[prop];
          if (typeof propValue === 'object') {
            propValue = propValue['@type'] ? `[${propValue['@type']}]` : '[Object]';
          }
          
          propRow.innerHTML = `
            <div class="meta-cell name">${prop}</div>
            <div class="meta-cell value">${propValue}</div>
            <div class="meta-cell status">
              <span class="status-badge good">Present</span>
            </div>
          `;
          
          container.appendChild(propRow);
        }
      });
    } else {
      const row = document.createElement('div');
      row.className = 'meta-cell name';
      
      row.innerHTML = `
        <div class="meta-cell name">Schema</div>
        <div class="meta-cell value empty">Invalid Schema</div>
        <div class="meta-cell status">
          <span class="status-badge error">Error</span>
        </div>
      `;
      
      container.appendChild(row);
    }
  });
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
 * Initialize social tabs functionality with improved error handling
 */
function initSocialTabs() {
  const tabs = document.querySelectorAll('.social-tab');
  if (!tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      try {
        const newTab = tab;
        const previewId = newTab.getAttribute('data-preview');
        
        // Remove active class from all tabs
        document.querySelectorAll('.social-tab').forEach(t => {
          if (t && t.classList) t.classList.remove('active');
        });
        
        // Remove active class from all preview content
        document.querySelectorAll('.preview-content').forEach(content => {
          if (content && content.classList) content.classList.remove('active');
        });
        
        // Add active class to clicked tab
        newTab.classList.add('active');
        
        // Find and activate corresponding preview
        const previewElement = document.getElementById(`${previewId}-preview`);
        
        if (previewElement && previewElement.classList) {
          previewElement.classList.add('active');
        } else {
          console.warn(`Preview element #${previewId}-preview not found`);
          createMissingPreviewElement(previewId);
        }
        
        // Update current platform
        previewState.currentPlatform = previewId;
        
        // Refresh the preview content
        try {
          refreshCurrentPreview();
        } catch (refreshError) {
          console.error(`Error refreshing ${previewId} preview:`, refreshError);
        }
      } catch (error) {
        console.error('Error handling tab click:', error);
      }
    });
  });
}

// Helper function to create missing preview elements
function createMissingPreviewElement(previewId) {
  const previewContainer = document.querySelector('.preview-container');
  if (!previewContainer) return;
  
  const previewElement = document.createElement('div');
  previewElement.id = `${previewId}-preview`;
  previewElement.className = 'preview-content';
  previewElement.innerHTML = `
    <div class="loading-indicator">
      <div class="loading-spinner"></div>
      <div class="loading-text">Loading ${previewId} preview...</div>
    </div>
  `;
  
  previewContainer.appendChild(previewElement);
}

/**
 * Update all social previews with new metadata
 * @param {Object} metadata - The metadata to update previews with
 */
function updateSocialPreviews(metadata) {
  if (!metadata) {
    console.warn('No metadata provided to update social previews');
    return;
  }
  
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

  // Debug log for og:image
  console.log('[MetaPeek] og:image extracted for Facebook preview:', ogImage);

  // Store original metadata
  previewState.originalMetadata = {
    title,
    description,
    ogTitle,
    ogDescription,
    ogImage,
    twitterTitle,
    twitterDescription,
    twitterImage,
    siteName
  };
  
  // Set edited metadata to be the same as original
  previewState.editedMetadata = { ...previewState.originalMetadata };
  
  // Refresh all previews
  refreshAllPreviews();
}

/**
 * Update Google preview with metadata
 */
function updateGooglePreview(hostname, title, description) {
  const preview = document.getElementById('google-preview');
  if (!preview) return;
  
  preview.innerHTML = `
    <div class="google-preview">
      <div class="preview-url">${hostname}</div>
      <div class="preview-title">${title || 'No title available'}</div>
      <div class="preview-description">${description || 'No description available'}</div>
    </div>
  `;
}

/**
 * Update Facebook preview with metadata
 */
function updateFacebookPreview(hostname, title, description, image, siteName) {
  const preview = document.getElementById('facebook-preview');
  if (!preview) return;
  
  preview.innerHTML = `
    <div class="card-seo-facebook">
      ${image ? 
        `<img class="card-seo-facebook__image" src="${image}" alt="Facebook preview image">` :
        `<div class="preview-image-placeholder">No image available</div>`
      }
      <div class="card-seo-facebook__footer">
        <div class="card-seo-facebook__domain">${hostname.toUpperCase()}</div>
        <div class="card-seo-facebook__title">${title || 'No title available'}</div>
        <div class="card-seo-facebook__description">${description || 'No description available'}</div>
      </div>
    </div>
  `;
}

/**
 * Update Twitter preview with metadata
 */
function updateTwitterPreview(metadata, hostname, title, description, image) {
  const preview = document.getElementById('twitter-preview');
  if (!preview) return;

  // Fallback logic for Twitter card
  const cardImage = metadata.twitterImage || metadata.ogImage || '';
  const cardTitle = metadata.twitterTitle || metadata.ogTitle || title || '';
  const cardDescription = metadata.twitterDescription || metadata.ogDescription || description || '';
  const cardDomain = hostname || '';

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
 * Update LinkedIn preview with metadata
 */
function updateLinkedInPreview(hostname, title, description, image, siteName) {
  const preview = document.getElementById('linkedin-preview');
  if (!preview) return;

  // Prefer og:site_name if available, otherwise use hostname
  const domain = siteName || hostname;

  preview.innerHTML = `
    <div class="linkedin-preview">
      <img src="${image || ''}" alt="preview image" class="thumbnail" />
      <div class="text-content">
        <h3 class="title">${title || 'No title available'}</h3>
        <div class="site-name">${domain || ''}</div>
      </div>
    </div>
  `;
}

/**
 * Update Pinterest preview with metadata
 */
function updatePinterestPreview(hostname, title, description, image) {
  const preview = document.getElementById('pinterest-preview');
  if (!preview) return;
  
  preview.innerHTML = `
    <div class="pinterest-preview">
      ${image ? 
        `<div class="preview-image" style="background-image: url('${image}')"></div>` :
        `<div class="preview-image-placeholder">No image available</div>`
      }
      <div class="preview-content">
        <div class="preview-domain">${hostname}</div>
        <div class="preview-title">${title || 'No title available'}</div>
        <div class="preview-description">${description || 'No description available'}</div>
      </div>
    </div>
  `;
}

/**
 * Update Slack preview with metadata
 */
function updateSlackPreview(hostname, title, description, image, siteName) {
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
        ${image ? `<div class=\"card-seo-slack__image js-preview-image js-slack-image\" style=\"background-image:url('${image}')\"></div>` : ''}
      </div>
    </div>
  `;
}

/**
 * Update performance metrics in Performance tab
 * @param {Object} metrics - Web vitals metrics
 */
function updatePerformanceMetrics(metrics) {
  const metricsGrid = document.getElementById('metrics-grid');
  const performanceTip = document.getElementById('performance-tip');
  
  if (!metricsGrid) return;
  
  // Define metric display info
  const metricDisplayInfo = {
    lcp: {
      name: 'LCP',
      label: 'Largest Contentful Paint',
      format: (value) => (value / 1000).toFixed(1) + 's',
      threshold: '< 2.5s',
      thresholds: [2500, 4000] // good, poor thresholds
    },
    cls: {
      name: 'CLS',
      label: 'Cumulative Layout Shift',
      format: (value) => value.toFixed(2),
      threshold: '< 0.1',
      thresholds: [0.1, 0.25] // good, poor thresholds
    },
    inp: {
      name: 'INP',
      label: 'Interaction to Next Paint',
      format: (value) => value.toFixed(0) + 'ms',
      threshold: '< 200ms',
      thresholds: [200, 500] // good, poor thresholds
    }
  };
  
  // Clear existing metrics
  metricsGrid.innerHTML = '';
  
  // Check if we have any metrics
  let hasMetrics = false;
  
  // Add each metric
  for (const [metricName, info] of Object.entries(metricDisplayInfo)) {
    if (metrics[metricName] !== null && metrics[metricName] !== undefined) {
      hasMetrics = true;
      const value = metrics[metricName];
      
      // Determine status
      let status = 'good';
      let statusText = 'Good';
        
      if (metricName === 'cls') {
        // For CLS, lower is better
        if (value > info.thresholds[1]) {
          status = 'poor';
          statusText = 'Poor';
        } else if (value > info.thresholds[0]) {
          status = 'warning';
          statusText = 'Needs Improvement';
        }
      } else {
        // For other metrics
        if (value > info.thresholds[1]) {
          status = 'poor';
          statusText = 'Poor';
        } else if (value > info.thresholds[0]) {
          status = 'warning';
          statusText = 'Needs Improvement';
        }
      }
      
      // Create metric card
      const metricCard = document.createElement('div');
      metricCard.className = `metric-card ${status}`;
      
      metricCard.innerHTML = `
        <div class="metric-header">
          <h4>${info.name}</h4>
          <span class="metric-status ${status}">${statusText}</span>
        </div>
        <div class="metric-value">${info.format(value)}</div>
        <div class="metric-label">${info.label}</div>
        <div class="metric-threshold">Target: ${info.threshold}</div>
      `;
      
      metricsGrid.appendChild(metricCard);
    }
  }
  
  // Show message if no metrics are available
  if (!hasMetrics) {
    metricsGrid.innerHTML = `
      <div class="empty-state">
        <p>Performance metrics are still being collected. This may take a moment...</p>
        </div>
      `;
    return;
  }
      
  // Update performance tip
  if (performanceTip && metrics) {
    updatePerformanceTip(metrics, performanceTip);
    }
}

/**
 * Update performance tip based on metrics
 * @param {Object} metrics - Web vitals metrics
 * @param {Element} tipElement - Performance tip element
 */
function updatePerformanceTip(metrics, tipElement) {
  // Find most critical issue
  let criticalIssue = null;
  
  if (metrics.cls !== null && metrics.cls > 0.25) {
    criticalIssue = {
      name: 'CLS',
      message: 'Your page has significant layout shifts (CLS) that may impact user experience. Check for elements that move after loading.',
      status: 'error'
    };
  } 
  else if (metrics.lcp !== null && metrics.lcp > 4000) {
    criticalIssue = {
      name: 'LCP',
      message: 'Your page has slow loading performance (LCP). Consider optimizing images, reducing server response time, or reducing JavaScript.',
      status: 'error'
    };
  }
  else if (metrics.inp !== null && metrics.inp > 500) {
    criticalIssue = {
      name: 'INP',
      message: 'Your page has poor interaction performance (INP). Consider optimizing event handlers and reducing JavaScript execution time.',
      status: 'error'
    };
  }
  else if (metrics.cls !== null && metrics.cls > 0.1) {
    criticalIssue = {
      name: 'CLS',
      message: 'Your page has some layout shifts (CLS) that could be improved. Consider optimizing dynamic content loading.',
      status: 'warning'
    };
  }
  else if (metrics.lcp !== null && metrics.lcp > 2500) {
    criticalIssue = {
      name: 'LCP',
      message: 'Your page loading performance (LCP) could be improved. Consider optimizing resource loading.',
      status: 'warning'
    };
  }
  else if (metrics.inp !== null && metrics.inp > 200) {
    criticalIssue = {
      name: 'INP',
      message: 'Your page interaction performance (INP) could be improved. Consider optimizing event handlers.',
      status: 'warning'
    };
  }
  
  // Update tip or hide if all metrics are good
  if (criticalIssue) {
    tipElement.className = `performance-tip ${criticalIssue.status}`;
    tipElement.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      <p>${criticalIssue.message}</p>
    `;
  } else {
    tipElement.className = 'performance-tip good';
    tipElement.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <p>All performance metrics are looking good! Your page loads quickly and provides a good user experience.</p>
    `;
  }
}

/**
 * Initialize theme toggle functionality
 */
function initThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle');
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
  
  themeToggle.addEventListener('click', () => {
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
    
    button.addEventListener('click', () => {
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
      } else {
        console.warn(`Target tab pane #${targetPaneId} not found`);
      }
    });
  });
}

/**
 * Initialize copy buttons functionality
 */
function initCopyButtons() {
  // Initialize copy buttons for different meta sections
  setupCopyButton('copy-basic-meta', () => collectMetaTagsText('basic-meta-tags'));
  setupCopyButton('copy-og-meta', () => collectMetaTagsText('og-meta-tags'));
  setupCopyButton('copy-twitter-meta', () => collectMetaTagsText('twitter-meta-tags'));
  setupCopyButton('copy-schema', () => collectMetaTagsText('schema-data'));
}

/**
 * Set up a copy button with click handler
 * @param {string} buttonId - ID of the copy button
 * @param {Function} getTextFn - Function to get text to copy
 */
function setupCopyButton(buttonId, getTextFn) {
  const button = document.getElementById(buttonId);
  if (!button) {
    console.warn(`Copy button with ID ${buttonId} not found`);
    return;
  }

  button.addEventListener('click', async () => {
    try {
      const textToCopy = getTextFn();
      if (!textToCopy) {
        console.warn('No text to copy');
        return;
      }

      await navigator.clipboard.writeText(textToCopy);
      showToast('Copied to clipboard!');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      showToast('Failed to copy to clipboard');
    }
  });
}

/**
 * Collect meta tags text from a container
 * @param {string} containerId - ID of the container to collect text from
 * @returns {string} Collected text
 */
function collectMetaTagsText(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`Container with ID ${containerId} not found`);
    return '';
  }

  const metaTags = container.querySelectorAll('.meta-tag');
  if (!metaTags.length) {
    console.warn(`No meta tags found in container ${containerId}`);
    return '';
  }

  return Array.from(metaTags)
    .map(tag => {
      const label = tag.querySelector('.meta-label')?.textContent || '';
      const value = tag.querySelector('.meta-value')?.textContent || '';
      return `${label}: ${value}`;
    })
    .filter(text => text.trim())
    .join('\n');
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  
  const toastMessage = toast.querySelector('span');
  if (toastMessage) {
    toastMessage.textContent = message;
  }
  
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, CONFIG.toastDuration);
}

/**
 * Helper to extract hostname from URL
 * @param {string} url - URL to extract hostname from
 * @returns {string} Hostname
 */
function extractHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return url || 'example.com';
  }
}

// Update refreshAllPreviews and refreshCurrentPreview to support Slack
function refreshAllPreviews() {
  const metadata = previewState.editedMetadata || previewState.originalMetadata;
  if (!metadata) {
    console.warn('No metadata available for previews');
    return;
  }
  const hostname = previewState.pageHostname || metadata.hostname || window.location.hostname;
  const title = metadata.title || metadata.ogTitle || metadata.twitterTitle;
  const description = metadata.description || metadata.ogDescription || metadata.twitterDescription;
  let facebookImage = metadata.ogImage;
  if (!facebookImage || typeof facebookImage !== 'string' || facebookImage.trim() === '') {
    facebookImage = 'https://via.placeholder.com/1200x630?text=No+Image';
  }
  const image = metadata.ogImage || metadata.twitterImage;
  const siteName = metadata.siteName || metadata.ogSiteName;

  updateGooglePreview(hostname, title, description);
  updateFacebookPreview(hostname, title, description, facebookImage, siteName);
  updateTwitterPreview(metadata, hostname, title, description, image);
  updateLinkedInPreview(hostname, title, description, image, siteName);
  updatePinterestPreview(hostname, title, description, image);
  updateSlackPreview(hostname, title, description, image, siteName);
}

function refreshCurrentPreview() {
  const activePreview = document.querySelector('.preview-content.active');
  if (!activePreview) {
    console.warn('No active preview found to refresh');
    return;
  }
  const platform = activePreview.id.split('-')[0];
  const hostname = previewState.pageHostname || 'example.com';
  try {
    switch (platform) {
      case 'google':
        updateGooglePreview(
          hostname,
          previewState.editedMetadata.title,
          previewState.editedMetadata.description
        );
        break;
      case 'facebook':
        updateFacebookPreview(
          hostname,
          previewState.editedMetadata.ogTitle || previewState.editedMetadata.title,
          previewState.editedMetadata.ogDescription || previewState.editedMetadata.description,
          previewState.editedMetadata.ogImage,
          previewState.editedMetadata.siteName
        );
        break;
      case 'twitter':
        updateTwitterPreview(
          previewState.editedMetadata,
          hostname,
          previewState.editedMetadata.twitterTitle || previewState.editedMetadata.title,
          previewState.editedMetadata.twitterDescription || previewState.editedMetadata.description,
          previewState.editedMetadata.twitterImage
        );
        break;
      case 'linkedin':
        updateLinkedInPreview(
          hostname,
          previewState.editedMetadata.ogTitle || previewState.editedMetadata.title,
          previewState.editedMetadata.ogDescription || previewState.editedMetadata.description,
          previewState.editedMetadata.ogImage,
          previewState.editedMetadata.siteName
        );
        break;
      case 'pinterest':
        updatePinterestPreview(
          hostname,
          previewState.editedMetadata.title,
          previewState.editedMetadata.description,
          previewState.editedMetadata.ogImage
        );
        break;
      case 'slack':
        updateSlackPreview(
          hostname,
          previewState.editedMetadata.ogTitle || previewState.editedMetadata.title,
          previewState.editedMetadata.ogDescription || previewState.editedMetadata.description,
          previewState.editedMetadata.ogImage,
          previewState.editedMetadata.siteName
        );
        break;
      default:
        console.warn(`Unknown platform: ${platform}`);
    }
  } catch (error) {
    console.error(`Error refreshing ${platform} preview:`, error);
  }
}

/**
 * Scrolls the expanded section header to align with the first section header below the tab navigation
 */
function scrollSectionIntoAlignedView({
  containerSelector,
  sectionHeaderSelector,
  sectionHeaderToScrollTo
}) {
  const container = document.querySelector(containerSelector);
  const allSectionHeaders = Array.from(document.querySelectorAll(sectionHeaderSelector));
  const targetSectionHeader = sectionHeaderToScrollTo;

  if (!container || !targetSectionHeader) return;

  const firstSectionHeader = allSectionHeaders[0];
  const firstSectionHeaderY = firstSectionHeader.getBoundingClientRect().top;
  const targetSectionHeaderY = targetSectionHeader.getBoundingClientRect().top;

  // The scroll delta is the difference between the two header positions
  const scrollDelta = targetSectionHeaderY - firstSectionHeaderY;

  // Debug logs
  console.log('[MetaPeek scroll alignment]');
  console.log('container.scrollTop before:', container.scrollTop);
  console.log('firstSectionHeaderY:', firstSectionHeaderY);
  console.log('targetSectionHeaderY:', targetSectionHeaderY);
  console.log('scrollDelta:', scrollDelta);

  container.scrollTop += scrollDelta;
  console.log('container.scrollTop after:', container.scrollTop);
}

function initCollapsibleSections() {
  console.log('[MetaPeek] initCollapsibleSections called');
  const collapseButtons = document.querySelectorAll('.collapse-btn');
  const sectionHeaderSelector = '#meta-tags-tab .section-header';
  const containerSelector = '.app-content';

  collapseButtons.forEach(button => {
    button.addEventListener('click', () => {
      console.log('[MetaPeek] collapse button clicked');
      const targetId = button.getAttribute('data-target');
      const targetContent = document.getElementById(targetId);
      const sectionCard = targetContent.closest('.section-card');
      const sectionHeader = button.closest('.section-header');

      // If the clicked section is already expanded, just collapse it
      if (!button.classList.contains('collapsed')) {
        button.classList.add('collapsed');
        targetContent.classList.add('collapsed');
        sectionCard.classList.add('collapsed');
        sectionHeader.classList.add('collapsed');
        const icon = button.querySelector('svg');
        if (icon) {
          icon.style.transform = 'rotate(-90deg)';
        }
        return;
      }

      // Collapse all other sections first
      collapseButtons.forEach(otherButton => {
        if (otherButton !== button) {
          const otherTargetId = otherButton.getAttribute('data-target');
          const otherContent = document.getElementById(otherTargetId);
          const otherCard = otherContent.closest('.section-card');
          const otherHeader = otherButton.closest('.section-header');

          otherButton.classList.add('collapsed');
          otherContent.classList.add('collapsed');
          otherCard.classList.add('collapsed');
          otherHeader.classList.add('collapsed');

          const otherIcon = otherButton.querySelector('svg');
          if (otherIcon) {
            otherIcon.style.transform = 'rotate(-90deg)';
          }
        }
      });

      // Expand the clicked section first
      button.classList.remove('collapsed');
      targetContent.classList.remove('collapsed');
      sectionCard.classList.remove('collapsed');
      sectionHeader.classList.remove('collapsed');
      const icon = button.querySelector('svg');
      if (icon) {
        icon.style.transform = 'rotate(0)';
      }

      // After DOM/layout update, scroll for pixel-perfect alignment
      requestAnimationFrame(() => {
        scrollSectionIntoAlignedView({
          containerSelector,
          sectionHeaderSelector,
          sectionHeaderToScrollTo: sectionHeader
        });
      });
    });
  });

  // Initially collapse all sections except the first one
  collapseButtons.forEach((button, index) => {
    if (index !== 0) {
      const targetId = button.getAttribute('data-target');
      const targetContent = document.getElementById(targetId);
      const sectionCard = targetContent.closest('.section-card');
      const sectionHeader = button.closest('.section-header');

      button.classList.add('collapsed');
      targetContent.classList.add('collapsed');
      sectionCard.classList.add('collapsed');
      sectionHeader.classList.add('collapsed');

      const icon = button.querySelector('svg');
      if (icon) {
        icon.style.transform = 'rotate(-90deg)';
      }
    }
  });
} 