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
    // Update SEO score
    updateSEOScore(metadata.seoScore);
    
    // Update meta tags
    updateMetaTags(metadata);
    
    // Update previews
    updatePreviews(metadata);
    
    // Update performance if available
    if (metadata.performance && metadata.performance.partialMetricsAvailable) {
      updatePerformance(metadata.performance);
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
 * Update SEO score display
 * @param {Object} scoreData - SEO score data
 */
function updateSEOScore(scoreData) {
  console.log('Updating SEO score');
  if (!scoreData) return;
  
  const scoreSection = document.querySelector('.score-section');
  if (!scoreSection) return;
  
  // Get score value and determine status
  const score = scoreData.score || 0;
  let status = 'warning';
  let description = 'Needs improvement';
  
  if (score >= 80) {
    status = 'good';
    description = 'Good, well optimized';
  } else if (score < 50) {
    status = 'error';
    description = 'Poor, needs urgent attention';
  }
  
  // Update HTML with score data
  scoreSection.innerHTML = `
    <div class="score-wrapper">
      <div class="score-circle">
        <svg viewBox="0 0 36 36">
          <path class="score-bg"
            d="M18 2.0845 
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke-width="3"
            stroke-dasharray="100, 100"
          />
          <path class="score-fill"
            d="M18 2.0845 
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke-width="3"
            stroke-dasharray="${score}, 100"
          />
          <text x="18" y="20.5" class="score-text">${score}</text>
        </svg>
      </div>
      <div class="score-details">
        <h2>SEO Health</h2>
        <p class="score-description">${description}</p>
        </div>
      </div>
    `;
}

/**
 * Update meta tags display
 * @param {Object} metadata - Metadata from content script
 */
function updateMetaTags(metadata) {
  console.log('Updating meta tags');
  if (!metadata.basicMeta) return;
  
  // Get the meta cards
  const metaCards = document.querySelectorAll('.meta-card');
  if (metaCards.length < 2) return;
  
  // Title card (usually first)
  updateMetaCard(
    metaCards[0], 
    metadata.basicMeta.find(tag => tag.label === 'Title')
  );
  
  // Description card (usually second)
  updateMetaCard(
    metaCards[1], 
    metadata.basicMeta.find(tag => tag.label === 'Description')
  );
}

/**
 * Update a meta card with data
 * @param {Element} card - The card element to update
 * @param {Object} data - Meta tag data
 */
function updateMetaCard(card, data) {
  if (!card || !data) return;
  
  const cardHeader = document.createElement('div');
  cardHeader.className = 'meta-card-header';
  cardHeader.innerHTML = `
    <span class="meta-card-tag">${data.label}</span>
    <span class="meta-card-status ${data.status || 'warning'}">${data.message || 'Unknown'}</span>
  `;
  
  const cardContent = document.createElement('div');
  cardContent.className = 'meta-card-content';
  
  if (!data.value) {
    cardContent.innerHTML = `
      <p class="empty-content">No ${data.label.toLowerCase()} tag found.</p>
      <button class="btn-secondary btn-small">Add ${data.label}</button>
    `;
  } else {
    cardContent.innerHTML = `<p>${data.value}</p>`;
  }
  
  // Clear the card and add the new content
  card.innerHTML = '';
  card.appendChild(cardHeader);
  card.appendChild(cardContent);
  
  // Add event listener to the "Add" button if it exists
  const addButton = cardContent.querySelector('.btn-secondary');
  if (addButton) {
    addButton.addEventListener('click', () => {
      // Show a dialog or expand a form to add the missing meta tag
      showToast(`Adding ${data.label} functionality would go here`);
    });
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
 * Update social media previews
 * @param {Object} metadata - Metadata from content script
 */
function updatePreviews(metadata) {
  console.log('Updating previews');
  if (!metadata) return;
  
  // Extract common metadata
  const title = metadata.basicMeta.find(tag => tag.label === 'Title')?.value || '';
  const description = metadata.basicMeta.find(tag => tag.label === 'Description')?.value || '';
  const ogTitle = metadata.ogMeta?.find(tag => tag.label === 'og:title')?.value || title;
  const ogDescription = metadata.ogMeta?.find(tag => tag.label === 'og:description')?.value || description;
  const ogImage = metadata.ogMeta?.find(tag => tag.label === 'og:image')?.value || '';
  const ogUrl = metadata.ogMeta?.find(tag => tag.label === 'og:url')?.value || 
                metadata.canonicalUrl || '';
  
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
      <div class="google-title">${title}</div>
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
        <div class="facebook-title">${title}</div>
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
        <div class="twitter-title">${twitterTitle}</div>
        <div class="twitter-description">${twitterDescription || 'No description provided'}</div>
        <div class="twitter-domain">${hostname}</div>
        </div>
      </div>
    `;
  }
  
/**
 * Initialize Web Vitals metrics
 */
function initializeWebVitals() {
  console.log('Initializing Web Vitals');
  
  // Set loading state
  state.loading.webVitals = true;
  state.errors.webVitals = null;
  
  // Initialize metrics object in the UI first (empty state)
  const performanceContainer = document.querySelector('.performance-section');
  if (performanceContainer) {
    const metricsRow = performanceContainer.querySelector('.metrics-row');
    if (metricsRow) {
      // Show loading state for metrics
      Array.from(metricsRow.children).forEach(metric => {
        const metricValue = metric.querySelector('.metric-value');
        if (metricValue) {
          metricValue.textContent = 'Loading...';
        }
      });
    }
  }
  
  // Request web vitals initialization from content script
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (!tabs || !tabs[0]) {
      console.error('No active tab found for web vitals');
      state.errors.webVitals = 'No active tab found for web vitals';
      state.loading.webVitals = false;
      return;
    }
    
    chrome.tabs.sendMessage(tabs[0].id, { type: 'initWebVitals' }, (response) => {
      state.loading.webVitals = false;
      
      if (chrome.runtime.lastError) {
        console.error('Error initializing web vitals:', chrome.runtime.lastError);
        state.errors.webVitals = 'Failed to initialize web vitals';
        return;
      }
      
      console.log('Web vitals initialization response:', response);
      
      if (response && response.metrics) {
        updatePerformance(response.metrics);
      } else {
        state.errors.webVitals = 'No web vitals data received';
      }
    });
  });
}

/**
 * Update performance metrics display
 * @param {Object} metrics - Web vitals metrics
 */
function updatePerformance(metrics) {
  console.log('Updating performance metrics');
  
  const performanceSection = document.querySelector('.performance-section');
  if (!performanceSection) return;
  
  const metricsRow = performanceSection.querySelector('.metrics-row');
  if (!metricsRow) return;
  
  // Define metric display info
  const metricDisplayInfo = {
    lcp: {
      index: 0,
      format: (value) => (value / 1000).toFixed(1) + 's',
      thresholds: CONFIG.metricThresholds.lcp,
      label: 'Largest Contentful Paint'
    },
    cls: {
      index: 1,
      format: (value) => value.toFixed(2),
      thresholds: CONFIG.metricThresholds.cls,
      label: 'Cumulative Layout Shift'
    },
    inp: {
      index: 2,
      format: (value) => value.toFixed(0) + 'ms',
      thresholds: CONFIG.metricThresholds.inp,
      label: 'Interaction to Next Paint'
    }
  };
  
  // Update each metric if available
  for (const [metricName, info] of Object.entries(metricDisplayInfo)) {
    if (metrics[metricName] !== null && metrics[metricName] !== undefined) {
      const metricItem = metricsRow.children[info.index];
      if (metricItem) {
        const metricValue = metricItem.querySelector('.metric-value');
        const metricLabel = metricItem.querySelector('.metric-label');
        
        if (metricValue) {
          metricValue.textContent = info.format(metrics[metricName]);
        }
        
        if (metricLabel) {
          metricLabel.textContent = info.label;
        }
        
        // Update status class
        const statusClass = getMetricStatusClass(
          metrics[metricName], 
          info.thresholds[0],  // good threshold
          info.thresholds[1],  // poor threshold
          metricName === 'cls' // lower is better for CLS
        );
        
        metricItem.className = `metric-item ${statusClass}`;
        
        // Add tooltip with threshold information
        metricItem.title = `${info.label}: ${info.format(metrics[metricName])}\n` +
          `Good: ${info.format(info.thresholds[0])}\n` +
          `Poor: ${info.format(info.thresholds[1])}`;
      }
    }
  }
  
  // Update performance tip based on the most critical issue
  updatePerformanceTip(metrics);
}

/**
 * Get the status class for a metric value
 * @param {number} value - Metric value
 * @param {number} goodThreshold - Threshold for "good" status
 * @param {number} poorThreshold - Threshold for "poor" status
 * @param {boolean} lowerIsBetter - Whether lower values are better
 * @returns {string} CSS class name
 */
function getMetricStatusClass(value, goodThreshold, poorThreshold, lowerIsBetter = true) {
  if (lowerIsBetter) {
    return value <= goodThreshold ? 'good' : 
           value <= poorThreshold ? 'warning' : 
           'poor';
      } else {
    return value >= goodThreshold ? 'good' : 
           value >= poorThreshold ? 'warning' : 
           'poor';
  }
}

/**
 * Update the performance tip based on metrics
 * @param {Object} metrics - Web vitals metrics
 */
function updatePerformanceTip(metrics) {
  const performanceTip = document.querySelector('.performance-tip');
  if (!performanceTip) return;
  
  // Find the most critical issue
  let criticalIssue = null;
  
  if (metrics.cls !== null && metrics.cls > CONFIG.metricThresholds.cls[1]) {
    criticalIssue = {
      name: 'CLS',
      message: 'Your page has significant layout shifts (CLS) that may impact user experience. Check for elements that move after loading.',
      impact: 'High'
    };
  } 
  else if (metrics.lcp !== null && metrics.lcp > CONFIG.metricThresholds.lcp[1]) {
    criticalIssue = {
      name: 'LCP',
      message: 'Your page has slow loading performance (LCP). Consider optimizing images, reducing server response time, or reducing JavaScript.',
      impact: 'High'
    };
  }
  else if (metrics.inp !== null && metrics.inp > CONFIG.metricThresholds.inp[1]) {
    criticalIssue = {
      name: 'INP',
      message: 'Your page has poor interaction performance (INP). Consider optimizing event handlers and reducing JavaScript execution time.',
      impact: 'High'
    };
  }
  else if (metrics.cls !== null && metrics.cls > CONFIG.metricThresholds.cls[0]) {
    criticalIssue = {
      name: 'CLS',
      message: 'Your page has some layout shifts (CLS) that could be improved. Consider optimizing dynamic content loading.',
      impact: 'Medium'
    };
  }
  else if (metrics.lcp !== null && metrics.lcp > CONFIG.metricThresholds.lcp[0]) {
    criticalIssue = {
      name: 'LCP',
      message: 'Your page loading performance (LCP) could be improved. Consider optimizing resource loading.',
      impact: 'Medium'
    };
  }
  else if (metrics.inp !== null && metrics.inp > CONFIG.metricThresholds.inp[0]) {
    criticalIssue = {
      name: 'INP',
      message: 'Your page interaction performance (INP) could be improved. Consider optimizing event handlers.',
      impact: 'Medium'
    };
  }
  
  // Update the tip text or hide if all metrics are good
  if (criticalIssue) {
    performanceTip.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      <div class="performance-tip-content">
        <p class="performance-tip-message">${criticalIssue.message}</p>
        <span class="performance-tip-impact ${criticalIssue.impact.toLowerCase()}">${criticalIssue.impact} Impact</span>
      </div>
    `;
    performanceTip.style.display = 'flex';
  } else {
    performanceTip.style.display = 'none';
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
  }, CONFIG.toastDuration);
} 