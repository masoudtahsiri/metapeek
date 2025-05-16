/**
 * MetaPeek Content Script
 * Extracts and analyzes metadata from web pages
 */

console.log('MetaPeek content script initialized');

// Initialize the MetaPeek namespace
window.MetaPeek = window.MetaPeek || {
  initialized: false,
  observer: null,
  webVitalsInitialized: false,
  cachedMetrics: null,
  lastMetricsUpdate: 0,
  metadata: null
};

/**
 * Constants
 */
const META_TAG_STANDARDS = {
  title: { min: 30, max: 60 },
  description: { min: 120, max: 160 },
  ogTitle: { min: 30, max: 90 },
  ogDescription: { min: 120, max: 200 }
};

const WEB_VITALS_THRESHOLDS = {
  lcp: [2500, 4000],     // LCP thresholds in ms (good, poor)
  cls: [0.1, 0.25],      // CLS thresholds (good, poor)
  inp: [200, 500],       // INP thresholds in ms (good, poor)
  fcp: [1800, 3000],     // FCP thresholds in ms (good, poor)
  ttfb: [800, 1800]      // TTFB thresholds in ms (good, poor)
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
        const metadata = getPageMetadata();
        window.MetaPeek.metadata = metadata;
        chrome.runtime.sendMessage({ type: 'metadataUpdated', metadata })
          .catch(error => console.error('Error sending metadata update:', error));
      }
    });
    
    // Start observing
    window.MetaPeek.observer.observe(document.documentElement, { 
      childList: true, 
      subtree: true 
    });
    console.log('MetaPeek observer started');
    
    // Collect initial metadata
    const metadata = getPageMetadata();
    window.MetaPeek.metadata = metadata;
    console.log('Initial metadata collected');
  } catch (error) {
    console.error('Error initializing MetaPeek:', error);
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
          
        case 'initWebVitals':
          handleInitWebVitalsRequest(sendResponse);
          break;
          
        case 'getWebVitals':
          handleGetWebVitalsRequest(sendResponse);
          break;
          
        default:
          console.warn('Unknown message type received:', request.type);
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: error.message });
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
 * Handle initWebVitals request from popup
 * @param {Function} sendResponse - Function to send response back to requester
 */
function handleInitWebVitalsRequest(sendResponse) {
  console.log('Processing initWebVitals request');
  
  const metrics = initWebVitals();
  
  console.log('Sending web vitals init response');
  sendResponse({ 
    status: 'initialized',
    hasCachedMetrics: !!window.MetaPeek.cachedMetrics,
    metrics: metrics
  });
}

/**
 * Handle getWebVitals request from popup
 * @param {Function} sendResponse - Function to send response back to requester
 */
function handleGetWebVitalsRequest(sendResponse) {
  console.log('Processing getWebVitals request');
  
  if (window.MetaPeek.webVitalsInitialized) {
    console.log('Using cached web vitals');
    sendResponse({
      status: 'available',
      metrics: window.MetaPeek.cachedMetrics || window.metaPeekMetrics
    });
  } else {
    console.log('Initializing web vitals on demand');
    const metrics = initWebVitals();
    sendResponse({
      status: 'initialized',
      metrics: metrics
    });
  }
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
    performance: window.MetaPeek.cachedMetrics || { 
      metricsCollected: false,
      partialMetricsAvailable: false
    }
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
 * Extract basic meta tags from the page
 * @param {Object} metadata - Metadata object to populate
 */
function extractBasicMetaTags(metadata) {
  const title = document.querySelector('title')?.textContent || '';
  const description = document.querySelector('meta[name="description"]')?.content || '';
  const keywords = document.querySelector('meta[name="keywords"]')?.content || '';
  const viewport = document.querySelector('meta[name="viewport"]')?.content || '';
  const robots = document.querySelector('meta[name="robots"]')?.content || '';
  
  metadata.basicMeta = [
    { 
      label: 'Title', 
      value: title,
      status: title.length >= META_TAG_STANDARDS.title.min && 
              title.length <= META_TAG_STANDARDS.title.max ? 'good' : 'warning',
      message: title.length < META_TAG_STANDARDS.title.min ? 'Too short' : 
               title.length > META_TAG_STANDARDS.title.max ? 'Too long' : 'Good length'
    },
    { 
      label: 'Description', 
      value: description,
      status: description.length >= META_TAG_STANDARDS.description.min && 
              description.length <= META_TAG_STANDARDS.description.max ? 'good' : 'warning',
      message: description.length < META_TAG_STANDARDS.description.min ? 'Too short' : 
               description.length > META_TAG_STANDARDS.description.max ? 'Too long' : 'Good length'
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
}

/**
 * Extract Open Graph tags from the page
 * @param {Object} metadata - Metadata object to populate
 */
function extractOpenGraphTags(metadata) {
  const requiredOgTags = ['og:title', 'og:description', 'og:type', 'og:url', 'og:image', 'og:site_name'];
  
  metadata.ogMeta = requiredOgTags.map(tag => {
    const element = document.querySelector(`meta[property="${tag}"]`);
    const value = element?.content || '';
    const status = value === '' ? 'error' : 'good';
    const message = value === '' ? 'Required tag missing' : 'Present';
    
    return {
      label: tag,
      value: value,
      status: status,
      message: message
    };
  });
}

/**
 * Extract Twitter Card tags from the page
 * @param {Object} metadata - Metadata object to populate
 */
function extractTwitterCardTags(metadata) {
  const requiredTwitterTags = ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:site'];
  
  metadata.twitterMeta = requiredTwitterTags.map(tag => {
    const element = document.querySelector(`meta[name="${tag}"]`);
    const value = element?.content || '';
    const status = value === '' ? 'error' : 'good';
    const message = value === '' ? 'Required tag missing' : 'Present';
    
    return {
      label: tag,
      value: value,
      status: status,
      message: message
    };
  });
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
 * Initialize Web Vitals metrics collection
 * @returns {Object} Initial metrics object
 */
function initWebVitals() {
  // Don't re-initialize if already done with recent data
  if (window.MetaPeek.webVitalsInitialized && 
      window.MetaPeek.cachedMetrics && 
      (Date.now() - window.MetaPeek.lastMetricsUpdate < CACHE_DURATION)) {
    // Notify that we have metrics available
    chrome.runtime.sendMessage({ 
      type: 'webVitalsUpdate', 
      data: window.MetaPeek.cachedMetrics,
      cached: true
    }).catch(error => console.error('Error sending web vitals update:', error));
    
    return window.MetaPeek.cachedMetrics;
  }
  
  // Mark as initialized
  window.MetaPeek.webVitalsInitialized = true;
  
  // Create storage for metrics
  const metrics = {
    lcp: null,
    cls: null,
    inp: null,
    fcp: null, 
    ttfb: null,
    metricsCollected: false,
    partialMetricsAvailable: false,
    timestamp: Date.now()
  };
  
  window.metaPeekMetrics = metrics;
  
  // Function to notify about metrics updates
  function notifyMetricsUpdate(updatedMetrics, metricName) {
    // Mark that we have at least some metrics
    updatedMetrics.partialMetricsAvailable = true;
    
    // Cache the metrics
    window.MetaPeek.cachedMetrics = {...updatedMetrics};
    window.MetaPeek.lastMetricsUpdate = Date.now();
    
    // Send an update with the metric that changed
    chrome.runtime.sendMessage({ 
      type: 'webVitalsUpdate', 
      data: updatedMetrics,
      updatedMetric: metricName,
      cached: false
    }).catch(error => console.error('Error sending web vitals update:', error));
  }
  
  // Initialize Web Vitals collection
  initializeWebVitalsCollection(metrics, notifyMetricsUpdate);
  
  return metrics;
}

/**
 * Initialize Web Vitals collection using the web-vitals library or fallbacks
 * @param {Object} metrics - Metrics object to populate
 * @param {Function} notifyMetricsUpdate - Function to call when metrics are updated
 */
function initializeWebVitalsCollection(metrics, notifyMetricsUpdate) {
  // Check if web-vitals library is available
  if (typeof webVitals !== 'undefined') {
    try {
      // Fast metrics - collect these first
      
      // Time to First Byte (TTFB)
      webVitals.onTTFB(metric => {
        metrics.ttfb = metric.value;
        notifyMetricsUpdate(metrics, 'ttfb');
      });
      
      // First Contentful Paint (FCP)
      webVitals.onFCP(metric => {
        metrics.fcp = metric.value;
        notifyMetricsUpdate(metrics, 'fcp');
      });
      
      // Slower metrics - These take longer to calculate
      
      // Largest Contentful Paint (LCP)
      webVitals.onLCP(metric => {
        metrics.lcp = metric.value;
        metrics.metricsCollected = true;
        notifyMetricsUpdate(metrics, 'lcp');
      });
      
      // Cumulative Layout Shift (CLS)
      webVitals.onCLS(metric => {
        metrics.cls = metric.value;
        metrics.metricsCollected = true;
        notifyMetricsUpdate(metrics, 'cls');
      });
      
      // Interaction to Next Paint (INP)
      webVitals.onINP(metric => {
        metrics.inp = metric.value;
        metrics.metricsCollected = true;
        notifyMetricsUpdate(metrics, 'inp');
      });
      
      console.log('Web Vitals initialized successfully');
    } catch (error) {
      console.error('Error initializing Web Vitals:', error);
      usePerformanceAPIFallback(metrics, notifyMetricsUpdate);
    }
  } else {
    console.warn('Web Vitals library not available, using fallbacks');
    usePerformanceAPIFallback(metrics, notifyMetricsUpdate);
  }
}

/**
 * Use Performance API as fallback when web-vitals library is not available
 * @param {Object} metrics - Metrics object to populate
 * @param {Function} notifyMetricsUpdate - Function to call when metrics are updated
 */
function usePerformanceAPIFallback(metrics, notifyMetricsUpdate) {
  try {
    // Basic Performance API fallback for TTFB
    const navEntry = performance.getEntriesByType('navigation')[0];
    if (navEntry) {
      metrics.ttfb = navEntry.responseStart;
      notifyMetricsUpdate(metrics, 'ttfb');
    }
    
    // Use Performance Observer for FCP at minimum
    const paintObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          metrics.fcp = entry.startTime;
          notifyMetricsUpdate(metrics, 'fcp');
        }
      }
    });
    
    paintObserver.observe({ entryTypes: ['paint'] });
    
    // Disconnect after 10 seconds to avoid memory leaks
    setTimeout(() => {
      paintObserver.disconnect();
    }, 10000);
    
  } catch (e) {
    console.error('Error with Performance API fallback:', e);
  }
}

/**
 * Calculate SEO health score based on metadata
 * @param {Object} metadata - The metadata to score
 * @returns {Object} SEO health score results
 */
function calculateSEOHealthScore(metadata) {
  // Define scoring weights for different categories
  const weights = {
    basicMeta: 0.25,    // 25% of score
    socialMeta: 0.20,   // 20% of score
    technical: 0.20,    // 20% of score 
    content: 0.20,      // 20% of score
    performance: 0.15   // 15% of score
  };
  
  // Initialize category scores
  let scores = {
    basicMeta: 0,
    socialMeta: 0,
    technical: 0,
    content: 0,
    performance: 0
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
  
  // Calculate performance score if metrics are available
  if (metadata.performance && metadata.performance.metricsCollected) {
    scores.performance = calculatePerformanceScore(metadata.performance);
  } else {
    scores.performance = 0.5; // Default fallback
  }
  
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
  
  // Add basic recommendations based on metadata
  if (metadata.basicMeta.some(tag => tag.status !== 'good')) {
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
  
  // Add performance recommendations if metrics are available
  if (metadata.performance && metadata.performance.metricsCollected) {
    const performanceIssues = [];
    
    // LCP recommendations
    if (metadata.performance.lcp > WEB_VITALS_THRESHOLDS.lcp[1]) {
      performanceIssues.push({
        issue: 'Improve Largest Contentful Paint (LCP)',
        details: `Current LCP is ${(metadata.performance.lcp/1000).toFixed(2)}s. Aim for under 2.5s.`,
        impact: 'High'
      });
    } else if (metadata.performance.lcp > WEB_VITALS_THRESHOLDS.lcp[0]) {
      performanceIssues.push({
        issue: 'Optimize Largest Contentful Paint (LCP)',
        details: `Current LCP is ${(metadata.performance.lcp/1000).toFixed(2)}s. Consider optimizing for better performance.`,
        impact: 'Medium'
      });
    }
    
    // CLS recommendations
    if (metadata.performance.cls > WEB_VITALS_THRESHOLDS.cls[1]) {
      performanceIssues.push({
        issue: 'Fix Cumulative Layout Shift (CLS)',
        details: `Current CLS is ${metadata.performance.cls.toFixed(3)}. Aim for under 0.1.`,
        impact: 'High'
      });
    } else if (metadata.performance.cls > WEB_VITALS_THRESHOLDS.cls[0]) {
      performanceIssues.push({
        issue: 'Improve Cumulative Layout Shift (CLS)',
        details: `Current CLS is ${metadata.performance.cls.toFixed(3)}. Consider optimizing for better stability.`,
        impact: 'Medium'
      });
    }
    
    // INP recommendations
    if (metadata.performance.inp > WEB_VITALS_THRESHOLDS.inp[1]) {
      performanceIssues.push({
        issue: 'Fix Interaction to Next Paint (INP)',
        details: `Current INP is ${metadata.performance.inp.toFixed(0)}ms. Aim for under 200ms.`,
        impact: 'High'
      });
    } else if (metadata.performance.inp > WEB_VITALS_THRESHOLDS.inp[0]) {
      performanceIssues.push({
        issue: 'Improve Interaction to Next Paint (INP)',
        details: `Current INP is ${metadata.performance.inp.toFixed(0)}ms. Consider optimizing for better interactivity.`,
        impact: 'Medium'
      });
    }
    
    // Add performance category if there are issues
    if (performanceIssues.length > 0) {
      recommendations.push({
        category: 'Performance',
        items: performanceIssues
      });
    }
  }
  
  return recommendations;
}

/**
 * Calculate performance score based on Core Web Vitals
 * @param {Object} metrics - Web vitals metrics
 * @returns {number} Performance score (0-1)
 */
function calculatePerformanceScore(metrics) {
  if (!metrics || (!metrics.metricsCollected && !metrics.partialMetricsAvailable)) {
    return 0.5; // Default score if no metrics
  }

  let score = 0;
  let weightSum = 0;
  
  // Define metric scoring functions
  const metricScorers = {
    // LCP scoring (25% of score)
    lcp: {
      weight: 0.25,
      scorer: (value) => {
        if (value <= WEB_VITALS_THRESHOLDS.lcp[0]) return 1;
        if (value <= WEB_VITALS_THRESHOLDS.lcp[1]) {
          // Linear scale between thresholds
          return 1 - ((value - WEB_VITALS_THRESHOLDS.lcp[0]) / 
                      (WEB_VITALS_THRESHOLDS.lcp[1] - WEB_VITALS_THRESHOLDS.lcp[0]));
        }
        return 0;
      }
    },
    
    // CLS scoring (15% of score)
    cls: {
      weight: 0.15,
      scorer: (value) => {
        if (value <= WEB_VITALS_THRESHOLDS.cls[0]) return 1;
        if (value <= WEB_VITALS_THRESHOLDS.cls[1]) {
          // Linear scale between thresholds
          return 1 - ((value - WEB_VITALS_THRESHOLDS.cls[0]) / 
                      (WEB_VITALS_THRESHOLDS.cls[1] - WEB_VITALS_THRESHOLDS.cls[0]));
        }
        return 0;
      }
    },
    
    // INP scoring (15% of score)
    inp: {
      weight: 0.15,
      scorer: (value) => {
        if (value <= WEB_VITALS_THRESHOLDS.inp[0]) return 1;
        if (value <= WEB_VITALS_THRESHOLDS.inp[1]) {
          // Linear scale between thresholds
          return 1 - ((value - WEB_VITALS_THRESHOLDS.inp[0]) / 
                      (WEB_VITALS_THRESHOLDS.inp[1] - WEB_VITALS_THRESHOLDS.inp[0]));
        }
        return 0;
      }
    },
    
    // FCP scoring (10% of score)
    fcp: {
      weight: 0.10,
      scorer: (value) => {
        if (value <= WEB_VITALS_THRESHOLDS.fcp[0]) return 1;
        if (value <= WEB_VITALS_THRESHOLDS.fcp[1]) {
          // Linear scale between thresholds
          return 1 - ((value - WEB_VITALS_THRESHOLDS.fcp[0]) / 
                      (WEB_VITALS_THRESHOLDS.fcp[1] - WEB_VITALS_THRESHOLDS.fcp[0]));
        }
        return 0;
      }
    },
    
    // TTFB scoring (10% of score)
    ttfb: {
      weight: 0.10,
      scorer: (value) => {
        if (value <= WEB_VITALS_THRESHOLDS.ttfb[0]) return 1;
        if (value <= WEB_VITALS_THRESHOLDS.ttfb[1]) {
          // Linear scale between thresholds
          return 1 - ((value - WEB_VITALS_THRESHOLDS.ttfb[0]) / 
                      (WEB_VITALS_THRESHOLDS.ttfb[1] - WEB_VITALS_THRESHOLDS.ttfb[0]));
        }
        return 0;
      }
    }
  };
  
  // Calculate score for each available metric
  for (const [metricName, config] of Object.entries(metricScorers)) {
    if (metrics[metricName] !== null && metrics[metricName] !== undefined) {
      const metricScore = config.scorer(metrics[metricName]);
      score += metricScore * config.weight;
      weightSum += config.weight;
    }
  }
  
  // Scale the score based on available metrics
  return weightSum > 0 ? score / weightSum : 0.5;
}

// Initialize on load
initializeMetaPeek();
setupMessageListener(); 