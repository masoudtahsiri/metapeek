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

// Capture Core Web Vitals when available
function captureWebVitals() {
  const performanceMetrics = {};
  
  // Observer for LCP
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    performanceMetrics.lcp = lastEntry.startTime;
  }).observe({type: 'largest-contentful-paint', buffered: true});
  
  // Observer for CLS
  let clsValue = 0;
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    entries.forEach(entry => {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
      }
    });
    performanceMetrics.cls = clsValue;
  }).observe({type: 'layout-shift', buffered: true});
  
  // Return the metrics object that will be populated
  return performanceMetrics;
}

// Function to extract metadata from the page
function getPageMetadata() {
  const metadata = {
    seoSummary: [],
    basicMeta: [],
    ogMeta: [],
    twitterMeta: [],
    canonicalUrl: '',
    schemaData: [],
    performance: captureWebVitals() // Add performance metrics
  };
  
  try {
    // Get basic meta tags
    const title = document.querySelector('title')?.textContent || '';
    const description = document.querySelector('meta[name="description"]')?.content || '';
    const keywords = document.querySelector('meta[name="keywords"]')?.content || '';
    const viewport = document.querySelector('meta[name="viewport"]')?.content || '';
    const robots = document.querySelector('meta[name="robots"]')?.content || '';
    
    // Validate and add basic meta tags using new standards
    metadata.basicMeta = [
      { 
        label: 'Title', 
        value: title,
        status: SEO_STANDARDS.meta.title.validation(title).status,
        message: SEO_STANDARDS.meta.title.validation(title).message
      },
      { 
        label: 'Description', 
        value: description,
        status: SEO_STANDARDS.meta.description.validation(description).status,
        message: SEO_STANDARDS.meta.description.validation(description).message
      },
      { 
        label: 'Keywords', 
        value: keywords,
        status: SEO_STANDARDS.meta.keywords.validation(keywords).status,
        message: SEO_STANDARDS.meta.keywords.validation(keywords).message
      },
      { 
        label: 'Viewport', 
        value: viewport,
        status: SEO_STANDARDS.meta.viewport.validation(viewport).status,
        message: SEO_STANDARDS.meta.viewport.validation(viewport).message
      },
      { 
        label: 'Robots', 
        value: robots,
        status: SEO_STANDARDS.meta.robots.validation(robots).status,
        message: SEO_STANDARDS.meta.robots.validation(robots).message
      }
    ];
    
    // Get Open Graph tags
    const ogTags = document.querySelectorAll('meta[property^="og:"]');
    const requiredOgTags = Object.keys(SEO_STANDARDS.openGraph);
    
    metadata.ogMeta = requiredOgTags.map(tag => {
      const element = document.querySelector(`meta[property="${tag}"]`);
      const value = element?.content || '';
      const validation = SEO_STANDARDS.openGraph[tag].validation(value);
      
      return {
        label: tag,
        value: value,
        status: validation.status,
        message: validation.message
      };
    });
    
    // Get Twitter Card tags
    const twitterTags = document.querySelectorAll('meta[name^="twitter:"]');
    const requiredTwitterTags = Object.keys(SEO_STANDARDS.twitterCard);
    
    metadata.twitterMeta = requiredTwitterTags.map(tag => {
      const element = document.querySelector(`meta[name="${tag}"]`);
      const value = element?.content || '';
      const validation = SEO_STANDARDS.twitterCard[tag].validation(value);
      
      return {
        label: tag,
        value: value,
        status: validation.status,
        message: validation.message
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
    
    // Calculate the health score using the new function
    const seoHealthScore = calculateSEOHealthScore(metadata);
    metadata.seoScore = seoHealthScore;
    
    // Generate summary based on the health score
    metadata.seoSummary = seoHealthScore.recommendations.flatMap(cat => 
      cat.items.map(item => ({
        label: item.issue,
        value: item.details,
        status: item.impact === 'High' ? 'error' : 'warning'
      }))
    );
    
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