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

// Global preview state
const previewState = {
  currentPlatform: 'google',
  currentDevice: 'desktop',
  editMode: false,
  originalMetadata: null,
  editedMetadata: null
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
 * Initialize social preview functionality
 */
function initSocialPreviews() {
  try {
    // Make sure we have the basic structure first
    ensureBasicPreviewStructure();
    
    // Initialize platform tabs
    initSocialTabs();
    
    // Initialize device toggle
    initDeviceToggle();
    
    // Initialize edit mode
    initEditMode();
  } catch (error) {
    console.error('Error initializing social previews:', error);
  }
}

/**
 * Ensure the basic preview structure exists
 */
function ensureBasicPreviewStructure() {
  // Make sure we have a container for the previews
  const previewTab = document.getElementById('social-preview-tab');
  if (!previewTab) {
    console.error('Social preview tab not found in the DOM');
    return;
  }

  // Make sure we have social tabs
  if (!previewTab.querySelector('.social-tabs')) {
    const socialTabs = document.createElement('div');
    socialTabs.className = 'social-tabs';
    socialTabs.innerHTML = `
      <button class="social-tab active" data-preview="google">Google</button>
      <button class="social-tab" data-preview="facebook">Facebook</button>
      <button class="social-tab" data-preview="twitter">Twitter</button>
    `;
    previewTab.prepend(socialTabs);
  }

  // Make sure we have a preview container
  if (!previewTab.querySelector('.preview-container')) {
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
    `;
    
    // Find appropriate place to insert
    const socialTabs = previewTab.querySelector('.social-tabs');
    if (socialTabs) {
      socialTabs.after(previewContainer);
    } else {
      previewTab.appendChild(previewContainer);
    }
  }
}

/**
 * Initialize social tabs functionality with improved interaction
 */
function initSocialTabs() {
  const socialTabs = document.querySelectorAll('.social-tab');
  
  if (!socialTabs || socialTabs.length === 0) {
    console.warn('No social tabs found to initialize');
    return;
  }
  
  socialTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Get the target preview ID
      const previewId = tab.getAttribute('data-preview');
      if (!previewId) return;
      
      // Skip if already active
      if (tab.classList.contains('active')) return;
      
      // Remove active class from all tabs and preview content
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
      } else {
        console.warn(`Preview element #${previewId}-preview not found`);
      }
      
      // Update current platform
      previewState.currentPlatform = previewId;
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
      editToggle.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19V5"/>
        </svg>
        Done Editing
      `;
      
      // Enable editing on previews
      enablePreviewEditing();
    } else {
      editToggle.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
        Edit Preview
      `;
      
      // Disable editing on previews
      disablePreviewEditing();
    }
  });
  
  // Check if image upload button already exists
  if (document.querySelector('.image-upload-btn')) {
    return;
  }
  
  // Create image upload button
  const imageUploadButton = document.createElement('button');
  imageUploadButton.className = 'btn-primary image-upload-btn';
  imageUploadButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
    Upload Image
  `;
  
  // Create hidden file input if not already exists
  if (!document.getElementById('image-upload-input')) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'image-upload-input';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
  }
  
  // Insert image upload button before the preview container
  if (previewContainer) {
    previewContainer.before(imageUploadButton);
  }
  
  // Get file input
  const fileInput = document.getElementById('image-upload-input');
  if (!fileInput) {
    console.warn('Image upload input not found');
    return;
  }
  
  // Add event listeners
  imageUploadButton.addEventListener('click', () => {
    fileInput.click();
  });
  
  fileInput.addEventListener('change', (event) => {
    if (event.target.files && event.target.files[0]) {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        // Create image to get dimensions
        const img = new Image();
        img.onload = function() {
          // Update edited metadata with new image
          if (!previewState.editedMetadata) {
            setupEditedMetadata();
          }
          
          if (previewState.editedMetadata) {
            previewState.editedMetadata.ogImage = e.target.result;
            previewState.editedMetadata.twitterImage = e.target.result;
            
            // Show image dimensions and recommendation if needed
            showImageDimensions(this.width, this.height);
            
            // Refresh all previews with new image
            refreshAllPreviews();
          }
        };
        
        img.src = e.target.result;
      };
      
      reader.readAsDataURL(event.target.files[0]);
    }
  });
}

/**
 * Set up edited metadata object based on original
 */
function setupEditedMetadata() {
  if (!previewState.originalMetadata) return;
  
  previewState.editedMetadata = JSON.parse(JSON.stringify(previewState.originalMetadata));
}

/**
 * Enable editing on preview elements
 */
function enablePreviewEditing() {
  if (!previewState.editedMetadata) {
    setupEditedMetadata();
  }
  
  // Make preview titles and descriptions editable
  const editableElements = {
    'google-title': { type: 'title', platform: 'google' },
    'google-description': { type: 'description', platform: 'google' },
    'facebook-title': { type: 'title', platform: 'facebook' },
    'facebook-description': { type: 'description', platform: 'facebook' },
    'twitter-title': { type: 'title', platform: 'twitter' },
    'twitter-description': { type: 'description', platform: 'twitter' }
  };
  
  Object.keys(editableElements).forEach(id => {
    const element = document.querySelector(`.${id}`);
    if (element) {
      element.contentEditable = true;
      element.classList.add('editable');
      
      // Add focus style
      element.addEventListener('focus', () => {
        element.classList.add('editing');
      });
      
      // Remove focus style
      element.addEventListener('blur', () => {
        element.classList.remove('editing');
        
        // Update edited metadata based on changes
        const info = editableElements[id];
        const value = element.textContent;
        
        if (info.type === 'title') {
          if (info.platform === 'google') {
            previewState.editedMetadata.title = value;
          } else if (info.platform === 'facebook') {
            previewState.editedMetadata.ogTitle = value;
          } else if (info.platform === 'twitter') {
            previewState.editedMetadata.twitterTitle = value;
          }
        } else if (info.type === 'description') {
          if (info.platform === 'google') {
            previewState.editedMetadata.description = value;
          } else if (info.platform === 'facebook') {
            previewState.editedMetadata.ogDescription = value;
          } else if (info.platform === 'twitter') {
            previewState.editedMetadata.twitterDescription = value;
          }
        }
        
        // Refresh all previews to show changes everywhere
        refreshAllPreviews();
      });
    }
  });
  
  // Add info tooltip
  const tooltip = document.createElement('div');
  tooltip.className = 'preview-tooltip';
  tooltip.textContent = 'Click on title or description to edit';
  document.querySelector('.preview-container').appendChild(tooltip);
  
  // Show tooltip briefly
  setTimeout(() => {
    tooltip.classList.add('show');
    
    setTimeout(() => {
      tooltip.classList.remove('show');
      setTimeout(() => {
        tooltip.remove();
      }, 500);
    }, 3000);
  }, 100);
}

/**
 * Disable editing on preview elements
 */
function disablePreviewEditing() {
  // Remove editable attributes
  document.querySelectorAll('.editable').forEach(element => {
    element.contentEditable = false;
    element.classList.remove('editable', 'editing');
  });
}

/**
 * Show image dimensions with recommendation
 * @param {number} width - Image width
 * @param {number} height - Image height
 */
function showImageDimensions(width, height) {
  // Remove existing dimensions display
  const existingDimensions = document.querySelector('.image-dimensions');
  if (existingDimensions) {
    existingDimensions.remove();
  }
  
  // Create dimensions display
  const dimensionsDisplay = document.createElement('div');
  dimensionsDisplay.className = 'image-dimensions';
  
  // Determine if dimensions are optimal
  let status = 'good';
  let message = 'Optimal image size';
  
  if (width < 1200 || height < 630) {
    status = 'warning';
    message = 'Image is smaller than recommended (1200×630px)';
  }
  
  dimensionsDisplay.innerHTML = `
    <span class="dimensions">${width}×${height}px</span>
    <span class="status-badge ${status}">${message}</span>
  `;
  
  // Insert after image upload button
  const imageUploadButton = document.querySelector('.image-upload-btn');
  if (imageUploadButton) {
    imageUploadButton.after(dimensionsDisplay);
  }
}

/**
 * Refresh all social previews
 */
function refreshAllPreviews() {
  const metadata = previewState.editMode ? 
    previewState.editedMetadata : 
    previewState.originalMetadata;
  
  if (!metadata) return;
  
  // Extract common metadata
  const title = metadata.basicMeta?.find(tag => tag.label === 'Title')?.value || '';
  const description = metadata.basicMeta?.find(tag => tag.label === 'Description')?.value || '';
  const ogTitle = metadata.ogMeta?.find(tag => tag.label === 'og:title')?.value || metadata.editedOgTitle || title;
  const ogDescription = metadata.ogMeta?.find(tag => tag.label === 'og:description')?.value || metadata.editedOgDescription || description;
  const ogImage = metadata.ogMeta?.find(tag => tag.label === 'og:image')?.value || metadata.ogImage || '';
  const ogUrl = metadata.ogMeta?.find(tag => tag.label === 'og:url')?.value || metadata.canonicalUrl || '';
  const ogSiteName = metadata.ogMeta?.find(tag => tag.label === 'og:site_name')?.value || '';
  
  // Get hostname for display
  const hostname = extractHostname(ogUrl);
  
  // Update Google preview
  updateGooglePreview(hostname, metadata.title || title, metadata.description || description);
  
  // Update Facebook preview
  updateFacebookPreview(hostname, metadata.ogTitle || ogTitle, metadata.ogDescription || ogDescription, metadata.ogImage || ogImage, ogSiteName);
  
  // Update Twitter preview
  updateTwitterPreview(metadata, hostname, metadata.twitterTitle || ogTitle, metadata.twitterDescription || ogDescription, metadata.twitterImage || ogImage);
  
  // Add LinkedIn preview
  updateLinkedInPreview(hostname, metadata.ogTitle || ogTitle, metadata.ogDescription || ogDescription, metadata.ogImage || ogImage, ogSiteName);
  
  // Add Pinterest preview
  updatePinterestPreview(hostname, metadata.ogTitle || ogTitle, metadata.ogDescription || ogDescription, metadata.ogImage || ogImage);
}

/**
 * Refresh only the current platform preview
 */
function refreshCurrentPreview() {
  const metadata = previewState.editMode ? 
    previewState.editedMetadata : 
    previewState.originalMetadata;
  
  if (!metadata) return;
  
  switch (previewState.currentPlatform) {
    case 'google':
      const title = metadata.basicMeta?.find(tag => tag.label === 'Title')?.value || '';
      const description = metadata.basicMeta?.find(tag => tag.label === 'Description')?.value || '';
      const url = metadata.canonicalUrl || '';
      const hostname = extractHostname(url);
      updateGooglePreview(hostname, metadata.title || title, metadata.description || description);
      break;
      
    case 'facebook':
      const ogTitle = metadata.ogMeta?.find(tag => tag.label === 'og:title')?.value || title;
      const ogDescription = metadata.ogMeta?.find(tag => tag.label === 'og:description')?.value || description;
      const ogImage = metadata.ogMeta?.find(tag => tag.label === 'og:image')?.value || '';
      const ogUrl = metadata.ogMeta?.find(tag => tag.label === 'og:url')?.value || metadata.canonicalUrl || '';
      const ogSiteName = metadata.ogMeta?.find(tag => tag.label === 'og:site_name')?.value || '';
      const fbHostname = extractHostname(ogUrl);
      updateFacebookPreview(fbHostname, metadata.ogTitle || ogTitle, metadata.ogDescription || ogDescription, metadata.ogImage || ogImage, ogSiteName);
      break;
      
    case 'twitter':
      const twUrl = metadata.canonicalUrl || '';
      const twHostname = extractHostname(twUrl);
      updateTwitterPreview(metadata, twHostname, metadata.twitterTitle, metadata.twitterDescription, metadata.twitterImage);
      break;
      
    case 'linkedin':
      const liTitle = metadata.ogMeta?.find(tag => tag.label === 'og:title')?.value || title;
      const liDescription = metadata.ogMeta?.find(tag => tag.label === 'og:description')?.value || description;
      const liImage = metadata.ogMeta?.find(tag => tag.label === 'og:image')?.value || '';
      const liUrl = metadata.ogMeta?.find(tag => tag.label === 'og:url')?.value || metadata.canonicalUrl || '';
      const liSiteName = metadata.ogMeta?.find(tag => tag.label === 'og:site_name')?.value || '';
      const liHostname = extractHostname(liUrl);
      updateLinkedInPreview(liHostname, metadata.ogTitle || liTitle, metadata.ogDescription || liDescription, metadata.ogImage || liImage, liSiteName);
      break;
      
    case 'pinterest':
      const pinUrl = metadata.canonicalUrl || '';
      const pinHostname = extractHostname(pinUrl);
      const pinTitle = metadata.ogMeta?.find(tag => tag.label === 'og:title')?.value || title;
      const pinDescription = metadata.ogMeta?.find(tag => tag.label === 'og:description')?.value || description;
      const pinImage = metadata.ogMeta?.find(tag => tag.label === 'og:image')?.value || '';
      updatePinterestPreview(pinHostname, metadata.ogTitle || pinTitle, metadata.ogDescription || pinDescription, metadata.ogImage || pinImage);
      break;
  }
}

/**
 * Update social previews in Social Preview tab
 * @param {Object} metadata - Metadata from content script
 */
function updateSocialPreviews(metadata) {
  // Store original metadata
  previewState.originalMetadata = metadata;
  
  // Reset edited metadata
  previewState.editedMetadata = null;
  
  // Refresh all previews
  refreshAllPreviews();
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
  
  const isMobile = previewState.currentDevice === 'mobile';
  
  googlePreview.innerHTML = `
    <div class="google-preview ${isMobile ? 'google-mobile' : ''}">
      <div class="google-url">${hostname || 'example.com'}</div>
      <div class="google-title">${title || 'No title available'}</div>
      <div class="google-description">${description || 'No description available. Search engines might generate their own description from page content.'}</div>
      <div class="google-breadcrumbs">
        <span>Home</span> &gt; <span>Section</span>
      </div>
    </div>
  `;
}

/**
 * Update Facebook preview
 * @param {string} hostname - Website hostname
 * @param {string} title - OG title
 * @param {string} description - OG description
 * @param {string} image - OG image URL
 * @param {string} siteName - OG site name
 */
function updateFacebookPreview(hostname, title, description, image, siteName) {
  const facebookPreview = document.getElementById('facebook-preview');
  if (!facebookPreview) return;
  
  const isMobile = previewState.currentDevice === 'mobile';
  
  facebookPreview.innerHTML = `
    <div class="facebook-preview ${isMobile ? 'facebook-mobile' : ''}">
      <div class="facebook-header">
        <div class="facebook-profile-image"></div>
        <div class="facebook-post-info">
          <div class="facebook-page-name">${siteName || hostname || 'Your Page Name'}</div>
          <div class="facebook-post-time">3 hrs • <span class="facebook-globe-icon"></span></div>
        </div>
        <div class="facebook-more-options">•••</div>
      </div>
      <div class="facebook-post-text">Check out our latest article!</div>
      ${image ? 
        `<div class="preview-image" style="background-image: url('${image}')"></div>` : 
        `<div class="preview-image-placeholder">No image provided</div>`
      }
      <div class="facebook-content">
        <div class="facebook-domain">${hostname || 'example.com'}</div>
        <div class="facebook-title">${title || 'No title provided'}</div>
        <div class="facebook-description">${description || 'No description provided'}</div>
      </div>
      <div class="facebook-actions">
        <div class="facebook-action">Like</div>
        <div class="facebook-action">Comment</div>
        <div class="facebook-action">Share</div>
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
  const isMobile = previewState.currentDevice === 'mobile';
  
  twitterPreview.innerHTML = `
    <div class="twitter-preview ${isLargeCard ? 'twitter-large-card' : ''} ${isMobile ? 'twitter-mobile' : ''}">
      <div class="twitter-header">
        <div class="twitter-avatar"></div>
        <div class="twitter-account-info">
          <div class="twitter-name">Twitter User</div>
          <div class="twitter-handle">@twitteruser</div>
        </div>
        <div class="twitter-more-options">•••</div>
      </div>
      <div class="twitter-tweet-text">Check out this awesome content! ${hostname ? `https://${hostname}` : 'https://example.com'}</div>
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
      <div class="twitter-actions">
        <div class="twitter-action twitter-reply">
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="M14.046 2.242l-4.148-.01h-.002c-4.374 0-7.8 3.427-7.8 7.802 0 4.098 3.186 7.206 7.465 7.37v3.828c0 .108.044.286.12.403.142.225.384.347.632.347.138 0 .277-.038.402-.118.264-.168 6.473-4.14 8.088-5.506 1.902-1.61 3.04-3.97 3.043-6.312v-.017c-.006-4.367-3.43-7.787-7.8-7.788zm3.787 12.972c-1.134.96-4.862 3.405-6.772 4.643V16.67c0-.414-.335-.75-.75-.75h-.396c-3.66 0-6.318-2.476-6.318-5.886 0-3.534 2.768-6.302 6.3-6.302l4.147.01h.002c3.532 0 6.3 2.766 6.302 6.296-.003 1.91-.942 3.844-2.514 5.176z"></path></svg>
        </div>
        <div class="twitter-action twitter-retweet">
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="M23.77 15.67c-.292-.293-.767-.293-1.06 0l-2.22 2.22V7.65c0-2.068-1.683-3.75-3.75-3.75h-5.85c-.414 0-.75.336-.75.75s.336.75.75.75h5.85c1.24 0 2.25 1.01 2.25 2.25v10.24l-2.22-2.22c-.293-.293-.768-.293-1.06 0s-.294.768 0 1.06l3.5 3.5c.145.147.337.22.53.22s.383-.072.53-.22c.293-.293.293-.767 0-1.06zm-10.66 3.28H7.26c-1.24 0-2.25-1.01-2.25-2.25V6.46l2.22 2.22c.148.147.34.22.532.22s.384-.073.53-.22c.293-.293.293-.768 0-1.06l-3.5-3.5c-.293-.294-.768-.294-1.06 0l-3.5 3.5c-.294.292-.294.767 0 1.06s.767.293 1.06 0l2.22-2.22V16.7c0 2.068 1.683 3.75 3.75 3.75h5.85c.414 0 .75-.336.75-.75s-.336-.75-.75-.75z"></path></svg>
        </div>
        <div class="twitter-action twitter-like">
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 21.638h-.014C9.403 21.59 1.95 14.856 1.95 8.478c0-3.064 2.525-5.754 5.403-5.754 2.29 0 3.83 1.58 4.646 2.73.814-1.148 2.354-2.73 4.645-2.73 2.88 0 5.404 2.69 5.404 5.755 0 6.376-7.454 13.11-10.037 13.157H12z"></path></svg>
        </div>
        <div class="twitter-action twitter-share">
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="M17.53 7.47l-5-5c-.293-.293-.768-.293-1.06 0l-5 5c-.294.293-.294.768 0 1.06s.767.294 1.06 0l3.72-3.72V15c0 .414.336.75.75.75s.75-.336.75-.75V4.81l3.72 3.72c.146.147.338.22.53.22s.384-.072.53-.22c.293-.293.293-.767 0-1.06z"></path><path d="M19.708 21.944H4.292C3.028 21.944 2 20.916 2 19.652V14c0-.414.336-.75.75-.75s.75.336.75.75v5.652c0 .437.355.792.792.792h15.416c.437 0 .792-.355.792-.792V14c0-.414.336-.75.75-.75s.75.336.75.75v5.652c0 1.264-1.028 2.292-2.292 2.292z"></path></svg>
        </div>
      </div>
    </div>
  `;
}

/**
 * Update LinkedIn preview
 * @param {string} hostname - Website hostname
 * @param {string} title - OG title
 * @param {string} description - OG description
 * @param {string} image - OG image URL
 * @param {string} siteName - OG site name
 */
function updateLinkedInPreview(hostname, title, description, image, siteName) {
  // Create LinkedIn preview tab if not exists
  if (!document.querySelector('.social-tab[data-preview="linkedin"]')) {
    const twitterTab = document.querySelector('.social-tab[data-preview="twitter"]');
    if (twitterTab) {
      const linkedinTab = document.createElement('button');
      linkedinTab.className = 'social-tab';
      linkedinTab.setAttribute('data-preview', 'linkedin');
      linkedinTab.textContent = 'LinkedIn';
      twitterTab.after(linkedinTab);
      
      // Add event listener
      linkedinTab.addEventListener('click', function() {
        const platform = this.getAttribute('data-preview');
        
        if (this.classList.contains('active')) return;
        
        document.querySelectorAll('.social-tab').forEach(t => {
          t.classList.remove('active');
        });
        
        document.querySelectorAll('.preview-content').forEach(content => {
          content.classList.remove('active');
        });
        
        this.classList.add('active');
        document.getElementById(`${platform}-preview`).classList.add('active');
        
        previewState.currentPlatform = platform;
      });
    }
  }
  
  // Create LinkedIn preview container if not exists
  if (!document.getElementById('linkedin-preview')) {
    const twitterPreview = document.getElementById('twitter-preview');
    if (twitterPreview) {
      const linkedinPreview = document.createElement('div');
      linkedinPreview.id = 'linkedin-preview';
      linkedinPreview.className = 'preview-content';
      twitterPreview.after(linkedinPreview);
    }
  }
  
  // Update LinkedIn preview content
  const linkedinPreview = document.getElementById('linkedin-preview');
  if (!linkedinPreview) return;
  
  const isMobile = previewState.currentDevice === 'mobile';
  
  linkedinPreview.innerHTML = `
    <div class="linkedin-preview ${isMobile ? 'linkedin-mobile' : ''}">
      <div class="linkedin-header">
        <div class="linkedin-profile-image"></div>
        <div class="linkedin-post-info">
          <div class="linkedin-name">LinkedIn User</div>
          <div class="linkedin-headline">Product Manager at ${siteName || hostname || 'Company'}</div>
          <div class="linkedin-post-meta">3d • <span class="linkedin-globe-icon"></span></div>
        </div>
        <div class="linkedin-more-options">•••</div>
      </div>
      <div class="linkedin-post-text">Excited to share our latest article!</div>
      <div class="linkedin-card">
        ${image ? 
          `<div class="preview-image" style="background-image: url('${image}')"></div>` : 
          `<div class="preview-image-placeholder">No image provided</div>`
        }
        <div class="linkedin-content">
          <div class="linkedin-title">${title || 'No title provided'}</div>
          <div class="linkedin-description">${description || 'No description provided'}</div>
          <div class="linkedin-domain">${hostname || 'example.com'}</div>
        </div>
      </div>
      <div class="linkedin-engagement">
        <div class="linkedin-reactions">
          <span class="linkedin-like-icon"></span>
          <span class="linkedin-comment-icon"></span>
          <span>24</span>
        </div>
        <div class="linkedin-comments">2 comments</div>
      </div>
      <div class="linkedin-actions">
        <div class="linkedin-action">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M19.46 11l-3.91-3.91a7 7 0 01-1.69-2.74l-.49-1.47A2.76 2.76 0 0010.76 1 2.75 2.75 0 008 3.74v1.12a9.19 9.19 0 00.46 2.85L8.89 9H4.12A2.12 2.12 0 002 11.12a2.16 2.16 0 00.92 1.76A2.11 2.11 0 002 14.62a2.14 2.14 0 001.28 2 2 2 0 00-.28 1 2.12 2.12 0 002 2.12v.14A2.12 2.12 0 007.12 22h7.49a8.08 8.08 0 003.58-.84l.31-.16H21V11zM19 19h-1l-.73.37a6.14 6.14 0 01-2.69.63H7.72a1 1 0 01-1-.72l-.25-.87-.85-.41A1 1 0 015 17l.17-1-.76-.74A1 1 0 014.27 14l.66-1.09-.73-1.1a.49.49 0 01.08-.7.48.48 0 01.34-.11h7.05l-1.31-3.92A7.19 7.19 0 0110 4.86V3.75a.77.77 0 01.75-.75.75.75 0 01.71.51L12 5a9 9 0 002.13 3.5l4.5 4.5H19z"></path></svg>
          Like
        </div>
        <div class="linkedin-action">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M7 9h10v1H7zm0 4h7v-1H7zm16-2a6.78 6.78 0 01-2.84 5.61L12 22v-4H8A7 7 0 018 4h8a7 7 0 017 7zm-2 0a5 5 0 00-5-5H8a5 5 0 000 10h6v2.28L19 15a4.79 4.79 0 002-4z"></path></svg>
          Comment
        </div>
        <div class="linkedin-action">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M21 3L0 10l7.66 4.26L16 8l-6.26 8.34L14 24l7-21z"></path></svg>
          Share
        </div>
        <div class="linkedin-action">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M21 8c-1.45 0-2.26 1.44-1.93 2.51l-3.55 3.56c-.3-.09-.74-.09-1.04 0l-2.55-2.55C12.27 10.45 11.46 9 10 9c-1.45 0-3 1.69-3 3.5 0 1.41.73 2.5 1.93 2.5 1.45 0 2.26-1.44 1.93-2.51l2.55-2.55c.3.09.74.09 1.04 0l3.55 3.56C17.73 14.55 18.54 16 20 16c1.45 0 3-1.69 3-3.5 0-1.41-.73-2.5-1.93-2.5z"></path></svg>
          Send
        </div>
      </div>
    </div>
  `;
}

/**
 * Update Pinterest preview
 * @param {string} hostname - Website hostname
 * @param {string} title - OG title
 * @param {string} description - OG description
 * @param {string} image - OG image URL
 */
function updatePinterestPreview(hostname, title, description, image) {
  // Create Pinterest preview tab if not exists
  if (!document.querySelector('.social-tab[data-preview="pinterest"]')) {
    const linkedinTab = document.querySelector('.social-tab[data-preview="linkedin"]');
    if (linkedinTab) {
      const pinterestTab = document.createElement('button');
      pinterestTab.className = 'social-tab';
      pinterestTab.setAttribute('data-preview', 'pinterest');
      pinterestTab.textContent = 'Pinterest';
      linkedinTab.after(pinterestTab);
      
      // Add event listener
      pinterestTab.addEventListener('click', function() {
        const platform = this.getAttribute('data-preview');
        
        if (this.classList.contains('active')) return;
        
        document.querySelectorAll('.social-tab').forEach(t => {
          t.classList.remove('active');
        });
        
        document.querySelectorAll('.preview-content').forEach(content => {
          content.classList.remove('active');
        });
        
        this.classList.add('active');
        document.getElementById(`${platform}-preview`).classList.add('active');
        
        previewState.currentPlatform = platform;
      });
    }
  }
  
  // Create Pinterest preview container if not exists
  if (!document.getElementById('pinterest-preview')) {
    const linkedinPreview = document.getElementById('linkedin-preview');
    if (linkedinPreview) {
      const pinterestPreview = document.createElement('div');
      pinterestPreview.id = 'pinterest-preview';
      pinterestPreview.className = 'preview-content';
      linkedinPreview.after(pinterestPreview);
    }
  }
  
  // Update Pinterest preview content
  const pinterestPreview = document.getElementById('pinterest-preview');
  if (!pinterestPreview) return;
  
  const isMobile = previewState.currentDevice === 'mobile';
  const hasImage = !!image;
  
  pinterestPreview.innerHTML = `
    <div class="pinterest-preview ${isMobile ? 'pinterest-mobile' : ''}">
      <div class="pinterest-pin">
        ${hasImage ? 
          `<div class="pinterest-image" style="background-image: url('${image}')">
            <div class="pinterest-save-button">Save</div>
          </div>` : 
          `<div class="pinterest-image-placeholder">
            <div class="pinterest-no-image-text">No image provided</div>
            <div class="pinterest-save-button">Save</div>
          </div>`
        }
        <div class="pinterest-content">
          <div class="pinterest-title">${title || 'No title provided'}</div>
          <div class="pinterest-domain">${hostname || 'example.com'}</div>
        </div>
      </div>
      <div class="pinterest-similar">
        <div class="pinterest-similar-text">More like this</div>
        <div class="pinterest-similar-pins">
          <div class="pinterest-similar-pin"></div>
          <div class="pinterest-similar-pin"></div>
          <div class="pinterest-similar-pin"></div>
        </div>
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
 * Initialize copy buttons functionality
 */
function initCopyButtons() {
  // Initialize copy buttons for different meta sections
  setupCopyButton('copy-basic-meta', () => collectMetaTagsText('basic-meta-tags'));
  setupCopyButton('copy-og-meta', () => collectMetaTagsText('og-meta-tags'));
  setupCopyButton('copy-twitter-meta', () => collectMetaTagsText('twitter-meta-tags'));
  setupCopyButton('copy-schema', () => collectMetaTagsText('schema-data'));
  setupCopyButton('copy-full-report', () => generateFullReport());
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