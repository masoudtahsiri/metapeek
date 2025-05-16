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
    initSocialTabs();
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
 * Initialize web vitals data collection
 */
function initializeWebVitals() {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (!tabs || !tabs[0]) return;
    
    const activeTab = tabs[0];
    
    chrome.tabs.sendMessage(activeTab.id, { type: 'initWebVitals' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        console.error('Error initializing web vitals:', chrome.runtime.lastError);
        return;
      }
      
      state.webVitalsInitialized = true;
      
      if (response.metrics && (response.metrics.partialMetricsAvailable || response.metrics.metricsCollected)) {
        updatePerformanceMetrics(response.metrics);
      }
      
      // Set up a polling mechanism to get updated metrics
      pollWebVitals();
    });
  });
}

/**
 * Poll for web vitals updates
 */
function pollWebVitals() {
  if (!state.webVitalsInitialized) return;
  
  const pollInterval = setInterval(() => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (!tabs || !tabs[0]) {
        clearInterval(pollInterval);
        return;
      }
      
      const activeTab = tabs[0];
      
      chrome.tabs.sendMessage(activeTab.id, { type: 'getWebVitals' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          console.error('Error getting web vitals update:', chrome.runtime.lastError);
          return;
        }
        
        if (response.metrics && (response.metrics.partialMetricsAvailable || response.metrics.metricsCollected)) {
          updatePerformanceMetrics(response.metrics);
        }
      });
    });
  }, 2000); // Poll every 2 seconds
  
  // Clear interval after 30 seconds to avoid unnecessary processing
  setTimeout(() => {
    clearInterval(pollInterval);
  }, 30000);
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
 * Update social previews in Social Preview tab
 * @param {Object} metadata - Metadata from content script
 */
function updateSocialPreviews(metadata) {
  // Extract common metadata
  const title = metadata.basicMeta?.find(tag => tag.label === 'Title')?.value || '';
  const description = metadata.basicMeta?.find(tag => tag.label === 'Description')?.value || '';
  const ogTitle = metadata.ogMeta?.find(tag => tag.label === 'og:title')?.value || title;
  const ogDescription = metadata.ogMeta?.find(tag => tag.label === 'og:description')?.value || description;
  const ogImage = metadata.ogMeta?.find(tag => tag.label === 'og:image')?.value || '';
  const ogUrl = metadata.ogMeta?.find(tag => tag.label === 'og:url')?.value || metadata.canonicalUrl || '';
  
  // Get hostname for display
  const hostname = extractHostname(ogUrl);
  
  // Update Google preview
  updateGooglePreview(hostname, title, description);
  
  // Update Facebook preview
  updateFacebookPreview(hostname, ogTitle, ogDescription, ogImage);
  
  // Update Twitter preview
  updateTwitterPreview(metadata, hostname, ogTitle, ogDescription, ogImage);
}

/**
 * Update Google search preview
 * @param {string} hostname - Website hostname
 * @param {string} title - Page title
 * @param {string} description - Page description
 */
function updateGooglePreview(hostname, title, description) {
  const googlePreview = document.getElementById('google-preview');
  if (!googlePreview) return;
  
  googlePreview.innerHTML = `
    <div class="google-preview">
      <div class="google-url">${hostname || 'example.com'}</div>
      <div class="google-title">${title || 'No title available'}</div>
      <div class="google-description">${description || 'No description available. Search engines might generate their own description from page content.'}</div>
    </div>
  `;
}

/**
 * Update Facebook preview
 * @param {string} hostname - Website hostname
 * @param {string} title - OG title
 * @param {string} description - OG description
 * @param {string} image - OG image URL
 */
function updateFacebookPreview(hostname, title, description, image) {
  const facebookPreview = document.getElementById('facebook-preview');
  if (!facebookPreview) return;
  
    facebookPreview.innerHTML = `
    <div class="facebook-preview">
      ${image ? 
        `<div class="preview-image" style="background-image: url('${image}')"></div>` : 
        `<div class="preview-image-placeholder">No image provided</div>`
      }
      <div class="facebook-content">
        <div class="facebook-domain">${hostname || 'example.com'}</div>
        <div class="facebook-title">${title || 'No title provided'}</div>
        <div class="facebook-description">${description || 'No description provided'}</div>
        </div>
      </div>
    `;
  }
  
/**
 * Update Twitter preview
 * @param {Object} metadata - Metadata from content script
 * @param {string} hostname - Website hostname
 * @param {string} ogTitle - Default title (from OG)
 * @param {string} ogDescription - Default description (from OG)
 * @param {string} ogImage - Default image (from OG)
 */
function updateTwitterPreview(metadata, hostname, ogTitle, ogDescription, ogImage) {
  const twitterPreview = document.getElementById('twitter-preview');
  if (!twitterPreview) return;
  
  const twitterTitle = metadata.twitterMeta?.find(tag => tag.label === 'twitter:title')?.value || ogTitle;
  const twitterDescription = metadata.twitterMeta?.find(tag => tag.label === 'twitter:description')?.value || ogDescription;
  const twitterImage = metadata.twitterMeta?.find(tag => tag.label === 'twitter:image')?.value || ogImage;
  const twitterCard = metadata.twitterMeta?.find(tag => tag.label === 'twitter:card')?.value || 'summary';
  const twitterSite = metadata.twitterMeta?.find(tag => tag.label === 'twitter:site')?.value || '';
  
  const isLargeCard = twitterCard === 'summary_large_image';
    
    twitterPreview.innerHTML = `
    <div class="twitter-preview ${isLargeCard ? 'twitter-large-card' : ''}">
      ${twitterImage ? 
        `<div class="preview-image" style="background-image: url('${twitterImage}')"></div>` : 
        `<div class="preview-image-placeholder">No image provided</div>`
      }
      <div class="twitter-content">
        <div class="twitter-site">${twitterSite || hostname || 'example.com'}</div>
        <div class="twitter-title">${twitterTitle || 'No title provided'}</div>
        <div class="twitter-description">${twitterDescription || 'No description provided'}</div>
        <div class="twitter-domain">${hostname || 'example.com'}</div>
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
    button.addEventListener('click', () => {
      // Get the target tab ID
      const tabId = button.getAttribute('data-tab');
      
      // Skip if already active
      if (button.classList.contains('active')) return;
      
      // Remove active class from all tab buttons and panes
      document.querySelectorAll('.tab-button').forEach(tab => {
        tab.classList.remove('active');
      });
      
      document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
      });
      
      // Add active class to clicked tab button and corresponding pane
      button.classList.add('active');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });
}

/**
 * Initialize social preview tabs functionality
 */
function initSocialTabs() {
  const socialTabs = document.querySelectorAll('.social-tab');
  
  socialTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Get the target preview ID
      const previewId = tab.getAttribute('data-preview');
      
      // Skip if already active
      if (tab.classList.contains('active')) return;
      
      // Remove active class from all tabs and preview content
      document.querySelectorAll('.social-tab').forEach(t => {
        t.classList.remove('active');
      });
      
      document.querySelectorAll('.preview-content').forEach(content => {
        content.classList.remove('active');
      });
      
      // Add active class to clicked tab and corresponding preview
      tab.classList.add('active');
      document.getElementById(`${previewId}-preview`).classList.add('active');
    });
  });
}

/**
 * Initialize copy buttons functionality
 */
function initCopyButtons() {
  // Initialize copy buttons for different meta sections
  setupCopyButton('copy-basic-meta', () => collectMetaTagsText('basic-meta-content'));
  setupCopyButton('copy-og-meta', () => collectMetaTagsText('og-meta-content'));
  setupCopyButton('copy-twitter-meta', () => collectMetaTagsText('twitter-meta-content'));
  setupCopyButton('copy-canonical', () => collectMetaTagsText('canonical-content'));
  setupCopyButton('copy-schema', () => collectMetaTagsText('schema-content'));
  
  // Initialize export button
  const exportButton = document.getElementById('export-button');
  if (exportButton) {
    exportButton.addEventListener('click', () => {
      const text = generateFullReport();
      
      navigator.clipboard.writeText(text)
        .then(() => showToast('Full report copied to clipboard!'))
        .catch(err => {
          console.error('Failed to copy report:', err);
          showToast('Failed to copy report!');
        });
    });
  }
}

/**
 * Setup a copy button with the specified functionality
 * @param {string} buttonId - ID of the button element
 * @param {Function} getTextFn - Function to get the text to copy
 */
function setupCopyButton(buttonId, getTextFn) {
  const button = document.getElementById(buttonId);
  if (!button) return;
  
  button.addEventListener('click', () => {
    const text = getTextFn();
    
    if (text) {
      navigator.clipboard.writeText(text)
        .then(() => showToast('Copied to clipboard!'))
        .catch(err => {
          console.error('Failed to copy:', err);
          showToast('Failed to copy!');
        });
    } else {
      showToast('Nothing to copy!');
    }
  });
}

/**
 * Collect meta tag text from a container
 * @param {string} containerId - ID of the container element
 * @returns {string} Text representation of meta tags
 */
function collectMetaTagsText(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return '';
  
  const rows = container.querySelectorAll('.meta-row');
  if (rows.length === 0) return '';
  
  let text = '';
  
  rows.forEach(row => {
    const name = row.querySelector('.meta-cell.name')?.textContent || '';
    const value = row.querySelector('.meta-cell.value')?.textContent || '';
    
    if (value !== 'Not set' && value !== '') {
      text += `${name}: ${value}\n`;
    }
  });
  
  return text;
}

/**
 * Generate a full report of all meta data
 * @returns {string} Text representation of all metadata
 */
function generateFullReport() {
  if (!state.metadata) return 'No data available';
  
  let report = 'MetaPeek SEO Report\n';
  report += '===================\n\n';
  
  // Add URL
  report += `URL: ${state.metadata.currentUrl || 'Unknown URL'}\n`;
  report += `Generated: ${new Date().toLocaleString()}\n\n`;
  
  // Add SEO score
  if (state.metadata.seoScore) {
    report += `SEO Score: ${state.metadata.seoScore.score}/100\n\n`;
  }
  
  // Add basic meta tags
  report += 'Basic Meta Tags\n';
  report += '--------------\n';
  report += collectMetaTagsText('basic-meta-content') || 'No basic meta tags found.';
  report += '\n\n';
  
  // Add Open Graph tags
  report += 'Open Graph Tags\n';
  report += '---------------\n';
  report += collectMetaTagsText('og-meta-content') || 'No Open Graph tags found.';
  report += '\n\n';
  
  // Add Twitter Card tags
  report += 'Twitter Card Tags\n';
  report += '-----------------\n';
  report += collectMetaTagsText('twitter-meta-content') || 'No Twitter Card tags found.';
  report += '\n\n';
  
  // Add canonical URL
  report += 'Canonical URL\n';
  report += '-------------\n';
  report += collectMetaTagsText('canonical-content') || 'No canonical URL found.';
  report += '\n\n';
  
  // Add Schema.org data
  report += 'Schema.org Data\n';
  report += '---------------\n';
  report += collectMetaTagsText('schema-content') || 'No Schema.org data found.';
  report += '\n\n';
  
  // Add issues
  if (state.metadata.seoScore && state.metadata.seoScore.recommendations) {
    report += 'Issues and Recommendations\n';
    report += '-------------------------\n';
    
    state.metadata.seoScore.recommendations.forEach(category => {
      if (category.items && category.items.length > 0) {
        report += `${category.category}:\n`;
        
        category.items.forEach(item => {
          report += `- ${item.issue}: ${item.details} (${item.impact} Impact)\n`;
        });
        
        report += '\n';
      }
    });
  }
  
  return report;
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