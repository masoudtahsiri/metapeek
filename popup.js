/**
 * MetaPeek Popup
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
  initialized: false
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
  pageHostname: null
};

/**
 * Social Preview Module - Complete Implementation
 * This includes all functions needed for the social preview functionality
 */

// Global preview state
const socialPreviewState = {
  currentPlatform: 'google',
  currentDevice: 'desktop',
  originalMetadata: null,
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
  initMetaSectionTabs();
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
    
    console.log('UI update complete');
  } catch (error) {
    console.error('Error populating UI:', error);
    showError('Error displaying data: ' + error.message);
  }
}

/**
 * Update SEO Score display (with new category breakdowns)
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
      scoreTitle.textContent = 'Excellent SEO Health';
    } else if (scoreData.score >= 60) {
      scoreTitle.textContent = 'Good SEO Health';
    } else {
      scoreTitle.textContent = 'Needs Improvement';
    }
  }
  
  if (scoreDescription) {
    const categoryScores = scoreData.categoryScores || {};
    const weakestCategory = Object.entries(categoryScores)
      .sort(([,a], [,b]) => a - b)[0];
    
    if (scoreData.score >= 80) {
      scoreDescription.textContent = 'Your page is well-optimized for modern SEO standards.';
    } else if (scoreData.score >= 60) {
      scoreDescription.textContent = `Good foundation. Focus on improving ${weakestCategory ? weakestCategory[0] : 'technical'} factors.`;
    } else {
      scoreDescription.textContent = `Significant improvements needed, especially in ${weakestCategory ? weakestCategory[0] : 'technical'} SEO.`;
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
  
  const allIssuesContainer = document.getElementById('all-issues');
  const highIssuesContainer = document.getElementById('high-issues');
  const mediumIssuesContainer = document.getElementById('medium-issues');
  const lowIssuesContainer = document.getElementById('low-issues');
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
  
  // Helper function to create impact badge based on level
  const getImpactBadge = (impact) => {
    const impactClass = impact.toLowerCase();
    return `<span class="issue-impact ${impactClass}">${impact}</span>`;
  };
  
  // Sort issues by impact: High > Medium > Low
  issues.sort((a, b) => {
    const impactOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
    const impactA = a.impact || 'Low';
    const impactB = b.impact || 'Low';
    return (impactOrder[impactA] || 99) - (impactOrder[impactB] || 99);
  });
  
  let html = '';
  
  // Render each issue with concise formatting
  issues.forEach(issue => {
    html += `
      <div class="issue-item ${issue.impact.toLowerCase()}" style="position:relative;">
        <div class="issue-header">
          <h4>${issue.title}</h4>
          ${getImpactBadge(issue.impact)}
        </div>
        <p class="issue-description">${issue.description}</p>
        <div class="issue-category-wrapper">
          <span class="issue-category">${issue.category}</span>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
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
}

/**
 * Initialize tooltips and adjust their positions to stay within viewport
 * This should be called after loading meta tags or whenever new tooltips are added
 */
function initTooltips() {
  const statusBadges = document.querySelectorAll('.status-badge[data-tooltip]');
  const globalTooltip = document.getElementById('global-tooltip');

  statusBadges.forEach(badge => {
    badge.addEventListener('mouseenter', function(e) {
      const tooltipText = this.getAttribute('data-tooltip');
      if (!tooltipText) return;

      // Find the closest .meta-section-content ancestor
      const container = this.closest('.meta-section-content');
      if (!container) return;

      globalTooltip.textContent = tooltipText;
      globalTooltip.style.display = 'block';

      const rect = this.getBoundingClientRect();
      const tooltipRect = globalTooltip.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Calculate position relative to container
      let left = rect.left - containerRect.left + (rect.width / 2) - (tooltipRect.width / 2);
      let top = rect.top - containerRect.top - tooltipRect.height - 10;

      // Adjust if tooltip would go off screen horizontally
      if (left < 10) {
        left = 10;
      } else if (left + tooltipRect.width > containerRect.width - 10) {
        left = containerRect.width - tooltipRect.width - 10;
      }

      // Adjust if tooltip would go off screen vertically
      if (top < 10) {
        // If tooltip would go above container, position it below the badge
        top = rect.bottom - containerRect.top + 10;
      }

      globalTooltip.style.left = `${left + containerRect.left}px`;
      globalTooltip.style.top = `${top + containerRect.top}px`;
    });

    badge.addEventListener('mouseleave', function() {
      globalTooltip.style.display = 'none';
    });
  });
}

/**
 * Update basic meta tags in Meta Tags tab with tooltips
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
 * Update schema.org data in Meta Tags tab with tooltips
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
  
  // Add a generic schema explanation tooltip
  const schemaTooltip = "Schema.org markup is structured data that helps search engines understand your content. It enables rich search results like FAQ snippets, recipe cards, and product information. Valid implementation can improve click-through rates by enhancing how your content appears in search results.";
  
  schemaData.forEach(schema => {
    if (schema.valid && schema.data) {
      const schemaType = schema.data['@type'] || 'Unknown Type';
      
      const row = document.createElement('div');
      row.className = 'meta-row';
      
      row.innerHTML = `
        <div class="meta-cell name">@type</div>
        <div class="meta-cell value">${Array.isArray(schemaType) ? schemaType.join(', ') : schemaType}</div>
        <div class="meta-cell status">
          <span class="status-badge good" data-tooltip="${schemaTooltip}">
            Valid
            <svg class="info-icon" width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2"/><rect x="9" y="8" width="2" height="5" rx="1" fill="currentColor"/><rect x="9" y="5" width="2" height="2" rx="1" fill="currentColor"/></svg>
          </span>
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
              <span class="status-badge good" data-tooltip="This property is properly defined in your Schema.org markup.">
                Present
                <svg class="info-icon" width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2"/><rect x="9" y="8" width="2" height="5" rx="1" fill="currentColor"/><rect x="9" y="5" width="2" height="2" rx="1" fill="currentColor"/></svg>
              </span>
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
          <span class="status-badge error" data-tooltip="${schemaTooltip} Your Schema.org markup has errors that need to be fixed.">
            Error
            <svg class="info-icon" width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2"/><rect x="9" y="8" width="2" height="5" rx="1" fill="currentColor"/><rect x="9" y="5" width="2" height="2" rx="1" fill="currentColor"/></svg>
          </span>
        </div>
      `;
      
      container.appendChild(row);
    }
  });
  
  // Initialize tooltips after updating the badges
  initTooltips();
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
 * Initialize social tabs functionality
 * Only toggles visibility without regenerating content
 */
function initSocialTabs() {
  const tabs = document.querySelectorAll('.social-tab');
  if (!tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
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
      } catch (error) {
        console.error('Error handling tab click:', error);
      }
    });
  });
}

/**
 * Update all social previews with metadata
 * Generate all previews only ONCE when metadata is loaded
 */
function updateSocialPreviews(metadata) {
  if (!metadata) {
    console.warn('No metadata provided to update social previews');
    return;
  }
  
  console.log('Updating social previews with metadata', metadata);
  
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

  // Store metadata in state
  socialPreviewState.originalMetadata = {
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
  
  // Get values with fallbacks
  const title = metadata.title || metadata.ogTitle || metadata.twitterTitle || '';
  const description = metadata.description || metadata.ogDescription || metadata.twitterDescription || '';
  const image = metadata.ogImage || metadata.twitterImage || '';
  const siteName = metadata.siteName || '';

  // Generate previews for each platform
  generateGooglePreview(hostname, title, description);
  generateFacebookPreview(hostname, metadata.ogTitle || title, metadata.ogDescription || description, image, siteName);
  generateTwitterPreview(metadata, hostname, metadata.twitterTitle || metadata.ogTitle || title, metadata.twitterDescription || metadata.ogDescription || description, metadata.twitterImage || image);
  generateLinkedInPreview(hostname, metadata.ogTitle || title, metadata.ogDescription || description, image, siteName);
  generateSlackPreview(hostname, metadata.ogTitle || title, metadata.ogDescription || description, image, siteName);
}

/**
 * Generate Google preview with metadata
 */
function generateGooglePreview(hostname, title, description) {
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
 * Generate Facebook preview with metadata
 */
function generateFacebookPreview(hostname, title, description, image, siteName) {
  const preview = document.getElementById('facebook-preview');
  if (!preview) return;
  
  let facebookImage = image;
  if (!facebookImage || typeof facebookImage !== 'string' || facebookImage.trim() === '') {
    facebookImage = 'https://via.placeholder.com/1200x630?text=No+Image';
  }
  
  preview.innerHTML = `
    <div class="card-seo-facebook">
      ${facebookImage ? 
        `<img class="card-seo-facebook__image" src="${facebookImage}" alt="Facebook preview image">` :
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
 * Generate Twitter preview with metadata
 */
function generateTwitterPreview(metadata, hostname, title, description, image) {
  const preview = document.getElementById('twitter-preview');
  if (!preview) return;

  // Fallback logic for Twitter card
  const cardImage = metadata.twitterImage || metadata.ogImage || image || '';
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
 * Generate LinkedIn preview with metadata
 */
function generateLinkedInPreview(hostname, title, description, image, siteName) {
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
      
      // Initialize tooltips after tab change
      initTooltips();
    });
  });
}

/**
 * Initialize copy buttons functionality
 */
function initCopyButtons() {
  // Initialize copy buttons for different meta sections
  setupCopyButton('copy-basic-meta', () => collectMetaTagsHTML('basic-meta-content'));
  setupCopyButton('copy-og-meta', () => collectMetaTagsHTML('og-meta-content'));
  setupCopyButton('copy-twitter-meta', () => collectMetaTagsHTML('twitter-meta-content'));
  setupCopyButton('copy-schema', () => collectSchemaHTML('schema-content'));
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
 * Collect meta tags as HTML for copying (UPDATED)
 * @param {string} containerId - ID of the container to collect from
 * @returns {string} HTML string of meta tags
 */
function collectMetaTagsHTML(containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`Container with ID ${containerId} not found`);
    return '';
  }

  const metaRows = container.querySelectorAll('.meta-row');
  if (!metaRows.length) {
    console.warn(`No meta rows found in container ${containerId}`);
    return '<!-- No meta tags found -->';
  }

  const htmlTags = [];
  
  metaRows.forEach(row => {
    const nameCell = row.querySelector('.meta-cell.name');
    const valueCell = row.querySelector('.meta-cell.value:not(.empty)');
    
    if (!nameCell || !valueCell) return;
    
    const tagName = nameCell.textContent.trim();
    const tagValue = valueCell.textContent.trim();
    
    if (!tagValue || tagValue === 'Not set') return;
    
    // Generate appropriate HTML based on tag type
    let html = '';
    
    if (tagName.startsWith('og:')) {
      html = `<meta property="${tagName}" content="${tagValue}">`;
    } else if (tagName.startsWith('twitter:')) {
      html = `<meta name="${tagName}" content="${tagValue}">`;
    } else if (tagName === 'apple-touch-icon') {
      html = `<link rel="apple-touch-icon" href="${tagValue}">`;
    } else if (tagName === 'manifest') {
      html = `<link rel="manifest" href="${tagValue}">`;
    } else if (tagName === 'canonical') {
      html = `<link rel="canonical" href="${tagValue}">`;
    } else if (tagName === 'Title') {
      html = `<title>${tagValue}</title>`;
    } else {
      // Standard meta tag
      html = `<meta name="${tagName.toLowerCase()}" content="${tagValue}">`;
    }
    
    htmlTags.push(html);
  });
  
  return htmlTags.length > 0 ? htmlTags.join('\n') : '<!-- No valid meta tags found -->';
}

/**
 * Helper function for schema HTML collection
 */
function collectSchemaHTML(containerId) {
  // Return schema data as JSON-LD format
  return '<!-- Schema.org data would be in JSON-LD format -->';
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

/**
 * Initialize meta section tabs functionality
 */
function initMetaSectionTabs() {
  const metaSectionTabs = document.querySelectorAll('.meta-section-tab');
  
  metaSectionTabs.forEach(tab => {
    tab.addEventListener('click', () => {
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
 * Initialize impact tabs functionality
 */
function initImpactTabs() {
  const impactTabs = document.querySelectorAll('.impact-tab');
  
  impactTabs.forEach(tab => {
    tab.addEventListener('click', () => {
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

document.addEventListener('mouseover', function (e) {
  const target = e.target.closest('[data-tooltip]');
  const tooltip = document.getElementById('global-tooltip');
  if (target && tooltip) {
    // Remove any previous arrow
    let arrow = tooltip.querySelector('.tooltip-arrow');
    if (arrow) arrow.remove();

    // Set content
    tooltip.textContent = target.getAttribute('data-tooltip');

    // Add left border for status badges
    tooltip.style.borderLeft = '';
    if (target.classList.contains('good')) {
      tooltip.style.borderLeft = '4px solid ' + getComputedStyle(document.body).getPropertyValue('--status-good');
    } else if (target.classList.contains('warning')) {
      tooltip.style.borderLeft = '4px solid ' + getComputedStyle(document.body).getPropertyValue('--status-warning');
    } else if (target.classList.contains('error')) {
      tooltip.style.borderLeft = '4px solid ' + getComputedStyle(document.body).getPropertyValue('--status-error');
    }

    // Style
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    tooltip.style.background = isDark ? '#fff' : '#1f2937';
    tooltip.style.color = isDark ? '#111827' : '#fff';
    tooltip.style.padding = '10px 14px';
    tooltip.style.borderRadius = '8px';
    tooltip.style.fontSize = '12.5px';
    tooltip.style.fontWeight = '500';
    tooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    tooltip.style.whiteSpace = 'normal';
    tooltip.style.maxWidth = '220px';
    tooltip.style.position = 'fixed';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.display = 'block';
    tooltip.style.transition = 'opacity 0.2s cubic-bezier(0.16,1,0.3,1), transform 0.2s cubic-bezier(0.16,1,0.3,1)';
    tooltip.style.opacity = '1';

    // Position tooltip
    const rect = target.getBoundingClientRect();
    const tooltipWidth = 220;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipWidth - 8));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${rect.bottom + 10}px`;

    // Add arrow
    arrow = document.createElement('div');
    arrow.className = 'tooltip-arrow';
    arrow.style.position = 'absolute';
    arrow.style.top = '-6px';
    arrow.style.left = '50%';
    arrow.style.transform = 'translateX(-50%)';
    arrow.style.width = '0';
    arrow.style.height = '0';
    arrow.style.borderLeft = '6px solid transparent';
    arrow.style.borderRight = '6px solid transparent';
    arrow.style.borderBottom = isDark ? '6px solid #fff' : '6px solid #1f2937';
    arrow.style.zIndex = '100000';
    tooltip.prepend(arrow);
  }
});

document.addEventListener('mouseout', function (e) {
  const tooltip = document.getElementById('global-tooltip');
  if (tooltip) {
    tooltip.style.display = 'none';
    tooltip.textContent = '';
    let arrow = tooltip.querySelector('.tooltip-arrow');
    if (arrow) arrow.remove();
  }
}); 