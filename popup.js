function displayFieldValue(value) {
  if (Array.isArray(value)) {
    return value.map(displayFieldValue).join(', ');
  } else if (value && typeof value === 'object') {
    return value.name || '';
  } else {
    return value;
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
  
  // Add each section
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
    
    // Create header
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

document.addEventListener('DOMContentLoaded', function() {
  // Tab Switching Logic
  const tabs = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and tab panes
      tabs.forEach(t => t.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding tab pane
      tab.classList.add('active');
      const tabId = tab.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });
  
  // Dark Mode Toggle
  const themeToggle = document.getElementById('theme-toggle');
  const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  
  // Set initial theme based on user preference or localStorage
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    document.body.setAttribute('data-theme', savedTheme);
  } else if (prefersDarkScheme.matches) {
    document.body.setAttribute('data-theme', 'dark');
  } else {
    document.body.setAttribute('data-theme', 'light');
  }
  
  themeToggle.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Optional: Add animation effect
    document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
  });
  
  // Initialize copy buttons
  attachCopyButtonListeners();
  
  // Initialize collapsible sections
  initCollapsibleSections();
  
  // Fetch and populate content
  fetchMetaData();
});

// Function to fetch metadata from the current page
function fetchMetaData() {
  // Get the active tab
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const activeTab = tabs[0];
    
    // First inject the content script
    chrome.scripting.executeScript({
      target: {tabId: activeTab.id},
      files: ['content.js']
    }, () => {
      // Then execute the function to get metadata
      chrome.scripting.executeScript({
        target: {tabId: activeTab.id},
        function: getPageMetadata
      }, (results) => {
        if (chrome.runtime.lastError) {
          console.error('Error executing script:', chrome.runtime.lastError);
          return;
        }
        
        if (results && results[0]) {
          const metadata = results[0].result;
          console.log('Fetched metadata:', metadata); // Debug log
          populateMetadata(metadata);
        } else {
          console.error('No results returned from content script');
        }
      });
    });
  });
}

// Function to extract metadata from the page
function getPageMetadata() {
  console.log('getPageMetadata executing...'); // Debug log
  
  const metadata = {
    seoSummary: [],
    basicMeta: [],
    ogMeta: [],
    twitterMeta: [],
    canonicalUrl: '',
    schemaData: []
  };
  
  try {
    // Get basic meta tags
    const title = document.querySelector('title')?.textContent || '';
    const description = document.querySelector('meta[name="description"]')?.content || '';
    const keywords = document.querySelector('meta[name="keywords"]')?.content || '';
    const viewport = document.querySelector('meta[name="viewport"]')?.content || '';
    const robots = document.querySelector('meta[name="robots"]')?.content || '';
    
    console.log('Basic meta tags found:', { title, description, keywords, viewport, robots }); // Debug log
    
    // Validate and add basic meta tags
    metadata.basicMeta = [
      { 
        label: 'Title', 
        value: title,
        status: title.length >= 30 && title.length <= 60 ? 'good' : 'warning',
        message: title.length < 30 ? 'Too short' : title.length > 60 ? 'Too long' : 'Good length'
      },
      { 
        label: 'Description', 
        value: description,
        status: description.length >= 120 && description.length <= 160 ? 'good' : 'warning',
        message: description.length < 120 ? 'Too short' : description.length > 160 ? 'Too long' : 'Good length'
      },
      { 
        label: 'Keywords', 
        value: keywords,
        status: keywords ? 'good' : 'warning',
        message: keywords ? 'Well defined' : 'Missing'
      },
      { 
        label: 'Viewport', 
        value: viewport,
        status: viewport ? 'good' : 'error',
        message: viewport ? 'Properly configured' : 'Missing'
      },
      { 
        label: 'Robots', 
        value: robots,
        status: robots ? 'good' : 'warning',
        message: robots ? 'Properly set' : 'Not specified'
      }
    ];
    
    // Get Open Graph tags
    const ogTags = document.querySelectorAll('meta[property^="og:"]');
    const requiredOgTags = ['og:title', 'og:description', 'og:type', 'og:url', 'og:image', 'og:site_name'];
    
    metadata.ogMeta = requiredOgTags.map(tag => {
      const element = document.querySelector(`meta[property="${tag}"]`);
      const value = element?.content || 'Missing';
      const status = value === 'Missing' ? 'error' : 'good';
      const message = value === 'Missing' ? 'Required tag missing' : 'Present';
      
      return {
        label: tag,
        value: value,
        status: status,
        message: message
      };
    });
    
    // Get Twitter Card tags
    const twitterTags = document.querySelectorAll('meta[name^="twitter:"]');
    const requiredTwitterTags = ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:site'];
    
    metadata.twitterMeta = requiredTwitterTags.map(tag => {
      const element = document.querySelector(`meta[name="${tag}"]`);
      const value = element?.content || 'Missing';
      const status = value === 'Missing' ? 'error' : 'good';
      const message = value === 'Missing' ? 'Required tag missing' : 'Present';
      
      return {
        label: tag,
        value: value,
        status: status,
        message: message
      };
    });
    
    // Get canonical URL
    const canonical = document.querySelector('link[rel="canonical"]')?.href || '';
    metadata.canonicalUrl = canonical;
    
    // Get Schema.org data
    const schemaScripts = document.querySelectorAll('script[type="application/ld+json"]');
    let schemas = [];
    
    schemaScripts.forEach(script => {
      let json;
      let valid = true;
      try {
        json = JSON.parse(script.textContent);
      } catch (e) {
        valid = false;
        json = null;
      }
      
      if (valid && json) {
        // Recursively find all objects with @type
        const found = findSchemaTypes(json);
        if (found.length > 0) {
          schemas.push(...found);
        } else {
          schemas.push({ valid: true, data: json, hasType: false });
        }
      } else {
        schemas.push({ valid: false, data: null, hasType: false });
      }
    });
    
    // Filter for objects that directly describe the current page
    const pageSchemas = schemas.filter(obj => isPageSchema(obj.data, window.location.href));
    
    // Prefer the most specific type
    const specificity = [
      'NewsArticle', 'Article', 'BlogPosting', 'FAQPage', 'AboutPage', 'ContactPage',
      'ProfilePage', 'SearchResultsPage', 'CollectionPage', 'CheckoutPage', 'WebPage'
    ];
    
    let best = null;
    let bestScore = specificity.length;
    
    for (const obj of pageSchemas) {
      const types = Array.isArray(obj.data['@type']) ? obj.data['@type'] : [obj.data['@type']];
      for (const type of types) {
        const score = specificity.indexOf(type);
        if (score !== -1 && score < bestScore) {
          best = obj;
          bestScore = score;
        }
      }
    }
    
    metadata.schemaData = best ? [best] : [];
    
    // Generate SEO summary
    metadata.seoSummary = [
      {
        label: 'Title',
        value: title ? `Title is ${title.length} characters` : 'Title is missing',
        status: title.length >= 30 && title.length <= 60 ? 'good' : 'warning'
      },
      {
        label: 'Description',
        value: description ? `Description is ${description.length} characters` : 'Description is missing',
        status: description.length >= 120 && description.length <= 160 ? 'good' : 'warning'
      },
      {
        label: 'Canonical URL',
        value: canonical ? 'Canonical URL is properly set' : 'Canonical URL is missing',
        status: canonical ? 'good' : 'error'
      },
      {
        label: 'Open Graph Tags',
        value: `${metadata.ogMeta.filter(tag => tag.status === 'good').length}/${requiredOgTags.length} Open Graph tags present`,
        status: metadata.ogMeta.every(tag => tag.status === 'good') ? 'good' : 'warning'
      },
      {
        label: 'Twitter Card Tags',
        value: `${metadata.twitterMeta.filter(tag => tag.status === 'good').length}/${requiredTwitterTags.length} Twitter Card tags present`,
        status: metadata.twitterMeta.every(tag => tag.status === 'good') ? 'good' : 'warning'
      },
      {
        label: 'Schema Data',
        value: metadata.schemaData.length > 0 
          ? `Found ${metadata.schemaData.length} schema${metadata.schemaData.length > 1 ? 's' : ''} (${metadata.schemaData.map(s => s.data['@type']).join(', ')})`
          : 'No Schema.org data found',
        status: metadata.schemaData.length > 0 && metadata.schemaData.every(s => s.valid) ? 'good' : 'warning'
      }
    ];
    
    console.log('Metadata collected:', metadata); // Debug log
    return metadata;
  } catch (error) {
    console.error('Error in getPageMetadata:', error);
    return metadata;
  }
}

// Helper function to find schema types recursively
function findSchemaTypes(obj, schemas = []) {
  if (Array.isArray(obj)) {
    obj.forEach(item => findSchemaTypes(item, schemas));
  } else if (obj && typeof obj === 'object') {
    if (obj['@type']) {
      schemas.push({ valid: true, data: obj, hasType: true });
    }
    Object.values(obj).forEach(val => findSchemaTypes(val, schemas));
  }
  return schemas;
}

// Helper function to check if schema is relevant to current page
function isPageSchema(obj, currentUrl) {
  if (!obj || !obj['@type']) return false;
  
  const types = Array.isArray(obj['@type']) ? obj['@type'] : [obj['@type']];
  const pageTypes = [
    'WebPage', 'AboutPage', 'Article', 'NewsArticle', 'BlogPosting', 'FAQPage',
    'ContactPage', 'ProfilePage', 'SearchResultsPage', 'CollectionPage', 'CheckoutPage'
  ];
  
  const hasPageType = types.some(type => pageTypes.includes(type));
  if (!hasPageType) return false;
  
  const normalize = url => url ? url.replace(/[#?].*$/, '').replace(/\/+$/, '') : '';
  const objUrl = normalize(obj.url || obj['@id'] || '');
  const pageUrl = normalize(currentUrl);
  
  return objUrl && (objUrl === pageUrl);
}

/**
 * Function to create separated meta tag cards with improved status handling
 */
function createSeparatedMetaItem(item) {
  const statusClass = `status-${item.status}`;
  const statusLabel = getStatusLabel(item.status);
  
  return `
    <div class="meta-tag-card">
      <div class="meta-tag-header">
        <span class="meta-tag-name">${item.label}</span>
        <span class="status-indicator status-${item.status}-badge">${statusLabel}</span>
      </div>
      <div class="meta-tag-content">
        <div class="meta-tag-value">${item.value}</div>
        ${item.message ? `<div class="meta-tag-message">${item.message}</div>` : ''}
      </div>
    </div>
  `;
}

/**
 * Function to populate meta items with separated cards
 * Includes error handling and empty state
 */
function populateMetaItemsWithSeparatedCards(elementId, items) {
  const container = document.getElementById(elementId);
  if (!container) return;
  
  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="meta-tag-card">
        <div class="meta-tag-header">
          <span class="meta-tag-name">No Meta Tags Found</span>
          <span class="status-indicator status-warning-badge">Warning</span>
        </div>
        <div class="meta-tag-content">
          <div class="meta-tag-value">No meta tags were found on this page.</div>
          <div class="meta-tag-message">Consider adding relevant meta tags to improve SEO and social sharing.</div>
        </div>
      </div>
    `;
    return;
  }
  
  let html = '';
  
  items.forEach(item => {
    if (item && typeof item === 'object') {
      html += createSeparatedMetaItem(item);
    }
  });
  
  container.innerHTML = html;
}

/**
 * Function to populate a detailed SEO health summary with collapsible categories
 */
function populateDetailedSEOSummary(metadata) {
  const seoSummaryContent = document.getElementById('seo-summary-content');
  if (!seoSummaryContent) return;
  
  // Count issues by type
  let errorCount = 0;
  let warningCount = 0;
  let goodCount = 0;
  
  // Collect issues by category
  let issuesByCategory = {
    'Basic Meta': [],
    'Open Graph': [],
    'Twitter Card': [],
    'Other': []
  };
  
  // Check Title
  const title = metadata.basicMeta.find(tag => tag.label === 'Title');
  if (title) {
    if (title.status === 'good') {
      goodCount++;
    } else {
      title.status === 'error' ? errorCount++ : warningCount++;
      issuesByCategory['Basic Meta'].push({
        label: 'Title',
        value: title.value,
        status: title.status,
        message: title.value.length < 30 ? 'Too short (min 30 chars)' : 'Too long (max 60 chars)',
        currentLength: title.value.length
      });
    }
  }
  
  // Check Description
  const description = metadata.basicMeta.find(tag => tag.label === 'Description');
  if (description) {
    if (description.status === 'good') {
      goodCount++;
    } else {
      description.status === 'error' ? errorCount++ : warningCount++;
      issuesByCategory['Basic Meta'].push({
        label: 'Description',
        value: description.value,
        status: description.status,
        message: description.value.length < 120 ? 'Too short (min 120 chars)' : 'Too long (max 160 chars)',
        currentLength: description.value.length
      });
    }
  }
  
  // Check Keywords
  const keywords = metadata.basicMeta.find(tag => tag.label === 'Keywords');
  if (keywords && keywords.status !== 'good') {
    keywords.status === 'error' ? errorCount++ : warningCount++;
    issuesByCategory['Basic Meta'].push({
      label: 'Keywords',
      status: keywords.status,
      message: 'Missing or incomplete'
    });
  } else if (keywords) {
    goodCount++;
  }
  
  // Check Viewport
  const viewport = metadata.basicMeta.find(tag => tag.label === 'Viewport');
  if (viewport && viewport.status !== 'good') {
    viewport.status === 'error' ? errorCount++ : warningCount++;
    issuesByCategory['Basic Meta'].push({
      label: 'Viewport',
      status: viewport.status,
      message: 'Missing or improperly configured'
    });
  } else if (viewport) {
    goodCount++;
  }
  
  // Check Robots
  const robots = metadata.basicMeta.find(tag => tag.label === 'Robots');
  if (robots && robots.status !== 'good') {
    robots.status === 'error' ? errorCount++ : warningCount++;
    issuesByCategory['Basic Meta'].push({
      label: 'Robots',
      status: robots.status,
      message: 'Missing or improperly configured'
    });
  } else if (robots) {
    goodCount++;
  }
  
  // Check Canonical
  if (!metadata.canonicalUrl) {
    errorCount++;
    issuesByCategory['Other'].push({
      label: 'Canonical URL',
      status: 'error',
      message: 'Missing canonical URL'
    });
  } else {
    goodCount++;
  }
  
  // Check Open Graph tags
  metadata.ogMeta.forEach(tag => {
    if (tag.status === 'good') {
      goodCount++;
    } else {
      tag.status === 'error' ? errorCount++ : warningCount++;
      issuesByCategory['Open Graph'].push({
        label: tag.label,
        value: tag.value !== 'Missing' ? tag.value : '',
        status: tag.status,
        message: tag.status === 'error' ? 'Missing required tag' : tag.message || 'Issue detected'
      });
    }
  });
  
  // Check Twitter Card tags
  metadata.twitterMeta.forEach(tag => {
    if (tag.status === 'good') {
      goodCount++;
    } else {
      tag.status === 'error' ? errorCount++ : warningCount++;
      issuesByCategory['Twitter Card'].push({
        label: tag.label,
        value: tag.value !== 'Missing' ? tag.value : '',
        status: tag.status,
        message: tag.status === 'error' ? 'Missing required tag' : tag.message || 'Issue detected'
      });
    }
  });
  
  // Check Schema
  if (!metadata.schemaData || metadata.schemaData.length === 0) {
    warningCount++;
    issuesByCategory['Other'].push({
      label: 'Schema.org Data',
      status: 'warning',
      message: 'No structured data found'
    });
  } else if (!metadata.schemaData[0].valid) {
    errorCount++;
    issuesByCategory['Other'].push({
      label: 'Schema.org Data',
      status: 'error',
      message: 'Invalid schema structure'
    });
  } else {
    goodCount++;
  }
  
  // Calculate SEO score
  const totalChecks = goodCount + warningCount + errorCount;
  const seoScore = Math.round((goodCount / totalChecks) * 100);
  
  // Determine overall status
  let overallStatus = 'good';
  if (errorCount > 0) {
    overallStatus = 'error';
  } else if (warningCount > 0) {
    overallStatus = 'warning';
  }
  
  // Create HTML for the header
  let html = `
    <div class="seo-summary-header">
      <div class="seo-summary-score">
        <span class="seo-summary-score-value status-${overallStatus}">${seoScore}</span>
        <span class="seo-summary-score-label">/ 100</span>
      </div>
      <div class="seo-summary-counts">
        <span class="status-good-badge">${goodCount} Good</span>
        ${warningCount > 0 ? `<span class="status-warning-badge">${warningCount} Warnings</span>` : ''}
        ${errorCount > 0 ? `<span class="status-error-badge">${errorCount} Errors</span>` : ''}
      </div>
    </div>
  `;
  
  // If there are issues, display them by category with accordion behavior
  const hasIssues = Object.values(issuesByCategory).some(issues => issues.length > 0);
  
  if (hasIssues) {
    // Add each category that has issues
    let isFirst = true; // Track if it's the first category with issues
    
    Object.entries(issuesByCategory).forEach(([category, issues]) => {
      if (issues.length > 0) {
        // Determine if this category should be expanded (only first one)
        const isExpanded = isFirst;
        
        html += `
          <div class="seo-issues-category ${isExpanded ? 'expanded' : 'collapsed'}" data-category="${category}">
            <div class="seo-category-header" role="button" tabindex="0">
              <div class="seo-category-title">
                <svg class="seo-category-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
                ${category} Issues
              </div>
              <div class="seo-category-count">${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}</div>
            </div>
            <div class="seo-issues-list">
        `;
        
        // Add each issue in this category
        issues.forEach(issue => {
          const statusClass = `status-${issue.status}`;
          const statusBadge = issue.status === 'error' ? 'Error' : 'Warning';
          
          html += `
            <div class="seo-issue-item ${statusClass}">
              <div class="seo-issue-header">
                <span class="seo-issue-label">${issue.label}</span>
                <span class="status-${issue.status}-badge">${statusBadge}</span>
              </div>
              ${issue.currentLength !== undefined ? 
                `<div class="seo-issue-detail">Current length: ${issue.currentLength} characters</div>` : ''}
              <div class="seo-issue-message">${issue.message}</div>
            </div>
          `;
        });
        
        html += `
            </div>
          </div>
        `;
        
        // Only the first category with issues should be expanded
        if (isFirst) {
          isFirst = false;
        }
      }
    });
  } else {
    // Show success message
    html += `
      <div class="seo-perfect">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--status-good)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <div>
          <div class="seo-perfect-title">Perfect SEO</div>
          <div class="seo-perfect-message">All SEO checks passed! Your page is well-optimized.</div>
        </div>
      </div>
    `;
  }
  
  seoSummaryContent.innerHTML = html;
  
  // Add click handlers for category headers
  const categoryHeaders = seoSummaryContent.querySelectorAll('.seo-category-header');
  categoryHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const category = header.closest('.seo-issues-category');
      const isExpanded = category.classList.contains('expanded');
      
      // First, collapse all categories
      document.querySelectorAll('.seo-issues-category').forEach(cat => {
        cat.classList.remove('expanded');
        cat.classList.add('collapsed');
      });
      
      // If clicking on a collapsed category, expand it
      // If clicking on an already expanded category, it remains collapsed
      if (!isExpanded) {
        category.classList.remove('collapsed');
        category.classList.add('expanded');
      }
    });
    
    // Add keyboard support
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        header.click();
      }
    });
  });
}

/**
 * Main function to populate all metadata sections with improved error handling and UI
 */
function populateMetadata(metadata) {
  try {
    // Populate SEO Summary
    populateDetailedSEOSummary(metadata);
    
    // Populate Meta Items
    populateMetaItemsWithSeparatedCards('basic-meta-content', metadata.basicMeta);
    populateMetaItemsWithSeparatedCards('og-meta-content', metadata.ogMeta);
    populateMetaItemsWithSeparatedCards('twitter-meta-content', metadata.twitterMeta);
    
    // Populate Canonical URL
    populateCanonicalUrl(metadata);
    
    // Populate Schema
    populateSchemaWithSeparatedCards(metadata);
    
    // Populate Social Media Previews
    populateComprehensivePreviews(metadata);
    
    // Reattach copy button listeners after a short delay
    setTimeout(() => {
      attachCopyButtonListeners();
    }, 100);
  } catch (error) {
    console.error('Error populating metadata:', error);
    showToast('Error loading metadata. Please try again.');
  }
}

// Helper function to get status label
function getStatusLabel(status) {
  switch (status) {
    case 'good':
      return '✓ Good';
    case 'warning':
      return '⚠ Warning';
    case 'error':
      return '✕ Error';
    default:
      return status;
  }
}

// Helper function to attach copy button listeners
function attachCopyButtonListeners() {
  const copyButtons = document.querySelectorAll('.btn-secondary, .btn-icon');
  const toast = document.getElementById('toast');
  
  copyButtons.forEach(button => {
    button.addEventListener('click', () => {
      let textToCopy = '';
      const parentHeader = button.closest('.card-header');
      
      if (parentHeader) {
        const contentId = parentHeader.nextElementSibling.querySelector('div').id;
        const contentElement = document.getElementById(contentId);
        if (contentElement) {
          textToCopy = contentElement.textContent;
        }
      } else if (button.id === 'copy-all') {
        const activePane = document.querySelector('.tab-pane.active');
        if (activePane) {
          textToCopy = activePane.textContent;
        }
      }
      
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy).then(() => {
          if (toast) {
            toast.classList.add('show');
            setTimeout(() => {
              toast.classList.remove('show');
            }, 3000);
          }
        }).catch(err => {
          console.error('Failed to copy text: ', err);
        });
      }
    });
  });
}

/**
 * Enhanced function to populate all social media previews
 */
function populateComprehensivePreviews(metadata) {
  const ogTitle = metadata.ogMeta.find(tag => tag.label === 'og:title')?.value || 
                  metadata.basicMeta.find(tag => tag.label === 'Title')?.value || '';
  const ogDescription = metadata.ogMeta.find(tag => tag.label === 'og:description')?.value || 
                         metadata.basicMeta.find(tag => tag.label === 'Description')?.value || '';
  const ogImage = metadata.ogMeta.find(tag => tag.label === 'og:image')?.value || '';
  const ogUrl = metadata.ogMeta.find(tag => tag.label === 'og:url')?.value || 
                metadata.canonicalUrl || '';
  
  // Extract hostname safely
  let hostname = '';
  try {
    hostname = ogUrl ? new URL(ogUrl).hostname : 'example.com';
  } catch (e) {
    hostname = ogUrl || 'example.com';
  }

  // Create HTML for preview grid
  const previewGrid = document.getElementById('previews');
  if (!previewGrid) return;
  
  previewGrid.innerHTML = `
    <div class="preview-grid">
      <!-- Facebook Preview -->
      <div class="preview-card">
        <div class="preview-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
          </svg>
          Facebook
        </div>
        <div class="preview-content">
          <div id="facebook-preview"></div>
        </div>
      </div>
      
      <!-- Twitter Preview -->
      <div class="preview-card">
        <div class="preview-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
          </svg>
          Twitter
        </div>
        <div class="preview-content">
          <div id="twitter-preview"></div>
        </div>
      </div>
      
      <!-- LinkedIn Preview -->
      <div class="preview-card">
        <div class="preview-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
            <rect x="2" y="9" width="4" height="12"></rect>
            <circle cx="4" cy="4" r="2"></circle>
          </svg>
          LinkedIn
        </div>
        <div class="preview-content">
          <div id="linkedin-preview"></div>
        </div>
      </div>
      
      <!-- Pinterest Preview -->
      <div class="preview-card">
        <div class="preview-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a10 10 0 0 0-3.16 19.5c-.07-.63-.13-1.6.03-2.3.14-.6.92-3.8.92-3.8s-.23-.48-.23-1.2c0-1.1.64-1.93 1.44-1.93.68 0 1 .5 1 1.1 0 .67-.43 1.67-.65 2.6-.18.77.38 1.4 1.15 1.4 1.38 0 2.43-1.45 2.43-3.56 0-1.86-1.33-3.16-3.23-3.16a3.38 3.38 0 0 0-3.54 3.45c0 .67.27 1.4.61 1.82.07.08.08.15.06.24l-.24.96c-.03.14-.14.18-.26.13-1-.45-1.6-1.9-1.6-3.05 0-2.45 1.78-4.7 5.1-4.7 2.67 0 4.76 1.9 4.76 4.46 0 2.66-1.66 4.82-3.93 4.82-.77 0-1.5-.4-1.74-.85l-.47 1.8c-.18.64-.5 1.44-.8 1.96A10 10 0 1 0 12 2z"></path>
          </svg>
          Pinterest
        </div>
        <div class="preview-content">
          <div id="pinterest-preview"></div>
        </div>
      </div>
      
      <!-- Instagram Preview -->
      <div class="preview-card">
        <div class="preview-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
            <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
          </svg>
          Instagram
        </div>
        <div class="preview-content">
          <div id="instagram-preview"></div>
        </div>
      </div>
      
      <!-- Google Search Preview -->
      <div class="preview-card">
        <div class="preview-header">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          Google Search
        </div>
        <div class="preview-content">
          <div id="google-preview"></div>
        </div>
      </div>
    </div>
  `;
  
  // Now populate each platform's preview
  
  // Facebook Preview
  const facebookPreview = document.getElementById('facebook-preview');
  if (facebookPreview) {
    facebookPreview.innerHTML = `
      <div class="preview-card-inner">
        ${ogImage ? `
          <div class="preview-image" style="background-image: url('${ogImage}')"></div>
        ` : `
          <div class="preview-image-placeholder">No image available</div>
        `}
        <div class="preview-content-wrapper">
          <div class="preview-hostname">${hostname}</div>
          <div class="preview-title">${ogTitle || 'No title available'}</div>
          <div class="preview-description">${ogDescription || 'No description available'}</div>
        </div>
      </div>
    `;
  }
  
  // Twitter Preview
  const twitterPreview = document.getElementById('twitter-preview');
  if (twitterPreview) {
    const twitterTitle = metadata.twitterMeta.find(tag => tag.label === 'twitter:title')?.value || ogTitle;
    const twitterDescription = metadata.twitterMeta.find(tag => tag.label === 'twitter:description')?.value || ogDescription;
    const twitterImage = metadata.twitterMeta.find(tag => tag.label === 'twitter:image')?.value || ogImage;
    
    twitterPreview.innerHTML = `
      <div class="preview-card-inner">
        ${twitterImage ? `
          <div class="preview-image" style="background-image: url('${twitterImage}')"></div>
        ` : `
          <div class="preview-image-placeholder">No image available</div>
        `}
        <div class="preview-content-wrapper">
          <div class="preview-title">${twitterTitle || 'No title available'}</div>
          <div class="preview-description">${twitterDescription || 'No description available'}</div>
          <div class="preview-hostname">${hostname}</div>
        </div>
      </div>
    `;
  }
  
  // LinkedIn Preview
  const linkedinPreview = document.getElementById('linkedin-preview');
  if (linkedinPreview) {
    linkedinPreview.innerHTML = `
      <div class="preview-card-inner">
        ${ogImage ? `
          <div class="preview-image" style="background-image: url('${ogImage}')"></div>
        ` : `
          <div class="preview-image-placeholder">No image available</div>
        `}
        <div class="preview-content-wrapper">
          <div class="preview-hostname">${hostname}</div>
          <div class="preview-title">${ogTitle || 'No title available'}</div>
          <div class="preview-description">${ogDescription || 'No description available'}</div>
        </div>
      </div>
    `;
  }
  
  // Pinterest Preview
  const pinterestPreview = document.getElementById('pinterest-preview');
  if (pinterestPreview) {
    pinterestPreview.innerHTML = `
      <div class="preview-card-inner pinterest-card">
        ${ogImage ? `
          <div class="preview-image pinterest-image" style="background-image: url('${ogImage}')"></div>
        ` : `
          <div class="preview-image-placeholder">No image available</div>
        `}
        <div class="preview-content-wrapper">
          <div class="preview-title">${ogTitle || 'No title available'}</div>
          <div class="preview-hostname">${hostname}</div>
        </div>
      </div>
    `;
  }
  
  // Instagram Preview
  const instagramPreview = document.getElementById('instagram-preview');
  if (instagramPreview) {
    instagramPreview.innerHTML = `
      <div class="preview-card-inner instagram-card">
        ${ogImage ? `
          <div class="preview-image instagram-image" style="background-image: url('${ogImage}')"></div>
        ` : `
          <div class="preview-image-placeholder">No image available</div>
        `}
        <div class="preview-content-wrapper">
          <div class="preview-hostname">@${hostname.split('.')[0]}</div>
          <div class="preview-description" style="max-height: 2.8em;">${ogDescription ? ogDescription.substring(0, 120) + (ogDescription.length > 120 ? '...' : '') : 'No description available'}</div>
        </div>
      </div>
    `;
  }
  
  // Google Search Preview
  const googlePreview = document.getElementById('google-preview');
  if (googlePreview) {
    googlePreview.innerHTML = `
      <div class="preview-card-inner google-card">
        <div class="preview-content-wrapper">
          <div class="preview-hostname google-url">${hostname}${ogUrl.replace(/^https?:\/\/[^\/]+/, '') || '/'}</div>
          <div class="preview-title google-title">${ogTitle || 'No title available'}</div>
          <div class="preview-description google-snippet">${ogDescription || 'No description available'}</div>
        </div>
      </div>
    `;
  }
}

function createMetaItem(name, value, validation) {
  const div = document.createElement('div');
  div.className = 'meta-item';

  const labelDiv = document.createElement('div');
  labelDiv.className = 'meta-label';

  const nameSpan = document.createElement('span');
  nameSpan.textContent = name;

  const statusSpan = document.createElement('span');
  let isMissing = value === undefined || value === null || value === '' || value === 'Not set';
  let statusClass = !validation.valid || isMissing
    ? (validation.message === 'Missing' || isMissing ? 'status-error' : 'status-warning')
    : 'status-success';
  statusSpan.className = `meta-status ${statusClass}`;

  const statusIcon = document.createElement('span');
  statusIcon.className = 'status-icon';
  statusIcon.textContent = !validation.valid || isMissing
    ? (validation.message === 'Missing' || isMissing ? '❌' : '⚠️')
    : '✅';

  statusSpan.appendChild(statusIcon);
  statusSpan.appendChild(document.createTextNode(validation.message));

  labelDiv.appendChild(nameSpan);
  labelDiv.appendChild(statusSpan);

  const valueDiv = document.createElement('div');
  valueDiv.className = 'meta-value';
  valueDiv.textContent = value || 'Not set';

  div.appendChild(labelDiv);
  div.appendChild(valueDiv);

  return div;
}

/**
 * Function to create schema property with separated header and content
 * Includes improved handling of different value types and expandable content
 */
function createSeparatedSchemaProperty(key, value) {
  const propertyElement = document.createElement('div');
  propertyElement.className = 'schema-property-card';
  
  // Create header with property name
  const headerElement = document.createElement('div');
  headerElement.className = 'schema-property-header';
  headerElement.innerHTML = `<span class="schema-property-name">${key}</span>`;
  
  // Handle button for expandable content if needed
  if (typeof value === 'object' && value !== null) {
    const expandButton = document.createElement('button');
    expandButton.className = 'schema-expand-btn';
    expandButton.innerHTML = 'View Content';
    headerElement.appendChild(expandButton);
  }
  
  propertyElement.appendChild(headerElement);
  
  // Create content section
  const contentElement = document.createElement('div');
  contentElement.className = 'schema-property-content';
  
  // Handle different value types
  if (value === null || value === undefined) {
    contentElement.innerHTML = '<div class="schema-property-value">null</div>';
  } 
  else if (Array.isArray(value)) {
    if (value.length === 0) {
      contentElement.innerHTML = '<div class="schema-property-value">[ ]</div>';
    } 
    else if (typeof value[0] !== 'object' || value[0] === null) {
      // Simple array
      contentElement.innerHTML = `<div class="schema-property-value">${JSON.stringify(value)}</div>`;
    } 
    else {
      // Array of objects - make collapsible
      contentElement.innerHTML = `<div class="schema-property-value">Array with ${value.length} items</div>`;
      
      // Add expandable content (hidden by default)
      const nestedContent = document.createElement('div');
      nestedContent.className = 'schema-expanded-content';
      nestedContent.style.display = 'none';
      
      // Add a few sample items
      const displayCount = Math.min(value.length, 3);
      for (let i = 0; i < displayCount; i++) {
        const item = value[i];
        const itemEl = document.createElement('div');
        itemEl.className = 'schema-property-nested';
        
        if (typeof item === 'object' && item !== null) {
          itemEl.textContent = `[${i}]: Object with ${Object.keys(item).length} properties`;
        } else {
          itemEl.textContent = `[${i}]: ${JSON.stringify(item)}`;
        }
        
        nestedContent.appendChild(itemEl);
      }
      
      // Show more indicator if needed
      if (value.length > displayCount) {
        const moreEl = document.createElement('div');
        moreEl.className = 'schema-property-more';
        moreEl.textContent = `...and ${value.length - displayCount} more items`;
        nestedContent.appendChild(moreEl);
      }
      
      contentElement.appendChild(nestedContent);
      
      // Add expand/collapse functionality
      const expandBtn = headerElement.querySelector('.schema-expand-btn');
      if (expandBtn) {
        expandBtn.addEventListener('click', () => {
          const isHidden = nestedContent.style.display === 'none';
          nestedContent.style.display = isHidden ? 'block' : 'none';
          expandBtn.textContent = isHidden ? 'Hide Content' : 'View Content';
        });
      }
    }
  } 
  else if (typeof value === 'object') {
    // Object
    contentElement.innerHTML = `<div class="schema-property-value">Object with ${Object.keys(value).length} properties</div>`;
    
    // Create expandable content (hidden by default)
    const nestedContent = document.createElement('div');
    nestedContent.className = 'schema-expanded-content';
    nestedContent.style.display = 'none';
    
    // Show a few properties
    const keys = Object.keys(value).slice(0, 3);
    keys.forEach(key => {
      const propEl = document.createElement('div');
      propEl.className = 'schema-property-nested';
      
      if (typeof value[key] === 'object' && value[key] !== null) {
        propEl.textContent = `${key}: ${Array.isArray(value[key]) ? 'Array' : 'Object'}`;
      } else {
        propEl.textContent = `${key}: ${JSON.stringify(value[key])}`;
      }
      
      nestedContent.appendChild(propEl);
    });
    
    // Show more indicator if needed
    if (Object.keys(value).length > keys.length) {
      const moreEl = document.createElement('div');
      moreEl.className = 'schema-property-more';
      moreEl.textContent = `...and ${Object.keys(value).length - keys.length} more properties`;
      nestedContent.appendChild(moreEl);
    }
    
    contentElement.appendChild(nestedContent);
    
    // Add expand/collapse functionality
    const expandBtn = headerElement.querySelector('.schema-expand-btn');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        const isHidden = nestedContent.style.display === 'none';
        nestedContent.style.display = isHidden ? 'block' : 'none';
        expandBtn.textContent = isHidden ? 'Hide Content' : 'View Content';
      });
    }
  } 
  else {
    // Simple value
    if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
      contentElement.innerHTML = `<div class="schema-property-value"><a href="${value}" target="_blank" rel="noopener noreferrer">${value}</a></div>`;
    } else {
      contentElement.innerHTML = `<div class="schema-property-value">${JSON.stringify(value)}</div>`;
    }
  }
  
  propertyElement.appendChild(contentElement);
  return propertyElement;
}

/**
 * Function to populate schema content with separated cards
 * Includes improved property sorting and pagination
 */
function populateSchemaWithSeparatedCards(metadata) {
  const schemaContent = document.getElementById('schema-content');
  if (!schemaContent || !metadata.schemaData || metadata.schemaData.length === 0) {
    schemaContent.innerHTML = `
      <div class="schema-empty">
        <svg class="schema-empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
        <h3 class="schema-empty-title">No Schema.org Data Found</h3>
        <p class="schema-empty-message">
          This page doesn't contain any structured data. Adding Schema.org markup can help search engines better understand your content.
        </p>
      </div>
    `;
    return;
  }
  
  schemaContent.innerHTML = '';
  
  // Create container
  const container = document.createElement('div');
  container.className = 'schema-container';
  
  // Get the schema
  const schema = metadata.schemaData[0];
  
  // Important properties to display - prioritize date information
  const priorityProps = ['@type', '@id', 'name', 'headline', 'description', 'url', 'datePublished', 'dateModified', 'author'];
  
  // Filter and sort properties - display only the priority properties
  const allProps = Object.entries(schema.data)
    .filter(([key]) => key !== '@context' && priorityProps.includes(key))
    .sort((a, b) => {
      const aIndex = priorityProps.indexOf(a[0]);
      const bIndex = priorityProps.indexOf(b[0]);
      return aIndex - bIndex;
    });
  
  // Create display for each property
  allProps.forEach(([key, value]) => {
    container.appendChild(createSeparatedSchemaProperty(key, value));
  });
  
  // Add validation status
  const validationEl = document.createElement('div');
  validationEl.className = `schema-validation ${schema.valid ? 'schema-valid' : 'schema-invalid'}`;
  validationEl.innerHTML = schema.valid 
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <span>Valid Schema.org Structure</span>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>Invalid Schema.org Structure</span>`;
  
  container.appendChild(validationEl);
  schemaContent.appendChild(container);
}

/**
 * Improved function to populate canonical URL with better accessibility
 */
function populateCanonicalUrl(metadata) {
  const canonicalContent = document.getElementById('canonical-content');
  if (!canonicalContent) return;
  
  canonicalContent.innerHTML = `
    <div class="canonical-container">
      <span class="canonical-label">URL:</span>
      <div class="canonical-value">${metadata.canonicalUrl || 'Not set'}</div>
      <button class="btn btn-icon canonical-copy" title="Copy canonical URL">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      </button>
    </div>
  `;
  
  // Add click handler for the copy button
  const copyButton = canonicalContent.querySelector('.canonical-copy');
  if (copyButton && metadata.canonicalUrl) {
    copyButton.addEventListener('click', () => {
      navigator.clipboard.writeText(metadata.canonicalUrl)
        .then(() => showToast('Canonical URL copied!'))
        .catch(err => console.error('Failed to copy text: ', err));
    });
  }
}

// Function to show a toast notification
function showToast(message) {
  const toast = document.getElementById('toast');
  if (toast) {
    const toastMessage = toast.querySelector('span');
    if (toastMessage) {
      toastMessage.textContent = message;
    }
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
} 