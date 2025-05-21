/**
 * MetaPeek Content Script
 * Extracts and analyzes metadata from web pages
 */

console.log('MetaPeek content script initialized');

// Initialize the MetaPeek namespace
window.MetaPeek = window.MetaPeek || {
  initialized: false,
  observer: null,
  metadata: null
};

/**
 * Enhanced Meta Tag Validation for MetaPeek
 * 
 * This code implements comprehensive validation for all meta tags according to
 * industry standards. It includes validation for:
 * - Basic meta tags (title, description, keywords, etc.)
 * - Open Graph tags (og:title, og:description, og:image, etc.)
 * - Twitter Card tags (twitter:card, twitter:title, etc.)
 * - Canonical URL
 * - Schema.org structured data
 */

// First, let's define comprehensive standards for ALL meta tags
const META_TAG_STANDARDS = {
  // Basic Meta Tags
  title: { 
    min: 30, 
    max: 60, 
    required: true,
    message: {
      missing: "Title tag is required for SEO",
      tooShort: "Title too short (under 30 chars); may not be impactful in search results",
      tooLong: "Title too long (over 60 chars); will be truncated in search results",
      good: "Title length is optimal for search engines"
    }
  },
  description: { 
    min: 120, 
    max: 160, 
    required: true,
    message: {
      missing: "Meta description is highly recommended for SEO",
      tooShort: "Description too short (under 120 chars); add more relevant content",
      tooLong: "Description too long (over 160 chars); will be truncated in search results",
      good: "Description length is optimal for search engines"
    }
  },
  keywords: { 
    required: false,
    max: 10, // Maximum number of keywords/phrases recommended
    message: {
      missing: "Keywords tag is optional but helpful",
      tooMany: "Too many keywords may dilute relevance",
      good: "Good keyword definition"
    }
  },
  viewport: { 
    required: true,
    recommended: "width=device-width, initial-scale=1",
    message: {
      missing: "Viewport meta tag is required for responsive design",
      invalid: "Viewport should include width=device-width for responsiveness",
      good: "Viewport properly configured for responsive design"
    }
  },
  robots: { 
    required: false,
    // Expanded list of valid robot directives including modern values
    valid: [
      // Basic directives
      "index", "noindex", "follow", "nofollow", "none", "noarchive", 
      "nosnippet", "notranslate", "noimageindex", "unavailable_after",
      // Modern Google directives
      "max-image-preview:large", "max-image-preview:standard", "max-image-preview:none",
      "max-snippet:-1", "max-snippet:0", 
      "max-video-preview:-1", "max-video-preview:0",
      // Additional valid directives
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
    min: 30, 
    max: 90, 
    required: true,
    message: {
      missing: "og:title is required for social sharing",
      tooShort: "og:title too short (under 30 chars)",
      tooLong: "og:title too long (over 90 chars); may be truncated on social media",
      good: "og:title length is good for social sharing"
    }
  },
  ogDescription: { 
    min: 120, 
    max: 200, 
    required: true,
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
    message: {
      missing: "og:image is required for attractive social sharing",
      tooSmall: "og:image is smaller than recommended (1200×630px)",
      good: "og:image is properly defined"
    }
  },
  ogUrl: {
    required: true,
    message: {
      missing: "og:url is required for proper social sharing links",
      invalid: "og:url should be a valid, absolute URL",
      good: "og:url properly defined"
    }
  },
  ogType: {
    required: true,
    recommended: ["website", "article", "book", "profile", "music.song", "music.album", "music.playlist", "video.movie", "video.tv_show"],
    message: {
      missing: "og:type is required for Open Graph markup",
      invalid: "og:type should be a standard type (website, article, etc.)",
      good: "og:type properly defined"
    }
  },
  ogSiteName: {
    required: true,
    message: {
      missing: "og:site_name is recommended for brand recognition",
      good: "og:site_name properly defined"
    }
  },
  
  // Twitter Card Tags
  twitterCard: {
    required: true,
    valid: ["summary", "summary_large_image", "app", "player"],
    message: {
      missing: "twitter:card is required for Twitter sharing",
      invalid: "twitter:card must be a valid card type",
      good: "twitter:card properly defined"
    }
  },
  twitterTitle: {
    min: 30, 
    max: 70, 
    required: true,
    message: {
      missing: "twitter:title is required for Twitter sharing",
      tooShort: "twitter:title too short (under 30 chars)",
      tooLong: "twitter:title too long (over 70 chars); may be truncated",
      good: "twitter:title length is good for Twitter"
    }
  },
  twitterDescription: {
    min: 120, 
    max: 200, 
    required: true,
    message: {
      missing: "twitter:description is required for Twitter sharing",
      tooShort: "twitter:description too short (under 120 chars)",
      tooLong: "twitter:description too long (over 200 chars); may be truncated",
      good: "twitter:description length is good for Twitter"
    }
  },
  twitterImage: {
    required: true,
    message: {
      missing: "twitter:image is required for attractive Twitter sharing",
      good: "twitter:image properly defined"
    }
  },
  twitterSite: {
    required: false,
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
    message: {
      missing: "Canonical URL is important for SEO to prevent duplicate content",
      mismatch: "Canonical URL doesn't match the current page URL",
      good: "Canonical URL properly defined"
    }
  }
};

const CACHE_DURATION = 120000; // 2 minutes in ms

/**
 * Initialize the MetaPeek observer and start collecting metadata
 */
function initializeMetaPeek() {
  if (window.MetaPeek.initialized) {
    console.log('MetaPeek already initialized');
    return;
  }
  
  console.log('Initializing MetaPeek');
  window.MetaPeek.initialized = true;
  
  try {
    // Create and configure mutation observer to watch for DOM changes
    window.MetaPeek.observer = new MutationObserver((mutations) => {
      // Only process if we have relevant mutations (childList changes)
      if (mutations.some(mutation => mutation.type === 'childList')) {
        try {
          const metadata = getPageMetadata();
          window.MetaPeek.metadata = metadata;
          
          // Wrap the message sending in a try-catch to handle context invalidation
          try {
            chrome.runtime.sendMessage({ type: 'metadataUpdated', metadata })
              .catch(error => {
                // Handle specific error cases
                if (error.message && error.message.includes('Extension context invalidated')) {
                  console.debug('Extension context invalidated, attempting to reconnect...');
                  // Attempt to reconnect by reinitializing
                  window.MetaPeek.initialized = false;
                  setTimeout(() => {
                    try {
                      initializeMetaPeek();
                    } catch (reinitError) {
                      console.debug('Failed to reconnect:', reinitError);
                    }
                  }, 1000); // Wait 1 second before attempting to reconnect
                } else {
                  console.error('Error sending metadata update:', error);
                }
              });
          } catch (error) {
            // Handle runtime errors (like context invalidation)
            if (error.message && error.message.includes('Extension context invalidated')) {
              console.debug('Extension context invalidated, attempting to reconnect...');
              window.MetaPeek.initialized = false;
              setTimeout(() => {
                try {
                  initializeMetaPeek();
                } catch (reinitError) {
                  console.debug('Failed to reconnect:', reinitError);
                }
              }, 1000);
            } else {
              console.error('Runtime error sending metadata update:', error);
            }
          }
        } catch (error) {
          console.error('Error processing metadata:', error);
        }
      }
    });
    
    // Start observing
    window.MetaPeek.observer.observe(document.documentElement, { 
      childList: true, 
      subtree: true 
    });
    
    console.log('MetaPeek observer started');
    
    // Collect initial metadata
    try {
      const metadata = getPageMetadata();
      window.MetaPeek.metadata = metadata;
      console.log('Initial metadata collected');
      
      // Send initial metadata
      try {
        chrome.runtime.sendMessage({ type: 'metadataUpdated', metadata })
          .catch(error => {
            if (error.message && error.message.includes('Extension context invalidated')) {
              console.debug('Extension context invalidated during initial metadata send');
              // Attempt to reconnect
              window.MetaPeek.initialized = false;
              setTimeout(() => {
                try {
                  initializeMetaPeek();
                } catch (reinitError) {
                  console.debug('Failed to reconnect:', reinitError);
                }
              }, 1000);
            } else {
              console.error('Error sending initial metadata:', error);
            }
          });
      } catch (error) {
        if (error.message && error.message.includes('Extension context invalidated')) {
          console.debug('Extension context invalidated during initial metadata send');
          // Attempt to reconnect
          window.MetaPeek.initialized = false;
          setTimeout(() => {
            try {
              initializeMetaPeek();
            } catch (reinitError) {
              console.debug('Failed to reconnect:', reinitError);
            }
          }, 1000);
        } else {
          console.error('Runtime error sending initial metadata:', error);
        }
      }
    } catch (error) {
      console.error('Error collecting initial metadata:', error);
    }
  } catch (error) {
    console.error('Error initializing MetaPeek:', error);
    // Reset initialization flag to allow retry
    window.MetaPeek.initialized = false;
  }
}

/**
 * Message handler for communication with popup and background scripts
 */
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received in content script:', request.type);
    
    try {
      switch (request.type) {
        case 'getMetadata':
          handleGetMetadataRequest(sendResponse);
          break;
          
        case 'getSEOHealth':
          handleSEOHealthRequest(sendResponse);
          break;
          
        default:
          console.warn('Unknown message type received:', request.type);
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.debug('Extension context invalidated during message handling');
        // Attempt to reconnect
        window.MetaPeek.initialized = false;
        setTimeout(() => {
          try {
            initializeMetaPeek();
          } catch (reinitError) {
            console.debug('Failed to reconnect:', reinitError);
          }
        }, 1000);
        sendResponse({ error: 'Extension context invalidated, attempting to reconnect' });
      } else {
        sendResponse({ error: error.message });
      }
    }
    
    // Keep the message channel open for async responses
    return true;
  });
}

/**
 * Handle getMetadata request from popup
 * @param {Function} sendResponse - Function to send response back to requester
 */
function handleGetMetadataRequest(sendResponse) {
  console.log('Processing getMetadata request');
  
  // Always collect fresh metadata when requested
  const metadata = getPageMetadata();
  
  // Cache it for later use
  window.MetaPeek.metadata = metadata;
  
  console.log('Sending metadata response');
  sendResponse(metadata);
}

/**
 * Handle getSEOHealth request from popup
 * @param {Function} sendResponse - Function to send response back to requester
 */
function handleSEOHealthRequest(sendResponse) {
  console.log('Processing getSEOHealth request');
  
  const metadata = getPageMetadata();
  const seoHealth = calculateSEOHealthScore(metadata);
  
  console.log('Sending SEO health response');
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
    schemaData: []
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
    console.error('Error in getPageMetadata:', error);
    return metadata;
  }
}

/**
 * Enhanced extraction and validation of basic meta tags
 * @param {Object} metadata - Metadata object to populate
 */
function extractBasicMetaTags(metadata) {
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
}

/**
 * Enhanced extraction and validation of Open Graph tags
 * @param {Object} metadata - Metadata object to populate
 */
function extractOpenGraphTags(metadata) {
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
}

/**
 * Enhanced extraction and validation of Twitter Card tags
 * @param {Object} metadata - Metadata object to populate
 */
function extractTwitterCardTags(metadata) {
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
}

/**
 * Enhanced validation of canonical URL
 * @param {Object} metadata - Metadata object to populate
 */
function validateCanonicalUrl(metadata) {
  const canonicalLink = document.querySelector('link[rel="canonical"]');
  const canonicalUrl = canonicalLink?.href || '';
  
  // Set initial values
  metadata.canonicalMeta = {
    value: canonicalUrl,
    status: 'error',
    message: META_TAG_STANDARDS.canonical.message.missing
  };
  
  if (canonicalUrl) {
    // Check if canonical URL matches the current page URL
    const currentUrl = window.location.href.split('#')[0].split('?')[0];
    const canonicalNormalized = canonicalUrl.split('#')[0].split('?')[0];
    
    if (currentUrl !== canonicalNormalized) {
      metadata.canonicalMeta.status = 'warning';
      metadata.canonicalMeta.message = META_TAG_STANDARDS.canonical.message.mismatch;
    } else {
      metadata.canonicalMeta.status = 'good';
      metadata.canonicalMeta.message = META_TAG_STANDARDS.canonical.message.good;
    }
  }
  
  return metadata;
}

/**
 * Extract Schema.org data from the page
 * @param {Object} metadata - Metadata object to populate
 */
function extractSchemaData(metadata) {
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
}

/**
 * Helper function to find schema types recursively
 * @param {Object} obj - The object to search within
 * @param {Array} schemas - Accumulator for found schemas
 * @returns {Array} Array of found schemas
 */
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

/**
 * Helper function to check if schema is relevant to current page
 * @param {Object} obj - Schema.org object
 * @param {string} currentUrl - Current page URL
 * @returns {boolean} True if the schema is relevant to the current page
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
 * Calculate SEO health score based on metadata
 * @param {Object} metadata - The metadata to score
 * @returns {Object} SEO health score results
 */
function calculateSEOHealthScore(metadata) {
  // Define scoring weights for different categories
  const weights = {
    basicMeta: 0.35,    // 35% of score
    socialMeta: 0.25,   // 25% of score
    technical: 0.25,    // 25% of score 
    content: 0.15       // 15% of score
  };
  
  // Initialize category scores
  let scores = {
    basicMeta: 0,
    socialMeta: 0,
    technical: 0,
    content: 0
  };
  
  // Score basic meta tags
  if (metadata.basicMeta && metadata.basicMeta.length > 0) {
    const basicMetaItems = metadata.basicMeta.length;
    const goodItems = metadata.basicMeta.filter(tag => tag.status === 'good').length;
    scores.basicMeta = goodItems / basicMetaItems;
  }
  
  // Score social meta tags (OG + Twitter)
  if (metadata.ogMeta && metadata.twitterMeta) {
    const ogItems = metadata.ogMeta.length;
    const twitterItems = metadata.twitterMeta.length;
    const totalItems = ogItems + twitterItems;
    
    const goodOgItems = metadata.ogMeta.filter(tag => tag.status === 'good').length;
    const goodTwitterItems = metadata.twitterMeta.filter(tag => tag.status === 'good').length;
    
    scores.socialMeta = (goodOgItems + goodTwitterItems) / totalItems;
  }
  
  // Score technical factors
  let technicalScore = 0;
  let technicalFactors = 0;
  
  // Check canonical URL
  if (metadata.canonicalUrl) {
    technicalScore += 1;
    technicalFactors += 1;
  }
  
  // Check schema
  if (metadata.schemaData && metadata.schemaData.length > 0) {
    technicalScore += metadata.schemaData.every(s => s.valid) ? 1 : 0.5;
    technicalFactors += 1;
  }
  
  scores.technical = technicalFactors > 0 ? technicalScore / technicalFactors : 0;
  
  // Default content score
  scores.content = 0.7;
  
  // Calculate overall weighted score
  const overallScore = Object.entries(weights).reduce(
    (total, [category, weight]) => total + (scores[category] * weight),
    0
  );
  
  // Scale to 0-100
  const scaledScore = Math.round(overallScore * 100);
  
  // Generate recommendations
  const recommendations = generateRecommendations(metadata);
  
  // Return combined score data
  return {
    score: scaledScore,
    categoryScores: scores,
    recommendations: recommendations,
    status: scaledScore >= 80 ? 'good' : scaledScore >= 60 ? 'warning' : 'error'
  };
}

/**
 * Generate SEO recommendations based on metadata
 * @param {Object} metadata - The metadata to analyze
 * @returns {Array} Array of recommendation categories
 */
function generateRecommendations(metadata) {
  const recommendations = [];
  
  // Add basic meta tag recommendations
  if (metadata.basicMeta && metadata.basicMeta.some(tag => tag.status !== 'good')) {
    recommendations.push({
      category: 'Basic Meta Tags',
      items: metadata.basicMeta
        .filter(tag => tag.status !== 'good')
        .map(tag => ({
          issue: `Optimize ${tag.label}`,
          details: tag.message,
          impact: tag.label === 'Title' || tag.label === 'Description' ? 'High' : 'Medium'
        }))
    });
  }
  
  // Add Open Graph recommendations
  if (metadata.ogMeta && metadata.ogMeta.some(tag => tag.status !== 'good')) {
    recommendations.push({
      category: 'Open Graph Tags',
      items: metadata.ogMeta
        .filter(tag => tag.status !== 'good')
        .map(tag => ({
          issue: `Optimize ${tag.label}`,
          details: tag.message,
          impact: tag.label === 'og:title' || tag.label === 'og:description' || tag.label === 'og:image' ? 'High' : 'Medium'
        }))
    });
  }
  
  // Add Twitter Card recommendations
  if (metadata.twitterMeta && metadata.twitterMeta.some(tag => tag.status !== 'good')) {
    recommendations.push({
      category: 'Twitter Card Tags',
      items: metadata.twitterMeta
        .filter(tag => tag.status !== 'good')
        .map(tag => ({
          issue: `Optimize ${tag.label}`,
          details: tag.message,
          impact: tag.label === 'twitter:title' || tag.label === 'twitter:description' || tag.label === 'twitter:image' ? 'High' : 'Medium'
        }))
    });
  }
  
  // Add canonical URL recommendation if missing
  if (!metadata.canonicalUrl) {
    recommendations.push({
      category: 'Technical SEO',
      items: [{
        issue: 'Add Canonical URL',
        details: 'Canonical URL is missing. This is important to prevent duplicate content issues.',
        impact: 'High'
      }]
    });
  }
  
  // Add schema.org recommendation if missing or invalid
  if (!metadata.schemaData || metadata.schemaData.length === 0 || metadata.schemaData.some(s => !s.valid)) {
    recommendations.push({
      category: 'Structured Data',
      items: [{
        issue: 'Implement Schema.org Markup',
        details: 'Schema.org structured data is missing or invalid. Adding proper structured data can improve search engine understanding of your content.',
        impact: 'Medium'
      }]
    });
  }
  
  return recommendations;
}

// Initialize on load
initializeMetaPeek();
setupMessageListener(); 