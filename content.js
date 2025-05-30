/**
 * MetaPeek Content Script - FIXED FOR MEMORY LEAKS AND PERFORMANCE
 * Extracts and analyzes metadata from web pages
 */

// Initialize the MetaPeek namespace
window.MetaPeek = window.MetaPeek || {
  initialized: false,
  observer: null,
  metadata: null,
  messageListener: null,
  tooltipListeners: new WeakMap(),
  lastExtractTime: 0,
  extractionTimeout: null
};

// Add metadata caching
const metaCache = {
  basic: null,
  og: null,
  twitter: null,
  schema: null,
  lastUpdate: 0
};

const CACHE_TTL = 1000; // 1 second cache

function getCachedMetadata(type) {
  const now = Date.now();
  if (metaCache[type] && (now - metaCache.lastUpdate) < CACHE_TTL) {
    return metaCache[type];
  }
  return null;
}

function setCachedMetadata(type, data) {
  metaCache[type] = data;
  metaCache.lastUpdate = Date.now();
}

function clearMetadataCache() {
  metaCache.basic = null;
  metaCache.og = null;
  metaCache.twitter = null;
  metaCache.schema = null;
  metaCache.lastUpdate = 0;
}

/**
 * Enhanced Meta Tag Validation for MetaPeek
 * [KEEP ALL THE META_TAG_STANDARDS DEFINITION AS-IS]
 */
const META_TAG_STANDARDS = {
  // Basic Meta Tags
  title: { 
    min: 30, 
    max: 60, 
    required: true,
    impact: "high",
    message: {
      missing: "Title tag is required for SEO",
      tooShort: "Title too short (under 30 chars); consider adding more descriptive content",
      tooLong: "Title too long (over 60 chars); will be truncated in search results",
      good: "Title length is optimal for search engines"
    }
  },
  description: { 
    min: 120, 
    max: 160, 
    required: true,
    impact: "high",
    message: {
      missing: "Meta description is highly recommended for SEO",
      tooShort: "Description too short (under 120 chars); add more relevant content",
      tooLong: "Description too long (over 160 chars); will be truncated in search results",
      good: "Description length is optimal for search engines"
    }
  },
  keywords: { 
    required: false,
    max: 10,
    impact: "low",
    message: {
      missing: "Keywords tag is optional and has minimal SEO value",
      tooMany: "Too many keywords may dilute relevance (limited SEO value)",
      good: "Keywords defined (minimal SEO impact)"
    }
  },
  viewport: { 
    required: true,
    recommended: "width=device-width, initial-scale=1",
    impact: "high",
    message: {
      missing: "Viewport meta tag is required for responsive design",
      invalid: "Viewport should include width=device-width for responsiveness",
      good: "Viewport properly configured for responsive design"
    }
  },
  robots: { 
    required: false,
    impact: "medium",
    valid: [
      "index", "noindex", "follow", "nofollow", "none", "noarchive", 
      "nosnippet", "notranslate", "noimageindex", "unavailable_after",
      "max-image-preview:large", "max-image-preview:standard", "max-image-preview:none",
      "max-snippet:-1", "max-snippet:0", 
      "max-video-preview:-1", "max-video-preview:0",
      "noydir", "noodp", "nocache", "noodyp", "noyaca",
      "max-image-preview", "max-snippet", "max-video-preview"
    ],
    message: {
      missing: "Robots tag is optional but recommended for crawl control",
      invalid: "Contains invalid robots directives",
      good: "Robots tag properly set"
    }
  },
  
  // Open Graph Tags
  ogTitle: { 
    min: 40,
    max: 70,
    required: true,
    impact: "high",
    message: {
      missing: "og:title is required for social sharing",
      tooShort: "og:title too short (under 40 chars)",
      tooLong: "og:title too long (over 70 chars); may be truncated on social media",
      good: "og:title length is good for social sharing"
    }
  },
  ogDescription: { 
    min: 120, 
    max: 200, 
    required: true,
    impact: "high",
    message: {
      missing: "og:description is required for social sharing",
      tooShort: "og:description too short (under 120 chars)",
      tooLong: "og:description too long (over 200 chars); may be truncated",
      good: "og:description length is good for social sharing"
    }
  },
  ogImage: {
    required: true, 
    minWidth: 1200, 
    minHeight: 630,
    impact: "high",
    message: {
      missing: "og:image is required for attractive social sharing",
      tooSmall: "og:image is smaller than recommended (1200×630px)",
      good: "og:image is properly defined"
    }
  },
  ogUrl: {
    required: true,
    impact: "medium",
    message: {
      missing: "og:url is required for proper social sharing links",
      invalid: "og:url should be a valid, absolute URL",
      good: "og:url properly defined"
    }
  },
  ogType: {
    required: true,
    impact: "medium",
    recommended: ["website", "article", "book", "profile", "music.song", "music.album", "music.playlist", "video.movie", "video.tv_show"],
    message: {
      missing: "og:type is required for Open Graph markup",
      invalid: "og:type should be a standard type (website, article, etc.)",
      good: "og:type properly defined"
    }
  },
  ogSiteName: {
    required: true,
    impact: "low",
    message: {
      missing: "og:site_name is recommended for brand recognition",
      good: "og:site_name properly defined"
    }
  },
  
  // Twitter Card Tags
  twitterCard: {
    required: true,
    impact: "medium",
    valid: ["summary", "summary_large_image", "app", "player"],
    message: {
      missing: "twitter:card is required for Twitter sharing",
      invalid: "twitter:card must be a valid card type",
      good: "twitter:card properly defined"
    }
  },
  twitterTitle: {
    min: 40,
    max: 70, 
    required: true,
    impact: "medium",
    message: {
      missing: "twitter:title is required for Twitter sharing",
      tooShort: "twitter:title too short (under 40 chars)",
      tooLong: "twitter:title too long (over 70 chars); may be truncated",
      good: "twitter:title length is good for Twitter"
    }
  },
  twitterDescription: {
    min: 125,
    max: 200, 
    required: true,
    impact: "medium",
    message: {
      missing: "twitter:description is required for Twitter sharing",
      tooShort: "twitter:description too short (under 125 chars)",
      tooLong: "twitter:description too long (over 200 chars); may be truncated",
      good: "twitter:description length is good for Twitter"
    }
  },
  twitterImage: {
    required: true,
    impact: "medium",
    message: {
      missing: "twitter:image is required for attractive Twitter sharing",
      good: "twitter:image properly defined"
    }
  },
  twitterSite: {
    required: false,
    impact: "low",
    format: /^@[A-Za-z0-9_]{1,15}$/,
    message: {
      missing: "twitter:site is recommended for attribution",
      invalid: "twitter:site should be a valid Twitter handle (e.g., @username)",
      good: "twitter:site properly defined"
    }
  },
  
  // Canonical URL
  canonical: {
    required: true,
    impact: "high",
    message: {
      missing: "Canonical URL is important for SEO to prevent duplicate content",
      mismatch: "Canonical URL doesn't match the current page URL",
      good: "Canonical URL properly defined"
    }
  }
};

const CACHE_DURATION = 120000; // 2 minutes in ms
const EXTRACTION_DEBOUNCE = 500; // Debounce metadata extraction

/**
 * Cleanup function to prevent memory leaks
 */
function cleanup() {
  // Disconnect observer
  if (window.MetaPeek.observer) {
    window.MetaPeek.observer.disconnect();
    window.MetaPeek.observer = null;
  }
  
  // Remove message listener
  if (window.MetaPeek.messageListener) {
    chrome.runtime.onMessage.removeListener(window.MetaPeek.messageListener);
    window.MetaPeek.messageListener = null;
  }
  
  // Clear extraction timeout
  if (window.MetaPeek.extractionTimeout) {
    clearTimeout(window.MetaPeek.extractionTimeout);
    window.MetaPeek.extractionTimeout = null;
  }
  
  // Clear tooltip listeners
  window.MetaPeek.tooltipListeners = new WeakMap();
  
  // Clear metadata cache
  clearMetadataCache();
  
  // Reset state
  window.MetaPeek.initialized = false;
  window.MetaPeek.metadata = null;
}

/**
 * Initialize the MetaPeek observer and start collecting metadata
 */
function initializeMetaPeek() {
  if (window.MetaPeek.initialized) {
    return;
  }
  
  // Cleanup any existing resources first
  cleanup();
  
  window.MetaPeek.initialized = true;
  
  try {
    // Create and configure mutation observer with optimized settings
    window.MetaPeek.observer = new MutationObserver((mutations) => {
      // Debounce metadata extraction
      if (window.MetaPeek.extractionTimeout) {
        clearTimeout(window.MetaPeek.extractionTimeout);
      }
      
      window.MetaPeek.extractionTimeout = setTimeout(() => {
        // Only process if we have relevant mutations
        const hasRelevantMutations = mutations.some(mutation => {
          if (mutation.type !== 'childList') return false;
          
          // Check if mutations affect meta tags or title
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.tagName === 'META' || node.tagName === 'TITLE' || 
                  node.tagName === 'LINK' || node.tagName === 'SCRIPT') {
                return true;
              }
              // Check for meta tags in subtree
              if (node.querySelector && node.querySelector('meta, title, link[rel="canonical"], script[type="application/ld+json"]')) {
                return true;
              }
            }
          }
          return false;
        });
        
        if (hasRelevantMutations) {
          try {
            const metadata = getPageMetadata();
            window.MetaPeek.metadata = metadata;
            
            // Send metadata update with error handling
            sendMetadataUpdate(metadata);
          } catch (error) {
          }
        }
      }, EXTRACTION_DEBOUNCE);
    });
    
    // Observe only the head element for better performance
    const head = document.head || document.documentElement;
    window.MetaPeek.observer.observe(head, { 
      childList: true, 
      subtree: true,
      attributes: false,
      characterData: false
    });
    
    // Collect initial metadata
    try {
      const metadata = getPageMetadata();
      window.MetaPeek.metadata = metadata;
      
      // Send initial metadata
      sendMetadataUpdate(metadata);
    } catch (error) {
    }
  } catch (error) {
    // Reset initialization flag to allow retry
    window.MetaPeek.initialized = false;
  }
}

/**
 * Send metadata update with proper error handling
 */
function sendMetadataUpdate(metadata) {
  try {
    chrome.runtime.sendMessage({ type: 'metadataUpdated', metadata })
      .catch(error => {
        if (error.message && error.message.includes('Extension context invalidated')) {
          cleanup();
        }
      });
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      cleanup();
    }
  }
}

/**
 * Message handler for communication with popup and background scripts
 */
function setupMessageListener() {
  // Remove any existing listener first
  if (window.MetaPeek.messageListener) {
    chrome.runtime.onMessage.removeListener(window.MetaPeek.messageListener);
  }
  
  // Create new listener
  window.MetaPeek.messageListener = (request, sender, sendResponse) => {
    try {
      switch (request.type) {
        case 'getMetadata':
          handleGetMetadataRequest(sendResponse);
          break;
          
        case 'getSEOHealth':
          handleSEOHealthRequest(sendResponse);
          break;
          
        default:
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      if (error.message && error.message.includes('Extension context invalidated')) {
        cleanup();
        sendResponse({ error: 'Extension context invalidated' });
      } else {
        sendResponse({ error: error.message });
      }
    }
    
    // Keep the message channel open for async responses
    return true;
  };
  
  // Add the listener
  chrome.runtime.onMessage.addListener(window.MetaPeek.messageListener);
}

/**
 * Handle getMetadata request from popup
 * @param {Function} sendResponse - Function to send response back to requester
 */
function handleGetMetadataRequest(sendResponse) {
  // Check if we have recent cached metadata
  const now = Date.now();
  if (window.MetaPeek.metadata && 
      window.MetaPeek.lastExtractTime && 
      (now - window.MetaPeek.lastExtractTime) < 1000) {
    // Use cached metadata if it's less than 1 second old
    sendResponse(window.MetaPeek.metadata);
    return;
  }
  
  // Collect fresh metadata
  const metadata = getPageMetadata();
  
  // Cache it for later use
  window.MetaPeek.metadata = metadata;
  window.MetaPeek.lastExtractTime = now;
  
  sendResponse(metadata);
}

/**
 * Handle getSEOHealth request from popup
 * @param {Function} sendResponse - Function to send response back to requester
 */
function handleSEOHealthRequest(sendResponse) {
  const metadata = getPageMetadata();
  const seoHealth = calculateSEOHealthScore(metadata);
  
  sendResponse(seoHealth);
}

/**
 * Extract metadata from the current page
 * @returns {Object} Collected metadata
 */
function getPageMetadata() {
  const metadata = {
    seoSummary: [],
    basicMeta: [],
    ogMeta: [],
    twitterMeta: [],
    canonicalUrl: '',
    schemaData: [],
    url: window.location.href
  };
  
  try {
    // Extract basic meta tags
    extractBasicMetaTags(metadata);
    
    // Extract Open Graph tags
    extractOpenGraphTags(metadata);
    
    // Extract Twitter Card tags
    extractTwitterCardTags(metadata);
    
    // Extract canonical URL
    metadata.canonicalUrl = document.querySelector('link[rel="canonical"]')?.href || '';
    
    // Extract Schema.org data
    extractSchemaData(metadata);
    
    // Calculate SEO health score
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
    return metadata;
  }
}

/**
 * Enhanced extraction and validation of basic meta tags
 * @param {Object} metadata - Metadata object to populate
 */
function extractBasicMetaTags(metadata) {
  // Check cache first
  const cached = getCachedMetadata('basic');
  if (cached) {
    metadata.basicMeta = cached;
    return;
  }

  // Title validation
  const title = document.querySelector('title')?.textContent || '';
  let titleStatus = 'error';
  let titleMessage = META_TAG_STANDARDS.title.message.missing;
  
  if (title) {
    if (title.length < META_TAG_STANDARDS.title.min) {
      titleStatus = 'warning';
      titleMessage = META_TAG_STANDARDS.title.message.tooShort;
    } else if (title.length > META_TAG_STANDARDS.title.max) {
      titleStatus = 'warning';
      titleMessage = META_TAG_STANDARDS.title.message.tooLong;
    } else {
      titleStatus = 'good';
      titleMessage = META_TAG_STANDARDS.title.message.good;
    }
  }
  
  // Description validation
  const description = document.querySelector('meta[name="description"]')?.content || '';
  let descStatus = 'error';
  let descMessage = META_TAG_STANDARDS.description.message.missing;
  
  if (description) {
    if (description.length < META_TAG_STANDARDS.description.min) {
      descStatus = 'warning';
      descMessage = META_TAG_STANDARDS.description.message.tooShort;
    } else if (description.length > META_TAG_STANDARDS.description.max) {
      descStatus = 'warning';
      descMessage = META_TAG_STANDARDS.description.message.tooLong;
    } else {
      descStatus = 'good';
      descMessage = META_TAG_STANDARDS.description.message.good;
    }
  }
  
  // Keywords validation
  const keywords = document.querySelector('meta[name="keywords"]')?.content || '';
  let keywordsStatus = 'warning';
  let keywordsMessage = META_TAG_STANDARDS.keywords.message.missing;
  
  if (keywords) {
    const keywordCount = keywords.split(',').length;
    if (keywordCount > META_TAG_STANDARDS.keywords.max) {
      keywordsStatus = 'warning';
      keywordsMessage = META_TAG_STANDARDS.keywords.message.tooMany;
    } else {
      keywordsStatus = 'good';
      keywordsMessage = META_TAG_STANDARDS.keywords.message.good;
    }
  }
  
  // Viewport validation
  const viewport = document.querySelector('meta[name="viewport"]')?.content || '';
  let viewportStatus = 'error';
  let viewportMessage = META_TAG_STANDARDS.viewport.message.missing;
  
  if (viewport) {
    if (!viewport.includes('width=device-width')) {
      viewportStatus = 'warning';
      viewportMessage = META_TAG_STANDARDS.viewport.message.invalid;
    } else {
      viewportStatus = 'good';
      viewportMessage = META_TAG_STANDARDS.viewport.message.good;
    }
  }
  
  // Robots validation with improved directive parsing
  const robots = document.querySelector('meta[name="robots"]')?.content || '';
  let robotsStatus = 'warning';
  let robotsMessage = META_TAG_STANDARDS.robots.message.missing;

  if (robots) {
    // Split into individual directives, including those with parameters
    const directivesRaw = robots.toLowerCase().split(',').map(d => d.trim());
    let hasInvalid = false;
    
    // Check each directive against our valid list
    directivesRaw.forEach(directive => {
      // Get the base directive (part before any colon)
      const baseDirective = directive.split(':')[0].trim();
      
      // Check if the full directive is valid OR if the base directive is valid
      // This allows for parameter variations like max-snippet:50 that we haven't explicitly listed
      if (!META_TAG_STANDARDS.robots.valid.includes(directive) && 
          !META_TAG_STANDARDS.robots.valid.includes(baseDirective)) {
        hasInvalid = true;
      }
    });
    
    if (hasInvalid) {
      robotsStatus = 'warning';
      robotsMessage = META_TAG_STANDARDS.robots.message.invalid;
    } else {
      robotsStatus = 'good';
      robotsMessage = META_TAG_STANDARDS.robots.message.good;
    }
  }
  
  // Build the basic meta tags array
  metadata.basicMeta = [
    { 
      label: 'Title', 
      value: title,
      status: titleStatus,
      message: titleMessage
    },
    { 
      label: 'Description', 
      value: description,
      status: descStatus,
      message: descMessage
    },
    { 
      label: 'Keywords', 
      value: keywords,
      status: keywordsStatus,
      message: keywordsMessage
    },
    { 
      label: 'Viewport', 
      value: viewport,
      status: viewportStatus,
      message: viewportMessage
    },
    { 
      label: 'Robots', 
      value: robots,
      status: robotsStatus,
      message: robotsMessage
    }
  ];

  // Cache the results
  setCachedMetadata('basic', metadata.basicMeta);
}

/**
 * Enhanced extraction and validation of Open Graph tags
 * @param {Object} metadata - Metadata object to populate
 */
function extractOpenGraphTags(metadata) {
  // Check cache first
  const cached = getCachedMetadata('og');
  if (cached) {
    metadata.ogMeta = cached;
    return;
  }

  // Define required Open Graph tags with validation rules
  const ogTags = [
    {
      name: 'og:title',
      standard: META_TAG_STANDARDS.ogTitle,
      validate: (value) => {
        if (!value) return { status: 'error', message: META_TAG_STANDARDS.ogTitle.message.missing };
        if (value.length < META_TAG_STANDARDS.ogTitle.min) return { status: 'warning', message: META_TAG_STANDARDS.ogTitle.message.tooShort };
        if (value.length > META_TAG_STANDARDS.ogTitle.max) return { status: 'warning', message: META_TAG_STANDARDS.ogTitle.message.tooLong };
        return { status: 'good', message: META_TAG_STANDARDS.ogTitle.message.good };
      }
    },
    {
      name: 'og:description',
      standard: META_TAG_STANDARDS.ogDescription,
      validate: (value) => {
        if (!value) return { status: 'error', message: META_TAG_STANDARDS.ogDescription.message.missing };
        if (value.length < META_TAG_STANDARDS.ogDescription.min) return { status: 'warning', message: META_TAG_STANDARDS.ogDescription.message.tooShort };
        if (value.length > META_TAG_STANDARDS.ogDescription.max) return { status: 'warning', message: META_TAG_STANDARDS.ogDescription.message.tooLong };
        return { status: 'good', message: META_TAG_STANDARDS.ogDescription.message.good };
      }
    },
    {
      name: 'og:image',
      standard: META_TAG_STANDARDS.ogImage,
      validate: (value) => {
        if (!value) return { status: 'error', message: META_TAG_STANDARDS.ogImage.message.missing };
        // Additional validation could be performed if image dimensions are available
        return { status: 'good', message: META_TAG_STANDARDS.ogImage.message.good };
      }
    },
    {
      name: 'og:url',
      standard: META_TAG_STANDARDS.ogUrl,
      validate: (value) => {
        if (!value) return { status: 'error', message: META_TAG_STANDARDS.ogUrl.message.missing };
        try {
          new URL(value); // Check if valid URL
          return { status: 'good', message: META_TAG_STANDARDS.ogUrl.message.good };
        } catch (e) {
          return { status: 'warning', message: META_TAG_STANDARDS.ogUrl.message.invalid };
        }
      }
    },
    {
      name: 'og:type',
      standard: META_TAG_STANDARDS.ogType,
      validate: (value) => {
        if (!value) return { status: 'error', message: META_TAG_STANDARDS.ogType.message.missing };
        if (!META_TAG_STANDARDS.ogType.recommended.includes(value)) {
          return { status: 'warning', message: META_TAG_STANDARDS.ogType.message.invalid };
        }
        return { status: 'good', message: META_TAG_STANDARDS.ogType.message.good };
      }
    },
    {
      name: 'og:site_name',
      standard: META_TAG_STANDARDS.ogSiteName,
      validate: (value) => {
        if (!value) return { status: 'error', message: META_TAG_STANDARDS.ogSiteName.message.missing };
        return { status: 'good', message: META_TAG_STANDARDS.ogSiteName.message.good };
      }
    }
  ];
  
  // Process and validate each OG tag
  metadata.ogMeta = ogTags.map(tag => {
    const element = document.querySelector(`meta[property="${tag.name}"]`);
    const value = element?.content || '';
    const validation = tag.validate(value);
    
    return {
      label: tag.name,
      value: value,
      status: validation.status,
      message: validation.message
    };
  });

  // Cache the results
  setCachedMetadata('og', metadata.ogMeta);
}

/**
 * Enhanced extraction and validation of Twitter Card tags
 * @param {Object} metadata - Metadata object to populate
 */
function extractTwitterCardTags(metadata) {
  // Check cache first
  const cached = getCachedMetadata('twitter');
  if (cached) {
    metadata.twitterMeta = cached;
    return;
  }

  // Define required Twitter Card tags with validation rules
  const twitterTags = [
    {
      name: 'twitter:card',
      standard: META_TAG_STANDARDS.twitterCard,
      validate: (value) => {
        if (!value) return { status: 'error', message: META_TAG_STANDARDS.twitterCard.message.missing };
        if (!META_TAG_STANDARDS.twitterCard.valid.includes(value)) {
          return { status: 'warning', message: META_TAG_STANDARDS.twitterCard.message.invalid };
        }
        return { status: 'good', message: META_TAG_STANDARDS.twitterCard.message.good };
      }
    },
    {
      name: 'twitter:title',
      standard: META_TAG_STANDARDS.twitterTitle,
      validate: (value) => {
        if (!value) return { status: 'error', message: META_TAG_STANDARDS.twitterTitle.message.missing };
        if (value.length < META_TAG_STANDARDS.twitterTitle.min) {
          return { status: 'warning', message: META_TAG_STANDARDS.twitterTitle.message.tooShort };
        }
        if (value.length > META_TAG_STANDARDS.twitterTitle.max) {
          return { status: 'warning', message: META_TAG_STANDARDS.twitterTitle.message.tooLong };
        }
        return { status: 'good', message: META_TAG_STANDARDS.twitterTitle.message.good };
      }
    },
    {
      name: 'twitter:description',
      standard: META_TAG_STANDARDS.twitterDescription,
      validate: (value) => {
        if (!value) return { status: 'error', message: META_TAG_STANDARDS.twitterDescription.message.missing };
        if (value.length < META_TAG_STANDARDS.twitterDescription.min) {
          return { status: 'warning', message: META_TAG_STANDARDS.twitterDescription.message.tooShort };
        }
        if (value.length > META_TAG_STANDARDS.twitterDescription.max) {
          return { status: 'warning', message: META_TAG_STANDARDS.twitterDescription.message.tooLong };
        }
        return { status: 'good', message: META_TAG_STANDARDS.twitterDescription.message.good };
      }
    },
    {
      name: 'twitter:image',
      standard: META_TAG_STANDARDS.twitterImage,
      validate: (value) => {
        if (!value) return { status: 'error', message: META_TAG_STANDARDS.twitterImage.message.missing };
        return { status: 'good', message: META_TAG_STANDARDS.twitterImage.message.good };
      }
    },
    {
      name: 'twitter:site',
      standard: META_TAG_STANDARDS.twitterSite,
      validate: (value) => {
        if (!value) return { status: 'warning', message: META_TAG_STANDARDS.twitterSite.message.missing };
        if (!META_TAG_STANDARDS.twitterSite.format.test(value)) {
          return { status: 'warning', message: META_TAG_STANDARDS.twitterSite.message.invalid };
        }
        return { status: 'good', message: META_TAG_STANDARDS.twitterSite.message.good };
      }
    }
  ];
  
  // Process and validate each Twitter tag
  metadata.twitterMeta = twitterTags.map(tag => {
    const element = document.querySelector(`meta[name="${tag.name}"]`);
    const value = element?.content || '';
    const validation = tag.validate(value);
    
    return {
      label: tag.name,
      value: value,
      status: validation.status,
      message: validation.message
    };
  });

  // Cache the results
  setCachedMetadata('twitter', metadata.twitterMeta);
}

/**
 * Extract Schema.org structured data from the page
 * @param {Object} metadata - Metadata object to update
 */
function extractSchemaData(metadata) {
  // Check cache first
  const cached = getCachedMetadata('schema');
  if (cached) {
    metadata.schemaData = cached;
    return;
  }

  const schemaScripts = document.querySelectorAll('script[type="application/ld+json"]');
  let schemas = [];

  // List of important types (can be expanded)
  const importantTypes = [
    'WebPage', 'Article', 'NewsArticle', 'BlogPosting', 'FAQPage', 'Product', 'Person', 'Event', 'Recipe', 'VideoObject', 'HowTo', 'Course', 'Review', 'LocalBusiness', 'Service', 'JobPosting', 'ProfilePage', 'ContactPage', 'CollectionPage', 'CheckoutPage'
  ];

  function isImportantType(type) {
    if (!type) return false;
    if (Array.isArray(type)) return type.some(t => importantTypes.includes(t));
    return importantTypes.includes(type);
  }
  
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
        // Root-level object with @type
        if (item && typeof item === 'object' && item['@type']) {
          schemas.push({ valid: true, data: item, hasType: true });
        }
        // One level deep: check direct children for @type
        if (item && typeof item === 'object') {
          Object.values(item).forEach(val => {
            if (val && typeof val === 'object') {
              if (Array.isArray(val)) {
                val.forEach(child => {
                  if (child && typeof child === 'object' && child['@type'] && isImportantType(child['@type'])) {
                    schemas.push({ valid: true, data: child, hasType: true });
                  }
                });
              } else if (val['@type'] && isImportantType(val['@type'])) {
                schemas.push({ valid: true, data: val, hasType: true });
              }
            }
          });
        }
      });
    } else {
      schemas.push({ valid: false, data: null, hasType: false });
    }
  });
  
  // Remove duplicates (by stringified data)
  const seen = new Set();
  schemas = schemas.filter(schema => {
    const str = JSON.stringify(schema.data);
    if (seen.has(str)) return false;
    seen.add(str);
    return schema.valid && schema.data;
  });

  metadata.schemaData = schemas;

  // Cache the results
  setCachedMetadata('schema', metadata.schemaData);
}

/**
 * Check if a schema object is relevant to the current page
 * @param {Object} obj - Schema object to check
 * @param {string} currentUrl - Current page URL
 * @returns {boolean} True if schema is relevant to current page
 */
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
 * Calculate completeness data and recommendations
 * @param {Object} metadata - The metadata to analyze
 * @returns {Object} Completeness data and recommendations
 */
function calculateSEOHealthScore(metadata) {
  // Generate recommendations (keep all the existing recommendation logic)
  const recommendations = generateRecommendations(metadata);
  
  // Return simplified result without score calculation
  return {
    score: null, // No longer calculating a misleading "SEO score"
    recommendations: recommendations,
    status: 'info' // Neutral status
  };
}

/**
 * Generate SEO recommendations with concise descriptions organized by meta tag type
 * @param {Object} metadata - The metadata to analyze
 * @returns {Array} Array of recommendation categories
 */
function generateRecommendations(metadata) {
  const recommendations = [];
  
  // Basic Meta Tags Issues
  if (metadata.basicMeta && metadata.basicMeta.some(tag => tag.status !== 'good')) {
    const basicIssues = metadata.basicMeta
      .filter(tag => tag.status !== 'good')
      .map(tag => {
        const standardKey = getStandardKey(tag.label);
        const standard = META_TAG_STANDARDS[standardKey];
        const impact = getImpactLevel(standard?.impact);
        
        return {
          issue: getIssueTitle(tag.label, tag.status),
          details: tag.message || getDefaultMessage(tag.label, tag.status),
          impact: impact,
          category: 'Basic Meta Tag'
        };
      });
    
    if (basicIssues.length > 0) {
      recommendations.push({
        category: 'Basic Meta Tag',
        items: basicIssues
      });
    }
  }
  
  // Open Graph Meta Tags Issues
  if (metadata.ogMeta && metadata.ogMeta.some(tag => tag.status !== 'good')) {
    const ogIssues = metadata.ogMeta
      .filter(tag => tag.status !== 'good')
      .map(tag => {
        const standardKey = getStandardKey(tag.label);
        const standard = META_TAG_STANDARDS[standardKey];
        const impact = getImpactLevel(standard?.impact);
        
        return {
          issue: getIssueTitle(tag.label, tag.status),
          details: tag.message || getDefaultMessage(tag.label, tag.status),
          impact: impact,
          category: 'Open Graph Meta Tag'
        };
      });
    
    if (ogIssues.length > 0) {
      recommendations.push({
        category: 'Open Graph Meta Tag',
        items: ogIssues
      });
    }
  }
  
  // Twitter Card Meta Tags Issues
  if (metadata.twitterMeta && metadata.twitterMeta.some(tag => tag.status !== 'good')) {
    const twitterIssues = metadata.twitterMeta
      .filter(tag => tag.status !== 'good')
      .map(tag => {
        const standardKey = getStandardKey(tag.label);
        const standard = META_TAG_STANDARDS[standardKey];
        const impact = getImpactLevel(standard?.impact);
        
        return {
          issue: getIssueTitle(tag.label, tag.status),
          details: tag.message || getDefaultMessage(tag.label, tag.status),
          impact: impact,
          category: 'Twitter Card Meta Tag'
        };
      });
    
    if (twitterIssues.length > 0) {
      recommendations.push({
        category: 'Twitter Card Meta Tag',
        items: twitterIssues
      });
    }
  }
  
  // Canonical URL Issues
  if (!metadata.canonicalUrl) {
    recommendations.push({
      category: 'Canonical URL',
      items: [{
        issue: 'Missing Canonical URL',
        details: 'Add canonical URL to prevent duplicate content issues and improve SEO.',
        impact: 'High',
        category: 'Canonical URL'
      }]
    });
  }
  
  // Schema.org Issues
  if (!metadata.schemaData || metadata.schemaData.length === 0 || metadata.schemaData.some(s => !s.valid)) {
    const schemaStatus = (!metadata.schemaData || metadata.schemaData.length === 0) ? 'missing' : 'invalid';
    
    recommendations.push({
      category: 'Schema.org Data',
      items: [{
        issue: schemaStatus === 'missing' ? 'Missing Schema.org Markup' : 'Invalid Schema.org Markup',
        details: schemaStatus === 'missing' ? 
          'Add structured data markup to help search engines understand your content and enable rich results.' :
          'Fix invalid structured data markup to ensure proper search engine interpretation.',
        impact: 'Medium',
        category: 'Schema.org Data'
      }]
    });
  }
  
  return recommendations;
}

/**
 * Helper function to get the standard key for a tag label
 * @param {string} label - The tag label
 * @returns {string} The standard key
 */
function getStandardKey(label) {
  const mapping = {
    'Title': 'title',
    'Description': 'description',
    'Keywords': 'keywords',
    'Viewport': 'viewport',
    'Robots': 'robots',
    'og:title': 'ogTitle',
    'og:description': 'ogDescription',
    'og:image': 'ogImage',
    'og:url': 'ogUrl',
    'og:type': 'ogType',
    'og:site_name': 'ogSiteName',
    'twitter:card': 'twitterCard',
    'twitter:title': 'twitterTitle',
    'twitter:description': 'twitterDescription',
    'twitter:image': 'twitterImage',
    'twitter:site': 'twitterSite'
  };
  
  return mapping[label] || label.toLowerCase();
}

/**
 * Helper function to get impact level
 * @param {string} impact - The impact from standards
 * @returns {string} Formatted impact level
 */
function getImpactLevel(impact) {
  if (impact === 'high') return 'High';
  if (impact === 'medium') return 'Medium';
  if (impact === 'low') return 'Low';
  return 'Medium'; // default
}

/**
 * Helper function to get issue title based on tag and status
 * @param {string} label - The tag label
 * @param {string} status - The tag status
 * @returns {string} Issue title
 */
function getIssueTitle(label, status) {
  if (status === 'error') {
    return `Missing ${label}`;
  } else if (status === 'warning') {
    return `Optimize ${label}`;
  }
  return `Fix ${label}`;
}

/**
 * Helper function to get default message if none provided
 * @param {string} label - The tag label
 * @param {string} status - The tag status
 * @returns {string} Default message
 */
function getDefaultMessage(label, status) {
  if (status === 'error') {
    return `${label} is missing and should be added for better SEO.`;
  } else if (status === 'warning') {
    return `${label} needs optimization to meet SEO best practices.`;
  }
  return `${label} has issues that should be addressed.`;
}

/**
 * REPLACE the updateSchemaData function in content.js with this:
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
  
  const schemaTooltip = "Schema.org markup is structured data that helps search engines understand your content.";
  
  schemaData.forEach((schema, index) => {
    if (schema.valid && schema.data) {
      // Create a section for each schema item
      const schemaSection = document.createElement('div');
      schemaSection.className = 'schema-item';
      if (index > 0) schemaSection.style.marginTop = '1.5rem';
      
      // Properties to check in order
      const propertiesToCheck = [
        { key: '@type', label: '@type' },
        { key: 'url', label: 'url' },
        { key: 'name', label: 'name' },
        { key: 'description', label: 'description' },
        { key: 'datePublished', label: 'datePublished' },
        { key: 'dateModified', label: 'dateModified' },
        { key: 'author', label: 'author name', isAuthor: true }
      ];
      
      // Check each property and add rows for ones that have values
      propertiesToCheck.forEach(prop => {
        let value = getPropertyValue(schema.data, prop);
        
        if (value) {
          const row = document.createElement('div');
          row.className = 'meta-row';
          
          row.innerHTML = `
            <div class="meta-cell name">${prop.label}</div>
            <div class="meta-cell value">${value}</div>
            <div class="meta-cell status">
              <span class="status-badge good" data-tooltip="${schemaTooltip}">
                Present
                <svg class="info-icon" width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2"/>
                  <rect x="9" y="8" width="2" height="5" rx="1" fill="currentColor"/>
                  <rect x="9" y="5" width="2" height="2" rx="1" fill="currentColor"/>
                </svg>
              </span>
            </div>
          `;
          
          schemaSection.appendChild(row);
        }
      });
      
      // Only add the section if it has at least one property
      if (schemaSection.children.length > 0) {
        container.appendChild(schemaSection);
      }
    }
  });
  
  // Add separator styling between schema items
  if (container.children.length > 1) {
    Array.from(container.children).forEach((child, index) => {
      if (index > 0) {
        child.style.borderTop = '2px solid var(--border-light)';
        child.style.paddingTop = '1rem';
      }
    });
  }
  
  // Initialize tooltips after updating the badges
  initTooltips();
}

/**
 * ADD this new helper function to content.js:
 */
function getPropertyValue(data, prop) {
  let value = data[prop.key];
  
  if (!value) return null;
  
  // Handle @type specifically
  if (prop.key === '@type') {
    return Array.isArray(value) ? value.join(', ') : value;
  }
  
  // Handle author name extraction
  if (prop.isAuthor) {
    return extractAuthorName(value);
  }
  
  // Handle regular properties
  if (typeof value === 'string') {
    return value;
  }
  
  if (typeof value === 'object' && value !== null) {
    // If it's an object, try to get name or @id
    if (value.name) return value.name;
    if (value['@id']) return value['@id'];
    if (value.url) return value.url;
    return '[Object]';
  }
  
  return String(value);
}

/**
 * ADD this new helper function to content.js:
 */
function extractAuthorName(authorData) {
  if (!authorData) return null;
  
  // If it's a string, return it directly
  if (typeof authorData === 'string') {
    return authorData;
  }
  
  // If it's an array, process each author
  if (Array.isArray(authorData)) {
    const names = authorData.map(author => {
      if (typeof author === 'string') return author;
      if (author.name) return author.name;
      if (author.givenName && author.familyName) {
        return `${author.givenName} ${author.familyName}`;
      }
      if (author.givenName) return author.givenName;
      if (author.familyName) return author.familyName;
      return null;
    }).filter(name => name);
    
    return names.length > 0 ? names.join(', ') : null;
  }
  
  // If it's an object, extract name
  if (typeof authorData === 'object') {
    if (authorData.name) return authorData.name;
    if (authorData.givenName && authorData.familyName) {
      return `${authorData.givenName} ${authorData.familyName}`;
    }
    if (authorData.givenName) return authorData.givenName;
    if (authorData.familyName) return authorData.familyName;
  }
  
  return null;
}

/**
 * Initialize tooltips with performance improvements - FIXED
 */
function initTooltips() {
  // Create global tooltip element if it doesn't exist
  let globalTooltip = document.getElementById('global-tooltip');
  if (!globalTooltip) {
    globalTooltip = document.createElement('div');
    globalTooltip.id = 'global-tooltip';
    globalTooltip.style.cssText = 'position: fixed; pointer-events: none; z-index: 99999; display: none;';
    document.body.appendChild(globalTooltip);
  }

  const statusBadges = document.querySelectorAll('.status-badge[data-tooltip]');
  
  statusBadges.forEach(badge => {
    // Check if we already have listeners using WeakMap
    if (window.MetaPeek.tooltipListeners.has(badge)) {
      return; // Skip if already has listeners
    }
    
    const handleMouseEnter = function() {
      const tooltipText = this.getAttribute('data-tooltip');
      if (!tooltipText) return;
      
      const rect = this.getBoundingClientRect();
      const containerRect = document.documentElement.getBoundingClientRect();
      
      globalTooltip.textContent = tooltipText;
      globalTooltip.style.display = 'block';
      
      const tooltipRect = globalTooltip.getBoundingClientRect();
      const top = rect.bottom + 5;
      let left = rect.left - containerRect.left + (rect.width / 2) - (tooltipRect.width / 2);
      
      // Adjust if tooltip would go off screen horizontally
      if (left < 10) {
        left = 10;
      } else if (left + tooltipRect.width > containerRect.width - 10) {
        left = containerRect.width - tooltipRect.width - 10;
      }
      
      globalTooltip.style.left = `${left + containerRect.left}px`;
      globalTooltip.style.top = `${top + containerRect.top}px`;
    };
    
    const handleMouseLeave = function() {
      globalTooltip.style.display = 'none';
      globalTooltip.textContent = '';
    };
    
    badge.addEventListener('mouseenter', handleMouseEnter);
    badge.addEventListener('mouseleave', handleMouseLeave);
    
    // Store listeners in WeakMap
    window.MetaPeek.tooltipListeners.set(badge, { handleMouseEnter, handleMouseLeave });
  });
}

// Add cleanup on page unload
window.addEventListener('beforeunload', cleanup);

// Initialize on load
initializeMetaPeek();
setupMessageListener();