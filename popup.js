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
  cachedMetrics: null
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
      row.className = 'meta-row';
      
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
    
    // Initialize device toggle
    initDeviceToggle();
    
    // Initialize edit mode
    initEditMode();
    
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
        <button class="social-tab" data-preview="pinterest">Pinterest</button>
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
        <div id="google-preview" class="preview-content active">
          <div class="loading-indicator">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading Google preview...</div>
          </div>
        </div>
        
        <div id="facebook-preview" class="preview-content">
          <div class="loading-indicator">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading Facebook preview...</div>
          </div>
        </div>
        
        <div id="twitter-preview" class="preview-content">
          <div class="loading-indicator">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading Twitter preview...</div>
          </div>
        </div>

        <div id="linkedin-preview" class="preview-content">
          <div class="loading-indicator">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading LinkedIn preview...</div>
          </div>
        </div>

        <div id="pinterest-preview" class="preview-content">
          <div class="loading-indicator">
            <div class="loading-spinner"></div>
            <div class="loading-text">Loading Pinterest preview...</div>
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
  const socialTabs = document.querySelectorAll('.social-tab');
  
  if (!socialTabs || socialTabs.length === 0) {
    console.warn('No social tabs found to initialize');
    return;
  }
  
  console.log(`Initializing ${socialTabs.length} social tabs`);
  
  socialTabs.forEach(tab => {
    if (!tab || !tab.parentNode) return;
    
    // Remove existing event listeners to avoid duplicates
    const newTab = tab.cloneNode(true);
    tab.parentNode.replaceChild(newTab, tab);
    
    newTab.addEventListener('click', () => {
      try {
        // Get the target preview ID
        const previewId = newTab.getAttribute('data-preview');
        if (!previewId) {
          console.warn('Social tab missing data-preview attribute');
          return;
        }
        
        // Skip if already active
        if (newTab.classList.contains('active')) return;
        
        console.log(`Switching to ${previewId} preview`);
        
        // Remove active class from all tabs and preview content
        document.querySelectorAll('.social-tab').forEach(t => {
          if (t && t.classList) t.classList.remove('active');
        });
        
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
          
          // Create missing preview element if needed
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

/**
 * Initialize device toggle (mobile/desktop)
 */
function initDeviceToggle() {
  // Check if toggle already exists
  if (document.querySelector('.device-toggle-container')) {
    return;
  }
  
  const deviceToggleContainer = document.createElement('div');
  deviceToggleContainer.className = 'device-toggle-container';
  deviceToggleContainer.innerHTML = `
    <span class="device-label">Desktop</span>
    <label class="switch">
      <input type="checkbox" id="device-toggle">
      <span class="slider round"></span>
    </label>
    <span class="device-label">Mobile</span>
  `;
  
  // Find appropriate place to insert
  const socialTabs = document.querySelector('.social-tabs');
  const previewContainer = document.querySelector('.preview-container');
  
  if (socialTabs) {
    socialTabs.after(deviceToggleContainer);
  } else if (previewContainer) {
    previewContainer.before(deviceToggleContainer);
  } else {
    // Can't find a good place, don't add the toggle
    console.warn('Could not find appropriate place to add device toggle');
    return;
  }
  
  // Add event listener
  const deviceToggle = document.getElementById('device-toggle');
  if (deviceToggle) {
    deviceToggle.addEventListener('change', () => {
      previewState.currentDevice = deviceToggle.checked ? 'mobile' : 'desktop';
      
      // Update preview containers
      const previewContainers = document.querySelectorAll('.preview-container');
      if (!previewContainers || previewContainers.length === 0) {
        console.warn('No preview containers found to update device view');
        return;
      }
      
      previewContainers.forEach(container => {
        if (previewState.currentDevice === 'mobile') {
          container.classList.add('mobile-view');
          container.classList.remove('desktop-view');
        } else {
          container.classList.add('desktop-view');
          container.classList.remove('mobile-view');
        }
      });
      
      // Refresh the current preview
      refreshCurrentPreview();
    });
  }
}

/**
 * Initialize edit mode for social previews
 */
function initEditMode() {
  // Check if edit toggle already exists
  if (document.querySelector('.edit-toggle')) {
    return;
  }
  
  // Create edit mode toggle button
  const editToggle = document.createElement('button');
  editToggle.className = 'btn-icon-text edit-toggle';
  editToggle.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
    Edit Preview
  `;
  
  // Insert before the preview container
  const previewContainer = document.querySelector('.preview-container');
  if (previewContainer) {
    previewContainer.before(editToggle);
  } else {
    console.warn('No preview container found to attach edit toggle');
    return;
  }
  
  // Add event listener
  editToggle.addEventListener('click', () => {
    previewState.editMode = !previewState.editMode;
    
    if (previewState.editMode) {
      // Enable editing
      editToggle.classList.add('active');
      editToggle.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6L9 17l-5-5"></path>
        </svg>
        Save Changes
      `;
      
      // Setup edited metadata
      setupEditedMetadata();
      
      // Enable preview editing
      enablePreviewEditing();
    } else {
      // Disable editing
      editToggle.classList.remove('active');
      editToggle.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        Edit Preview
      `;
      
      // Disable preview editing
      disablePreviewEditing();
      
      // Refresh all previews with edited metadata
      refreshAllPreviews();
    }
  });
}

/**
 * Setup edited metadata for preview editing
 */
function setupEditedMetadata() {
  if (!previewState.editedMetadata) {
    previewState.editedMetadata = {
      title: previewState.originalMetadata.title || '',
      description: previewState.originalMetadata.description || '',
      ogTitle: previewState.originalMetadata.ogTitle || '',
      ogDescription: previewState.originalMetadata.ogDescription || '',
      ogImage: previewState.originalMetadata.ogImage || '',
      twitterTitle: previewState.originalMetadata.twitterTitle || '',
      twitterDescription: previewState.originalMetadata.twitterDescription || '',
      twitterImage: previewState.originalMetadata.twitterImage || '',
      siteName: previewState.originalMetadata.siteName || ''
    };
  }
}

/**
 * Enable editing on preview elements
 */
function enablePreviewEditing() {
  const previews = document.querySelectorAll('.preview-content');
  if (!previews || previews.length === 0) {
    console.warn('No preview elements found to enable editing');
    return;
  }
  
  previews.forEach(preview => {
    // Make title editable
    const titleElement = preview.querySelector('.preview-title');
    if (titleElement) {
      titleElement.contentEditable = true;
      titleElement.addEventListener('input', () => {
        const platform = preview.id.split('-')[0];
        if (platform === 'google') {
          previewState.editedMetadata.title = titleElement.textContent;
        } else if (platform === 'facebook' || platform === 'linkedin') {
          previewState.editedMetadata.ogTitle = titleElement.textContent;
        } else if (platform === 'twitter') {
          previewState.editedMetadata.twitterTitle = titleElement.textContent;
        }
      });
    }
    
    // Make description editable
    const descriptionElement = preview.querySelector('.preview-description');
    if (descriptionElement) {
      descriptionElement.contentEditable = true;
      descriptionElement.addEventListener('input', () => {
        const platform = preview.id.split('-')[0];
        if (platform === 'google') {
          previewState.editedMetadata.description = descriptionElement.textContent;
        } else if (platform === 'facebook' || platform === 'linkedin') {
          previewState.editedMetadata.ogDescription = descriptionElement.textContent;
        } else if (platform === 'twitter') {
          previewState.editedMetadata.twitterDescription = descriptionElement.textContent;
        }
      });
    }
    
    // Make site name editable
    const siteNameElement = preview.querySelector('.preview-site-name');
    if (siteNameElement) {
      siteNameElement.contentEditable = true;
      siteNameElement.addEventListener('input', () => {
        previewState.editedMetadata.siteName = siteNameElement.textContent;
      });
    }
    
    // Add image upload functionality
    const imageElement = preview.querySelector('.preview-image');
    if (imageElement) {
      imageElement.style.cursor = 'pointer';
      imageElement.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        
        fileInput.addEventListener('change', (event) => {
          if (event.target.files && event.target.files[0]) {
            const reader = new FileReader();
            
            reader.onload = (e) => {
              // Create image to get dimensions
              const img = new Image();
              img.onload = function() {
                const platform = preview.id.split('-')[0];
                if (platform === 'facebook' || platform === 'linkedin') {
                  previewState.editedMetadata.ogImage = e.target.result;
                } else if (platform === 'twitter') {
                  previewState.editedMetadata.twitterImage = e.target.result;
                }
                
                // Show image dimensions and recommendation if needed
                showImageDimensions(this.width, this.height);
                
                // Update the image
                imageElement.src = e.target.result;
              };
              
              img.src = e.target.result;
            };
            
            reader.readAsDataURL(event.target.files[0]);
          }
        });
        
        fileInput.click();
      });
    }
  });
}

/**
 * Disable editing on preview elements
 */
function disablePreviewEditing() {
  const previews = document.querySelectorAll('.preview-content');
  if (!previews || previews.length === 0) {
    console.warn('No preview elements found to disable editing');
    return;
  }
  
  previews.forEach(preview => {
    // Disable title editing
    const titleElement = preview.querySelector('.preview-title');
    if (titleElement) {
      titleElement.contentEditable = false;
      titleElement.removeEventListener('input', () => {});
    }
    
    // Disable description editing
    const descriptionElement = preview.querySelector('.preview-description');
    if (descriptionElement) {
      descriptionElement.contentEditable = false;
      descriptionElement.removeEventListener('input', () => {});
    }
    
    // Disable site name editing
    const siteNameElement = preview.querySelector('.preview-site-name');
    if (siteNameElement) {
      siteNameElement.contentEditable = false;
      siteNameElement.removeEventListener('input', () => {});
    }
    
    // Disable image upload
    const imageElement = preview.querySelector('.preview-image');
    if (imageElement) {
      imageElement.style.cursor = 'default';
      imageElement.removeEventListener('click', () => {});
    }
  });
}

/**
 * Show image dimensions and recommendations
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 */
function showImageDimensions(width, height) {
  // Remove any existing dimension info
  const existingInfo = document.querySelector('.image-dimensions-info');
  if (existingInfo) {
    existingInfo.remove();
  }
  
  // Create dimension info element
  const dimensionInfo = document.createElement('div');
  dimensionInfo.className = 'image-dimensions-info';
  
  // Add dimension text
  const dimensionText = document.createElement('div');
  dimensionText.className = 'dimension-text';
  dimensionText.textContent = `${width} × ${height} pixels`;
  dimensionInfo.appendChild(dimensionText);
  
  // Add recommendations based on platform
  const recommendations = [];
  
  if (width < 1200 || height < 630) {
    recommendations.push('Facebook/LinkedIn: Recommended size is 1200 × 630 pixels');
  }
  
  if (width < 1200 || height < 600) {
    recommendations.push('Twitter: Recommended size is 1200 × 600 pixels');
  }
  
  if (recommendations.length > 0) {
    const recommendationText = document.createElement('div');
    recommendationText.className = 'recommendation-text';
    recommendationText.textContent = recommendations.join('\n');
    dimensionInfo.appendChild(recommendationText);
  }
  
  // Add to preview container
  const previewContainer = document.querySelector('.preview-container');
  if (previewContainer) {
    previewContainer.appendChild(dimensionInfo);
    
    // Remove after 5 seconds
    setTimeout(() => {
      dimensionInfo.classList.add('fade-out');
      setTimeout(() => {
        dimensionInfo.remove();
      }, 500);
    }, 5000);
  }
}

/**
 * Refresh all social previews with current metadata
 */
function refreshAllPreviews() {
  if (!previewState.editedMetadata) {
    console.warn('No edited metadata available to refresh previews');
    return;
  }
  
  const hostname = extractHostname(window.location.href);
  
  // Update Google preview
  updateGooglePreview(
    hostname,
    previewState.editedMetadata.title,
    previewState.editedMetadata.description
  );
  
  // Update Facebook preview
  updateFacebookPreview(
    hostname,
    previewState.editedMetadata.ogTitle || previewState.editedMetadata.title,
    previewState.editedMetadata.ogDescription || previewState.editedMetadata.description,
    previewState.editedMetadata.ogImage,
    previewState.editedMetadata.siteName
  );
  
  // Update Twitter preview
  updateTwitterPreview(
    previewState.editedMetadata,
    hostname,
    previewState.editedMetadata.twitterTitle || previewState.editedMetadata.title,
    previewState.editedMetadata.twitterDescription || previewState.editedMetadata.description,
    previewState.editedMetadata.twitterImage
  );
  
  // Update LinkedIn preview
  updateLinkedInPreview(
    hostname,
    previewState.editedMetadata.ogTitle || previewState.editedMetadata.title,
    previewState.editedMetadata.ogDescription || previewState.editedMetadata.description,
    previewState.editedMetadata.ogImage,
    previewState.editedMetadata.siteName
  );
  
  // Update Pinterest preview
  updatePinterestPreview(
    hostname,
    previewState.editedMetadata.title,
    previewState.editedMetadata.description,
    previewState.editedMetadata.ogImage
  );
}

/**
 * Refresh the currently active preview
 */
function refreshCurrentPreview() {
  const activePreview = document.querySelector('.preview-content.active');
  if (!activePreview) {
    console.warn('No active preview found to refresh');
    return;
  }
  
  const platform = activePreview.id.split('-')[0];
  const hostname = extractHostname(window.location.href);
  
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
        
      default:
        console.warn(`Unknown platform: ${platform}`);
    }
  } catch (error) {
    console.error(`Error refreshing ${platform} preview:`, error);
  }
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
  
  // Store original metadata
  previewState.originalMetadata = metadata;
  
  // Initialize edited metadata if not exists
  if (!previewState.editedMetadata) {
    setupEditedMetadata();
  }
  
  // Refresh all previews
  refreshAllPreviews();
}

/**
 * Update Google search preview
 * @param {string} hostname - The hostname to display
 * @param {string} title - The title to display
 * @param {string} description - The description to display
 */
function updateGooglePreview(hostname, title, description) {
  const preview = document.getElementById('google-preview');
  if (!preview) {
    console.warn('Google preview element not found');
    return;
  }
  
  // Update title
  const titleElement = preview.querySelector('.preview-title');
  if (titleElement) {
    titleElement.textContent = title || 'No title available';
  }
  
  // Update URL
  const urlElement = preview.querySelector('.preview-url');
  if (urlElement) {
    urlElement.textContent = hostname || 'example.com';
  }
  
  // Update description
  const descriptionElement = preview.querySelector('.preview-description');
  if (descriptionElement) {
    descriptionElement.textContent = description || 'No description available';
  }
}

/**
 * Update Facebook preview
 * @param {string} hostname - The hostname to display
 * @param {string} title - The title to display
 * @param {string} description - The description to display
 * @param {string} image - The image URL to display
 * @param {string} siteName - The site name to display
 */
function updateFacebookPreview(hostname, title, description, image, siteName) {
  const preview = document.getElementById('facebook-preview');
  if (!preview) {
    console.warn('Facebook preview element not found');
    return;
  }
  
  // Update title
  const titleElement = preview.querySelector('.preview-title');
  if (titleElement) {
    titleElement.textContent = title || 'No title available';
  }
  
  // Update URL
  const urlElement = preview.querySelector('.preview-url');
  if (urlElement) {
    urlElement.textContent = hostname || 'example.com';
  }
  
  // Update description
  const descriptionElement = preview.querySelector('.preview-description');
  if (descriptionElement) {
    descriptionElement.textContent = description || 'No description available';
  }
  
  // Update site name
  const siteNameElement = preview.querySelector('.preview-site-name');
  if (siteNameElement) {
    siteNameElement.textContent = siteName || hostname || 'example.com';
  }
  
  // Update image
  const imageElement = preview.querySelector('.preview-image');
  if (imageElement) {
    if (image) {
      imageElement.src = image;
      imageElement.style.display = 'block';
    } else {
      imageElement.style.display = 'none';
    }
  }
}

/**
 * Update Twitter preview
 * @param {Object} metadata - The metadata object containing Twitter-specific data
 * @param {string} hostname - The hostname to display
 * @param {string} title - The title to display
 * @param {string} description - The description to display
 * @param {string} image - The image URL to display
 */
function updateTwitterPreview(metadata, hostname, title, description, image) {
  const preview = document.getElementById('twitter-preview');
  if (!preview) {
    console.warn('Twitter preview element not found');
    return;
  }
  
  // Update title
  const titleElement = preview.querySelector('.preview-title');
  if (titleElement) {
    titleElement.textContent = title || 'No title available';
  }
  
  // Update URL
  const urlElement = preview.querySelector('.preview-url');
  if (urlElement) {
    urlElement.textContent = hostname || 'example.com';
  }
  
  // Update description
  const descriptionElement = preview.querySelector('.preview-description');
  if (descriptionElement) {
    descriptionElement.textContent = description || 'No description available';
  }
  
  // Update site name
  const siteNameElement = preview.querySelector('.preview-site-name');
  if (siteNameElement) {
    siteNameElement.textContent = metadata.twitterSite || hostname || 'example.com';
  }
  
  // Update image
  const imageElement = preview.querySelector('.preview-image');
  if (imageElement) {
    if (image) {
      imageElement.src = image;
      imageElement.style.display = 'block';
    } else {
      imageElement.style.display = 'none';
    }
  }
  
  // Update card type
  const cardType = metadata.twitterCard || 'summary_large_image';
  preview.className = `preview-content twitter-preview ${cardType}`;
}

/**
 * Update LinkedIn preview
 * @param {string} hostname - The hostname to display
 * @param {string} title - The title to display
 * @param {string} description - The description to display
 * @param {string} image - The image URL to display
 * @param {string} siteName - The site name to display
 */
function updateLinkedInPreview(hostname, title, description, image, siteName) {
  let preview = document.getElementById('linkedin-preview');
  if (!preview) {
    // Create the preview element if it doesn't exist
    const previewContainer = document.querySelector('.preview-container');
    if (!previewContainer) {
      console.warn('Preview container not found');
      return;
    }
    
    preview = document.createElement('div');
    preview.id = 'linkedin-preview';
    preview.className = 'preview-content';
    preview.innerHTML = `
      <div class="linkedin-preview">
        <div class="preview-image"></div>
        <div class="preview-content">
          <div class="preview-title"></div>
          <div class="preview-description"></div>
          <div class="preview-site-name"></div>
          <div class="preview-url"></div>
        </div>
      </div>
    `;
    previewContainer.appendChild(preview);
  }
  
  // Update title
  const titleElement = preview.querySelector('.preview-title');
  if (titleElement) {
    titleElement.textContent = title || 'No title available';
  }
  
  // Update URL
  const urlElement = preview.querySelector('.preview-url');
  if (urlElement) {
    urlElement.textContent = hostname || 'example.com';
  }
  
  // Update description
  const descriptionElement = preview.querySelector('.preview-description');
  if (descriptionElement) {
    descriptionElement.textContent = description || 'No description available';
  }
  
  // Update site name
  const siteNameElement = preview.querySelector('.preview-site-name');
  if (siteNameElement) {
    siteNameElement.textContent = siteName || hostname || 'example.com';
  }
  
  // Update image
  const imageElement = preview.querySelector('.preview-image');
  if (imageElement) {
    if (image) {
      imageElement.style.backgroundImage = `url('${image}')`;
      imageElement.style.display = 'block';
    } else {
      imageElement.style.display = 'none';
    }
  }
}

/**
 * Update Pinterest preview
 * @param {string} hostname - The hostname to display
 * @param {string} title - The title to display
 * @param {string} description - The description to display
 * @param {string} image - The image URL to display
 */
function updatePinterestPreview(hostname, title, description, image) {
  let preview = document.getElementById('pinterest-preview');
  if (!preview) {
    // Create the preview element if it doesn't exist
    const previewContainer = document.querySelector('.preview-container');
    if (!previewContainer) {
      console.warn('Preview container not found');
      return;
    }
    
    preview = document.createElement('div');
    preview.id = 'pinterest-preview';
    preview.className = 'preview-content';
    preview.innerHTML = `
      <div class="pinterest-preview">
        <div class="preview-image"></div>
        <div class="preview-content">
          <div class="preview-title"></div>
          <div class="preview-description"></div>
          <div class="preview-url"></div>
        </div>
      </div>
    `;
    previewContainer.appendChild(preview);
  }
  
  // Update title
  const titleElement = preview.querySelector('.preview-title');
  if (titleElement) {
    titleElement.textContent = title || 'No title available';
  }
  
  // Update URL
  const urlElement = preview.querySelector('.preview-url');
  if (urlElement) {
    urlElement.textContent = hostname || 'example.com';
  }
  
  // Update description
  const descriptionElement = preview.querySelector('.preview-description');
  if (descriptionElement) {
    descriptionElement.textContent = description || 'No description available';
  }
  
  // Update image
  const imageElement = preview.querySelector('.preview-image');
  if (imageElement) {
    if (image) {
      imageElement.style.backgroundImage = `url('${image}')`;
      imageElement.style.display = 'block';
    } else {
      imageElement.style.display = 'none';
    }
  }
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