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
  
  // Clear placeholder data and show loading indicators
  clearPlaceholders();
  
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
    initActionItems();
    initPreviewTabs();
    initPerformanceToggle();
    initMetaDrawer();
    initCopyButtons();
    initCollapsibleSections();
    initCustomStyles();
  } catch (error) {
    console.error('Error initializing UI:', error);
  }
}

/**
 * Clear placeholder data and show loading states
 */
function clearPlaceholders() {
  document.querySelectorAll('.meta-card, .preview-content').forEach(el => {
    el.innerHTML = createLoadingIndicator('Loading data...');
  });
}

/**
 * Create HTML for a loading indicator
 * @param {string} message - Message to display
 * @returns {string} HTML for loading indicator
 */
function createLoadingIndicator(message) {
  return `
    <div class="loading-indicator">
      <div class="loading-spinner"></div>
      <div class="loading-text">${message}</div>
        </div>
  `;
}

/**
 * Create HTML for an error indicator
 * @param {string} message - Error message to display
 * @returns {string} HTML for error indicator
 */
function createErrorIndicator(message) {
  return `
    <div class="error-indicator">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      <div class="error-text">${message}</div>
      </div>
  `;
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
      state.errors.metadata = 'Unable to access current tab';
      showError(state.errors.metadata);
      state.loading.metadata = false;
      return;
    }
    
    const activeTab = tabs[0];
    console.log('Getting metadata for tab:', activeTab.id);
    
    // Add a timeout to prevent indefinite waiting
    let responseReceived = false;
    const timeoutId = setTimeout(() => {
      if (!responseReceived) {
        console.error('Timeout waiting for metadata response');
        state.errors.metadata = 'Timeout getting metadata from page. Please refresh and try again.';
        showError(state.errors.metadata);
        state.loading.metadata = false;
      }
    }, CONFIG.loadingTimeout);
    
    // Request metadata from content script
    chrome.tabs.sendMessage(activeTab.id, { type: 'getMetadata' }, (response) => {
      // Clear timeout
      clearTimeout(timeoutId);
      responseReceived = true;
      state.loading.metadata = false;
      
      if (chrome.runtime.lastError) {
        console.error('Error getting metadata:', chrome.runtime.lastError);
        state.errors.metadata = 'Failed to connect to page. Please refresh and try again.';
        showError(state.errors.metadata);
        return;
      }
      
      if (!response) {
        console.error('No response received from content script');
        state.errors.metadata = 'No data received from page';
        showError(state.errors.metadata);
        return;
      }
      
      console.log('Received metadata');
      state.metadata = response;
      populateUI(response);
    });
  });
  
  // Initialize web vitals data collection
  initializeWebVitals();
}

/**
 * Show error message in all data containers
 * @param {string} message - Error message to display
 */
function showError(message) {
  console.error('Error:', message);
  
  document.querySelectorAll('.meta-card, .preview-content, .score-section').forEach(el => {
    el.innerHTML = createErrorIndicator(message);
  });
}

/**
 * Populate the UI with metadata
 * @param {Object} metadata - Metadata from content script
 */
function populateUI(metadata) {
  console.log('Populating UI with metadata');
  try {
    // Update priority issues section
    updatePriorityIssues(metadata);
    // Update meta tag summary in Overview tab
    updateMetaTagSummary(metadata);
    // Update meta tags in Meta Tags tab
    updateDetailedMetaTags(metadata);
    // Update previews in Social Preview tab
    updateSocialPreviews(metadata);
    // Update performance in Performance tab
    if (metadata.performance && metadata.performance.partialMetricsAvailable) {
      updatePerformanceMetrics(metadata.performance);
    }
    console.log('UI update complete');
  } catch (error) {
    console.error('Error populating UI:', error);
    showError('Error displaying data: ' + error.message);
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
    
    // Add animation effect
    document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
  });
}

/**
 * Initialize action items expansion
 */
function initActionItems() {
  const actionHeaders = document.querySelectorAll('.action-header');
  
  actionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const actionItem = header.closest('.action-item');
      const content = actionItem.querySelector('.action-content');
      const icon = header.querySelector('.action-expand svg');
      
      const isExpanded = content.style.display === 'flex';
      
      content.style.display = isExpanded ? 'none' : 'flex';
      icon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(180deg)';
    });
  });
  
  // Initialize all action items as collapsed except the first one
  const actionItems = document.querySelectorAll('.action-item');
  if (actionItems.length > 0) {
    const firstContent = actionItems[0].querySelector('.action-content');
    const firstIcon = actionItems[0].querySelector('.action-expand svg');
    
    firstContent.style.display = 'flex';
    firstIcon.style.transform = 'rotate(180deg)';
    
    // Collapse all other items
    for (let i = 1; i < actionItems.length; i++) {
      const content = actionItems[i].querySelector('.action-content');
      content.style.display = 'none';
    }
  }
}

/**
 * Initialize preview tabs functionality
 */
function initPreviewTabs() {
  const previewTabs = document.querySelectorAll('.preview-tab');
  const previewContents = document.querySelectorAll('.preview-content');
  
  previewTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and contents
      previewTabs.forEach(t => t.classList.remove('active'));
      previewContents.forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding content
      tab.classList.add('active');
      const previewId = tab.getAttribute('data-preview');
      document.getElementById(`${previewId}-preview`)?.classList.add('active');
    });
  });
}

/**
 * Initialize performance section toggle
 */
function initPerformanceToggle() {
  const performanceHeader = document.querySelector('.performance-header');
  const performanceSection = document.querySelector('.performance-section');
  
  if (performanceHeader && performanceSection) {
    performanceHeader.addEventListener('click', () => {
      performanceSection.classList.toggle('collapsed');
    });
  }
}

/**
 * Populate the meta drawer with all metadata categories
 * @param {Object} metadata - Metadata from content script
 */
function populateMetaDrawer(metadata) {
  console.log('Populating meta drawer with all metadata');
  
  // Get the container for meta groups
  const metaGroupsContainer = document.getElementById('meta-groups-container');
  if (!metaGroupsContainer || !metadata) return;
  
  // Clear existing content
  metaGroupsContainer.innerHTML = '';
  
  // Create and add meta groups
  if (metadata.basicMeta && metadata.basicMeta.length > 0) {
    addMetaGroup(metaGroupsContainer, 'Basic Meta Tags', metadata.basicMeta);
  }
  
  if (metadata.ogMeta && metadata.ogMeta.length > 0) {
    addMetaGroup(metaGroupsContainer, 'Open Graph Tags', metadata.ogMeta);
  }
  
  if (metadata.twitterMeta && metadata.twitterMeta.length > 0) {
    addMetaGroup(metaGroupsContainer, 'Twitter Card Tags', metadata.twitterMeta);
  }
  
  // Add canonical URL if available
  if (metadata.canonicalUrl) {
    const canonicalGroup = document.createElement('div');
    canonicalGroup.className = 'meta-group';
    canonicalGroup.innerHTML = `
      <h4>Canonical URL</h4>
      <div class="meta-items">
        <div class="meta-tag-row">
          <div class="meta-tag-name">canonical</div>
          <div class="meta-tag-value">${metadata.canonicalUrl}</div>
          <div class="meta-tag-status good">Defined</div>
        </div>
      </div>
    `;
    metaGroupsContainer.appendChild(canonicalGroup);
  }
  
  // Add Schema.org data if available
  if (metadata.schemaData && metadata.schemaData.length > 0) {
    const schemaGroup = document.createElement('div');
    schemaGroup.className = 'meta-group';
    
    let schemaContent = '<h4>Schema.org Data</h4><div class="meta-items">';
    
    metadata.schemaData.forEach(schema => {
      if (schema.valid && schema.data) {
        const schemaType = schema.data['@type'] || 'Unknown Type';
        schemaContent += `
          <div class="meta-tag-row">
            <div class="meta-tag-name">@type</div>
            <div class="meta-tag-value">${schemaType}</div>
            <div class="meta-tag-status good">Valid</div>
          </div>
        `;
        } else {
        schemaContent += `
          <div class="meta-tag-row">
            <div class="meta-tag-name">Schema</div>
            <div class="meta-tag-value empty">Invalid Schema</div>
            <div class="meta-tag-status error">Error</div>
          </div>
        `;
      }
    });
    
    schemaContent += '</div>';
    schemaGroup.innerHTML = schemaContent;
    metaGroupsContainer.appendChild(schemaGroup);
  }
}

/**
 * Add a meta tag group to the container
 * @param {Element} container - Container element to add the group to
 * @param {string} title - Group title
 * @param {Array} items - Array of meta items
 */
function addMetaGroup(container, title, items) {
  const group = document.createElement('div');
  group.className = 'meta-group';
  
  let content = `<h4>${title}</h4><div class="meta-items">`;
  
  items.forEach(item => {
    const value = item.value || '';
    const isEmpty = value === '';
    const valueClass = isEmpty ? 'meta-tag-value empty' : 'meta-tag-value';
    const displayValue = isEmpty ? 'Not set' : value;
    
    content += `
      <div class="meta-tag-row">
        <div class="meta-tag-name">${item.label}</div>
        <div class="${valueClass}">${displayValue}</div>
        <div class="meta-tag-status ${item.status || 'warning'}">${item.message || (isEmpty ? 'Missing' : 'Present')}</div>
      </div>
    `;
  });
  
  content += '</div>';
  group.innerHTML = content;
  container.appendChild(group);
}

/**
 * Initialize meta tags drawer functionality
 */
function initMetaDrawer() {
  const viewAllButton = document.getElementById('view-all-meta');
  const drawerCloseButton = document.querySelector('.drawer-close');
  const drawer = document.getElementById('meta-drawer');
  const overlay = document.querySelector('.overlay');
  
  if (!viewAllButton || !drawerCloseButton || !drawer || !overlay) return;
  
  viewAllButton.addEventListener('click', () => {
    // Populate the drawer with metadata when it's opened
    if (state.metadata) {
      populateMetaDrawer(state.metadata);
    }
    
    drawer.classList.add('open');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  });
  
  drawerCloseButton.addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);
  
  function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

/**
 * Initialize copy buttons functionality
 */
function initCopyButtons() {
  const copyButtons = document.querySelectorAll('.btn-copy');
  const copyAllButton = document.getElementById('copy-all-meta');
  const toast = document.getElementById('toast');
  
  if (!toast) return;
  
  copyButtons.forEach(button => {
    button.addEventListener('click', () => {
      const textToCopy = button.getAttribute('data-copy');
      
      navigator.clipboard.writeText(textToCopy)
        .then(() => showToast('Copied to clipboard!'))
        .catch(err => {
          console.error('Failed to copy:', err);
          showToast('Failed to copy!');
        });
    });
  });
  
  if (copyAllButton) {
    copyAllButton.addEventListener('click', () => {
      const metaItems = document.querySelectorAll('.meta-tag-row');
      const textToCopy = Array.from(metaItems)
        .map(item => {
          const name = item.querySelector('.meta-tag-name')?.textContent || '';
          const value = item.querySelector('.meta-tag-value')?.textContent || '';
          return value !== 'Not set' ? `${name}: ${value}` : '';
        })
        .filter(text => text)
        .join('\n');
      
      navigator.clipboard.writeText(textToCopy)
        .then(() => showToast('All meta tags copied!'))
        .catch(err => {
          console.error('Failed to copy all meta tags:', err);
          showToast('Failed to copy!');
        });
    });
  }
}

/**
 * Initialize collapsible sections
 */
function initCollapsibleSections() {
  const metaSections = [
    { title: 'Basic Meta Tags', id: 'basic-meta-section', contentId: 'basic-meta-content', icon: 'tag' },
    { title: 'Open Graph Tags', id: 'og-meta-section', contentId: 'og-meta-content', icon: 'facebook' },
    { title: 'Twitter Card Tags', id: 'twitter-meta-section', contentId: 'twitter-meta-content', icon: 'twitter' }
  ];
  
  const metaGrid = document.querySelector('.meta-grid');
  if (!metaGrid) return;
  
  // Clear existing content
  metaGrid.innerHTML = '';
  
  // Add section HTML
  metaSections.forEach(section => {
    const sectionContainer = document.createElement('div');
    sectionContainer.className = 'collapsible-section';
    sectionContainer.id = section.id;
    
    // Determine icon
    let iconSvg = '';
    switch (section.icon) {
      case 'tag':
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>`;
        break;
      case 'facebook':
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
        </svg>`;
        break;
      case 'twitter':
        iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
        </svg>`;
        break;
    }
    
    // Create section HTML
    sectionContainer.innerHTML = `
      <div class="collapsible-header" aria-expanded="true" aria-controls="${section.contentId}">
        <div class="collapsible-title">
          ${iconSvg}
          <span>${section.title}</span>
      </div>
        <svg class="collapsible-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      <div class="collapsible-content" id="${section.contentId}"></div>
    `;
    
    metaGrid.appendChild(sectionContainer);
    
    // Add click event for toggling
    const header = sectionContainer.querySelector('.collapsible-header');
    header.addEventListener('click', () => {
      sectionContainer.classList.toggle('collapsed');
      header.setAttribute('aria-expanded', !sectionContainer.classList.contains('collapsed'));
    });
  });
}

/**
 * Initialize custom styles for dynamic elements
 */
function initCustomStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .loading-indicator, .error-indicator {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      text-align: center;
    }
    
    .loading-spinner {
      width: 30px;
      height: 30px;
      border: 3px solid var(--border-light);
      border-top: 3px solid var(--primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 10px;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .loading-text, .error-text {
      color: var(--text-secondary);
      font-size: 14px;
    }
    
    .error-indicator svg {
      color: var(--status-error);
      margin-bottom: 10px;
    }
    
    .preview-image {
      height: 150px;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
    }
    
    .preview-image-placeholder {
      height: 150px;
      background-color: var(--bg-surface);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-tertiary);
      font-style: italic;
    }
    
    .metric-collecting .metric-value {
      color: var(--text-secondary);
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-normal);
    }
    
    .metric-collecting-indicator {
      width: 12px;
      height: 12px;
      border: 2px solid var(--border-light);
      border-top: 2px solid var(--primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-top: 8px;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Update priority issues section
 * @param {Object} metadata - Metadata from content script
 */
function updatePriorityIssues(metadata) {
  const issuesContainer = document.querySelector('.issues-list');
  if (!issuesContainer) return;
  
  // Clear existing issues
  issuesContainer.innerHTML = '';
  
  // Get recommendations from metadata
  const recommendations = metadata.seoScore?.recommendations || [];
  
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
  const issueBadge = document.querySelector('.section-title .badge');
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
        <button class="btn-text">${issue.impact === 'High' ? 'Fix This →' : 'Learn More →'}</button>
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
 * Update meta tag summary in Overview tab
 * @param {Object} metadata - Metadata from content script
 */
function updateMetaTagSummary(metadata) {
  const summaryGrid = document.querySelector('.summary-grid');
  if (!summaryGrid) return;
  
  // Find title and description meta tags
  const title = metadata.basicMeta?.find(tag => tag.label === 'Title') || { 
    value: '', 
    status: 'error',
    message: 'Missing title tag' 
  };
  
  const description = metadata.basicMeta?.find(tag => tag.label === 'Description') || { 
    value: '', 
    status: 'error',
    message: 'Missing description tag' 
  };
  
  // Update title card
  const titleCard = summaryGrid.querySelector('.title');
  if (titleCard) {
    const titleBadge = titleCard.querySelector('.status-badge');
    const titleContent = titleCard.querySelector('.summary-content');
    
    if (titleBadge) titleBadge.className = `status-badge ${title.status || 'error'}`;
    if (titleBadge) titleBadge.textContent = title.status === 'good' ? 'Good' : title.message;
    
    if (titleContent) {
      if (title.value) {
        titleContent.textContent = title.value;
        titleContent.classList.remove('empty');
      } else {
        titleContent.textContent = 'No title found';
        titleContent.classList.add('empty');
      }
    }
  }
  
  // Update description card
  const descriptionCard = summaryGrid.querySelector('.description');
  if (descriptionCard) {
    const descBadge = descriptionCard.querySelector('.status-badge');
    const descContent = descriptionCard.querySelector('.summary-content');
    
    if (descBadge) descBadge.className = `status-badge ${description.status || 'error'}`;
    if (descBadge) descBadge.textContent = description.status === 'good' ? 'Good' : description.message;
    
    if (descContent) {
      if (description.value) {
        descContent.textContent = description.value;
        descContent.classList.remove('empty');
      } else {
        descContent.textContent = 'No description found';
        descContent.classList.add('empty');
      }
    }
  }
}

/**
 * Update detailed meta tags in Meta Tags tab
 * @param {Object} metadata - Metadata from content script
 */
function updateDetailedMetaTags(metadata) {
  const metaTagsTab = document.getElementById('meta-tags-tab');
  if (!metaTagsTab) return;
  
  // Helper function to create meta tag table
  const createMetaTable = (tags, title) => {
    if (!tags || tags.length === 0) return null;
  
    const section = document.createElement('div');
    section.className = 'section-card';
    
    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `
      <h3 class="section-title">${title}</h3>
      <button class="btn-icon-text" data-category="${title.toLowerCase().replace(/\s+/g, '-')}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        Copy All
      </button>
  `;
  
    const table = document.createElement('div');
    table.className = 'meta-table';
    
    tags.forEach(tag => {
      const row = document.createElement('div');
      row.className = 'meta-row';
      
      const isEmpty = !tag.value || tag.value.trim() === '';
      const valueClass = isEmpty ? 'meta-cell value empty' : 'meta-cell value';
      
      row.innerHTML = `
        <div class="meta-cell name">${tag.label}</div>
        <div class="${valueClass}">${isEmpty ? 'Not set' : tag.value}</div>
        <div class="meta-cell status">
          <span class="status-badge ${tag.status || 'warning'}">${isEmpty ? 'Missing' : tag.status === 'good' ? 'Good' : 'Warning'}</span>
        </div>
      `;
      
      table.appendChild(row);
    });
    
    section.appendChild(header);
    section.appendChild(table);
    
    return section;
  };
  
  // Clear existing content except for tabs
  const existingSections = metaTagsTab.querySelectorAll('.section-card');
  existingSections.forEach(section => section.remove());
  
  // Add each meta tag category
  if (metadata.basicMeta && metadata.basicMeta.length > 0) {
    const basicSection = createMetaTable(metadata.basicMeta, 'Basic Meta Tags');
    if (basicSection) metaTagsTab.appendChild(basicSection);
  }
  
  if (metadata.ogMeta && metadata.ogMeta.length > 0) {
    const ogSection = createMetaTable(metadata.ogMeta, 'Open Graph Tags');
    if (ogSection) metaTagsTab.appendChild(ogSection);
  }
  
  if (metadata.twitterMeta && metadata.twitterMeta.length > 0) {
    const twitterSection = createMetaTable(metadata.twitterMeta, 'Twitter Card Tags');
    if (twitterSection) metaTagsTab.appendChild(twitterSection);
  }
  
  // Add canonical URL if available
  if (metadata.canonicalUrl) {
    const canonicalSection = document.createElement('div');
    canonicalSection.className = 'section-card';
    canonicalSection.innerHTML = `
      <h3 class="section-title">Canonical URL</h3>
      <div class="meta-table">
        <div class="meta-row">
          <div class="meta-cell name">canonical</div>
          <div class="meta-cell value">${metadata.canonicalUrl}</div>
          <div class="meta-cell status">
            <span class="status-badge good">Good</span>
          </div>
        </div>
      </div>
    `;
    
    metaTagsTab.appendChild(canonicalSection);
  }
  
  // Add copy functionality for the buttons
  const copyButtons = metaTagsTab.querySelectorAll('.btn-icon-text');
  copyButtons.forEach(button => {
    button.addEventListener('click', () => {
      const category = button.getAttribute('data-category');
      const table = button.closest('.section-card').querySelector('.meta-table');
      let textToCopy = '';
      
      const rows = table.querySelectorAll('.meta-row');
      rows.forEach(row => {
        const name = row.querySelector('.meta-cell.name').textContent;
        const value = row.querySelector('.meta-cell.value').textContent;
        if (value !== 'Not set') {
          textToCopy += `${name}: ${value}\n`;
        }
      });
      
      navigator.clipboard.writeText(textToCopy)
        .then(() => showToast(`Copied ${category || 'meta tags'} to clipboard!`))
        .catch(err => {
          console.error('Failed to copy:', err);
          showToast('Failed to copy meta tags');
        });
    });
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
      <div class="google-url">${hostname}</div>
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
        <div class="facebook-domain">${hostname}</div>
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
        <div class="twitter-site">${twitterSite || hostname}</div>
        <div class="twitter-title">${twitterTitle || 'No title provided'}</div>
        <div class="twitter-description">${twitterDescription || 'No description provided'}</div>
        <div class="twitter-domain">${hostname}</div>
        </div>
      </div>
    `;
  }
  
/**
 * Update performance metrics in Performance tab
 * @param {Object} metrics - Web vitals metrics
 */
function updatePerformanceMetrics(metrics) {
  const performanceTab = document.getElementById('performance-tab');
  if (!performanceTab) return;
  
  const metricsGrid = performanceTab.querySelector('.metrics-grid');
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
  
  // Add each metric
  for (const [metricName, info] of Object.entries(metricDisplayInfo)) {
    if (metrics[metricName] !== null && metrics[metricName] !== undefined) {
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
    } else {
      // Create placeholder for missing metric
      const metricCard = document.createElement('div');
      metricCard.className = 'metric-card';
      
      metricCard.innerHTML = `
        <div class="metric-header">
          <h4>${info.name}</h4>
          <span class="metric-status">Not Available</span>
        </div>
        <div class="metric-value">--</div>
        <div class="metric-label">${info.label}</div>
        <div class="metric-threshold">Target: ${info.threshold}</div>
      `;
      
      metricsGrid.appendChild(metricCard);
    }
  }
  
  // Add tip based on worst metric
  updatePerformanceTip(metrics, performanceTab);
}

/**
 * Update performance tip based on metrics
 * @param {Object} metrics - Web vitals metrics
 * @param {Element} container - Performance tab container
 */
function updatePerformanceTip(metrics, container) {
  const tipElement = container.querySelector('.performance-tip');
  if (!tipElement) return;
  
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
  }, 3000); // Hide after 3 seconds
}

/**
 * Tab Navigation Functionality
 * Handles switching between main tabs and social preview tabs
 */

// Initialize tab navigation when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
  initTabNavigation();
  initSocialTabs();
});

/**
 * Initialize main tab navigation
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
 * Initialize social preview tabs
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