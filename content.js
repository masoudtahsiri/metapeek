// Create a single observer instance
let observer = null;

// Function to initialize the observer
function initializeObserver() {
  if (!observer) {
    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Handle DOM changes
          const metadata = getPageMetadata();
          chrome.runtime.sendMessage({ type: 'metadataUpdated', metadata });
        }
      });
    });
  }
  return observer;
}

// Initialize the observer when the script loads
initializeObserver();

// Function to extract metadata from the page
function getPageMetadata() {
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
        // Handle both single objects and arrays of objects
        const jsonArray = Array.isArray(json) ? json : [json];
        
        jsonArray.forEach(item => {
          // Recursively find all objects with @type
          const found = findSchemaTypes(item);
          if (found.length > 0) {
            schemas.push(...found);
          } else if (item['@type']) {
            schemas.push({ valid: true, data: item, hasType: true });
          }
        });
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

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'getMetadata') {
    const metadata = getPageMetadata();
    sendResponse(metadata);
  }
}); 