function displayFieldValue(value) {
  if (Array.isArray(value)) {
    return value.map(displayFieldValue).join(', ');
  } else if (value && typeof value === 'object') {
    return value.name || '';
  } else {
    return value;
  }
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
  
  // Copy Button Logic
  const copyButtons = document.querySelectorAll('.btn-secondary, .btn-icon');
  const toast = document.getElementById('toast');
  
  copyButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Determine what content to copy based on button's parent
      let textToCopy = '';
      const parentHeader = button.closest('.card-header');
      
      if (parentHeader) {
        const contentId = parentHeader.nextElementSibling.querySelector('div').id;
        const contentElement = document.getElementById(contentId);
        textToCopy = contentElement.textContent;
      } else if (button.id === 'copy-all') {
        // Logic for copying all information
        const activePane = document.querySelector('.tab-pane.active');
        textToCopy = activePane.textContent;
      }
      
      // Copy text to clipboard
      navigator.clipboard.writeText(textToCopy).then(() => {
        // Show toast notification
        toast.classList.add('show');
        
        // Hide toast after 3 seconds
        setTimeout(() => {
          toast.classList.remove('show');
        }, 3000);
      }).catch(err => {
        console.error('Failed to copy text: ', err);
      });
    });
  });
  
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

// Function to create separated meta tag cards
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

// Function to populate meta items with separated cards
function populateMetaItemsWithSeparatedCards(elementId, items) {
  const container = document.getElementById(elementId);
  if (!container) return;
  
  let html = '';
  
  items.forEach(item => {
    html += createSeparatedMetaItem(item);
  });
  
  container.innerHTML = html;
}

// Update the populateMetadata function to use the new card style
function populateMetadata(metadata) {
  console.log('Populating metadata:', metadata); // Debug log
  
  // Populate SEO Summary
  const seoSummaryContent = document.getElementById('seo-summary-content');
  if (seoSummaryContent) {
    let seoHtml = '';
    metadata.seoSummary.forEach(item => {
      const statusClass = `status-${item.status}`;
      const statusLabel = getStatusLabel(item.status);
      
      seoHtml += `<div class="meta-item ${statusClass}">
        <div class="meta-header">
          <span class="meta-label">${item.label}</span>
          <span class="status-indicator status-${item.status}-badge">${statusLabel}</span>
        </div>
        <span class="meta-value">${item.value}</span>
      </div>`;
    });
    seoSummaryContent.innerHTML = seoHtml;
    console.log('SEO Summary populated'); // Debug log
  }
  
  // Populate meta items with separated cards
  if (metadata.basicMeta && metadata.basicMeta.length > 0) {
    populateMetaItemsWithSeparatedCards('basic-meta-content', metadata.basicMeta);
    console.log('Basic meta populated'); // Debug log
  }
  
  if (metadata.ogMeta && metadata.ogMeta.length > 0) {
    populateMetaItemsWithSeparatedCards('og-meta-content', metadata.ogMeta);
    console.log('OG meta populated'); // Debug log
  }
  
  if (metadata.twitterMeta && metadata.twitterMeta.length > 0) {
    populateMetaItemsWithSeparatedCards('twitter-meta-content', metadata.twitterMeta);
    console.log('Twitter meta populated'); // Debug log
  }
  
  // Populate canonical URL
  const canonicalContent = document.getElementById('canonical-content');
  if (canonicalContent) {
    canonicalContent.innerHTML = createSeparatedMetaItem({
      label: 'Canonical URL',
      value: metadata.canonicalUrl || 'Not set',
      status: metadata.canonicalUrl ? 'good' : 'warning',
      message: metadata.canonicalUrl ? 'Properly set' : 'Missing'
    });
    console.log('Canonical URL populated'); // Debug log
  }
  
  // Populate schema data with separated cards
  if (metadata.schemaData && metadata.schemaData.length > 0) {
    populateSchemaWithSeparatedCards(metadata);
    console.log('Schema data populated'); // Debug log
  }
  
  // Populate preview sections
  populatePreviews(metadata);
  console.log('Previews populated'); // Debug log

  // Reattach copy button event listeners
  attachCopyButtonListeners();
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

// Function to populate social media previews
function populatePreviews(metadata) {
  const ogTitle = metadata.ogMeta.find(tag => tag.label === 'og:title')?.value || metadata.basicMeta.find(tag => tag.label === 'Title')?.value || '';
  const ogDescription = metadata.ogMeta.find(tag => tag.label === 'og:description')?.value || metadata.basicMeta.find(tag => tag.label === 'Description')?.value || '';
  const ogImage = metadata.ogMeta.find(tag => tag.label === 'og:image')?.value || '';
  const ogUrl = metadata.ogMeta.find(tag => tag.label === 'og:url')?.value || metadata.canonicalUrl || '';
  
  const twitterTitle = metadata.twitterMeta.find(tag => tag.label === 'twitter:title')?.value || ogTitle;
  const twitterDescription = metadata.twitterMeta.find(tag => tag.label === 'twitter:description')?.value || ogDescription;
  const twitterImage = metadata.twitterMeta.find(tag => tag.label === 'twitter:image')?.value || ogImage;
  
  // Facebook Preview
  document.getElementById('facebook-preview').innerHTML = `
    <div style="max-width: 100%; border: 1px solid var(--color-border); border-radius: var(--radius-md);">
      ${ogImage ? `
        <div style="height: 150px; background-color: var(--color-bg-tertiary); overflow: hidden;">
          <img src="${ogImage}" alt="${ogTitle}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
      ` : `
        <div style="height: 150px; background-color: var(--color-bg-tertiary); display: flex; align-items: center; justify-content: center;">
          <span style="color: var(--color-text-secondary);">No preview image available</span>
        </div>
      `}
      <div style="padding: var(--space-3);">
        <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-1);">${new URL(ogUrl).hostname}</div>
        <div style="font-weight: var(--font-weight-semibold); margin-bottom: var(--space-1);">${ogTitle}</div>
        <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">${ogDescription}</div>
      </div>
    </div>
  `;
  
  // Twitter Preview
  document.getElementById('twitter-preview').innerHTML = `
    <div style="max-width: 100%; border: 1px solid var(--color-border); border-radius: var(--radius-md);">
      ${twitterImage ? `
        <div style="height: 150px; background-color: var(--color-bg-tertiary); overflow: hidden;">
          <img src="${twitterImage}" alt="${twitterTitle}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
      ` : `
        <div style="height: 150px; background-color: var(--color-bg-tertiary); display: flex; align-items: center; justify-content: center;">
          <span style="color: var(--color-text-secondary);">No preview image available</span>
        </div>
      `}
      <div style="padding: var(--space-3);">
        <div style="font-weight: var(--font-weight-semibold); margin-bottom: var(--space-1);">${twitterTitle}</div>
        <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-1);">${twitterDescription}</div>
        <div style="font-size: var(--font-size-xs); color: var(--color-text-tertiary);">${new URL(ogUrl).hostname}</div>
      </div>
    </div>
  `;
  
  // LinkedIn Preview
  document.getElementById('linkedin-preview').innerHTML = `
    <div style="max-width: 100%; border: 1px solid var(--color-border); border-radius: var(--radius-md);">
      ${ogImage ? `
        <div style="height: 150px; background-color: var(--color-bg-tertiary); overflow: hidden;">
          <img src="${ogImage}" alt="${ogTitle}" style="width: 100%; height: 100%; object-fit: cover;">
        </div>
      ` : `
        <div style="height: 150px; background-color: var(--color-bg-tertiary); display: flex; align-items: center; justify-content: center;">
          <span style="color: var(--color-text-secondary);">No preview image available</span>
        </div>
      `}
      <div style="padding: var(--space-3);">
        <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-1);">${new URL(ogUrl).hostname}</div>
        <div style="font-weight: var(--font-weight-semibold); margin-bottom: var(--space-1);">${ogTitle}</div>
        <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">${ogDescription}</div>
      </div>
    </div>
  `;
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
 * Enhanced Schema.org display functions
 */

// Function to populate schema content with separated cards
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
  
  // Define important properties to show
  const essentialProps = [
    '@type',
    '@id',
    'name',
    'url',
    'description',
    'headline',
    'author',
    'datePublished',
    'dateModified',
    'publisher'
  ];
  
  // Filter and sort properties
  const propsToDisplay = Object.entries(schema.data)
    .filter(([key]) => key !== '@context' && essentialProps.includes(key))
    .sort((a, b) => {
      const aIndex = essentialProps.indexOf(a[0]);
      const bIndex = essentialProps.indexOf(b[0]);
      return aIndex - bIndex;
    });
  
  // Create property cards for all essential properties
  propsToDisplay.forEach(([key, value]) => {
    container.appendChild(createSeparatedSchemaProperty(key, value));
  });
  
  // Add validation information
  if (!schema.valid) {
    const validationElement = document.createElement('div');
    validationElement.className = 'schema-validation schema-invalid';
    validationElement.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      Invalid Schema.org Structure
    `;
    container.appendChild(validationElement);
  }
  
  schemaContent.appendChild(container);
}

// Function to create a property element (recursively for nested objects)
function createPropertyElement(key, value, level = 0) {
  const propertyElement = document.createElement('div');
  propertyElement.className = 'schema-property';
  
  const keyElement = document.createElement('div');
  keyElement.className = 'schema-property-key';
  keyElement.textContent = key;
  
  propertyElement.appendChild(keyElement);
  
  // Handle different value types
  if (value === null || value === undefined) {
    const valueElement = document.createElement('div');
    valueElement.className = 'schema-property-value';
    valueElement.textContent = 'null';
    propertyElement.appendChild(valueElement);
  } 
  else if (Array.isArray(value)) {
    if (value.length === 0) {
      const valueElement = document.createElement('div');
      valueElement.className = 'schema-property-value';
      valueElement.textContent = '[ ]';
      propertyElement.appendChild(valueElement);
    } 
    else if (typeof value[0] !== 'object' || value[0] === null) {
      // Array of primitives
      const valueElement = document.createElement('div');
      valueElement.className = 'schema-property-value';
      valueElement.textContent = JSON.stringify(value);
      propertyElement.appendChild(valueElement);
    } 
    else {
      // Array of objects - make collapsible
      const expandButton = document.createElement('button');
      expandButton.className = 'schema-expand-btn';
      expandButton.innerHTML = `
        <svg class="schema-expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
        Array (${value.length} items)
      `;
      
      propertyElement.appendChild(expandButton);
      
      const nestedContainer = document.createElement('div');
      nestedContainer.className = 'schema-property-nested';
      
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          // For objects in array
          const arrayItemContainer = document.createElement('div');
          arrayItemContainer.className = 'schema-property';
          
          const arrayItemKey = document.createElement('div');
          arrayItemKey.className = 'schema-property-key';
          arrayItemKey.textContent = `[${index}]`;
          
          arrayItemContainer.appendChild(arrayItemKey);
          
          const nestedProperties = document.createElement('div');
          nestedProperties.className = 'schema-property-nested';
          
          Object.entries(item).forEach(([nestedKey, nestedValue]) => {
            const nestedProp = createPropertyElement(nestedKey, nestedValue, level + 1);
            nestedProperties.appendChild(nestedProp);
          });
          
          arrayItemContainer.appendChild(nestedProperties);
          nestedContainer.appendChild(arrayItemContainer);
        } 
        else {
          // For primitives in array
          const arrayItemContainer = document.createElement('div');
          arrayItemContainer.className = 'schema-property';
          
          const arrayItemKey = document.createElement('div');
          arrayItemKey.className = 'schema-property-key';
          arrayItemKey.textContent = `[${index}]`;
          
          const arrayItemValue = document.createElement('div');
          arrayItemValue.className = 'schema-property-value';
          arrayItemValue.textContent = JSON.stringify(item);
          
          arrayItemContainer.appendChild(arrayItemKey);
          arrayItemContainer.appendChild(arrayItemValue);
          nestedContainer.appendChild(arrayItemContainer);
        }
      });
      
      propertyElement.appendChild(nestedContainer);
      
      // Toggle collapse/expand
      expandButton.addEventListener('click', () => {
        propertyElement.classList.toggle('schema-collapsed');
      });
    }
  } 
  else if (typeof value === 'object') {
    // Object - make collapsible
    const expandButton = document.createElement('button');
    expandButton.className = 'schema-expand-btn';
    expandButton.innerHTML = `
      <svg class="schema-expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
      Object
    `;
    
    propertyElement.appendChild(expandButton);
    
    const nestedContainer = document.createElement('div');
    nestedContainer.className = 'schema-property-nested';
    
    Object.entries(value).forEach(([nestedKey, nestedValue]) => {
      const nestedProp = createPropertyElement(nestedKey, nestedValue, level + 1);
      nestedContainer.appendChild(nestedProp);
    });
    
    propertyElement.appendChild(nestedContainer);
    
    // Toggle collapse/expand
    expandButton.addEventListener('click', () => {
      propertyElement.classList.toggle('schema-collapsed');
    });
  } 
  else {
    // Simple value
    const valueElement = document.createElement('div');
    valueElement.className = 'schema-property-value';
    
    // Format URLs as links
    if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
      valueElement.innerHTML = `<a href="${value}" target="_blank" rel="noopener noreferrer">${value}</a>`;
    } else {
      valueElement.textContent = JSON.stringify(value);
    }
    
    propertyElement.appendChild(valueElement);
  }
  
  return propertyElement;
}

// Function to create an empty state when no schema is found
function createEmptySchemaView() {
  const container = document.createElement('div');
  container.className = 'schema-empty';
  
  container.innerHTML = `
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
  `;
  
  return container;
}

// Function to add syntax highlighting to JSON
function syntaxHighlightJson(json) {
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'json-key';
      } else {
        cls = 'json-string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return `<span class="${cls}">${match}</span>`;
  });
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

// Function to create schema property with separated header and content
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
      nestedContent.className = 'schema-nested-content';
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
    nestedContent.className = 'schema-nested-content';
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