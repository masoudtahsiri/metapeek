// Add more detailed logging to content.js
console.log('MetaPeek content script loaded');

// Add this to the top of the content script
window.MetaPeek = window.MetaPeek || {
  initialized: false,
  observer: null,
  webVitalsInitialized: false,
  cachedMetrics: null,
  lastMetricsUpdate: 0
};

// Add more robust initialization
console.log('Initializing MetaPeek...');
if (!window.MetaPeek.initialized) {
  console.log('First initialization of MetaPeek');
  window.MetaPeek.initialized = true;
  
  // Initialize observer and metadata immediately
  window.MetaPeek.observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        const metadata = getPageMetadata();
        window.MetaPeek.metadata = metadata;
        chrome.runtime.sendMessage({ type: 'metadataUpdated', metadata });
      }
    });
  });
  
  // Start observing immediately
  try {
    window.MetaPeek.observer.observe(document.documentElement, { 
      childList: true, 
      subtree: true 
    });
    console.log('MetaPeek observer started');
  } catch (e) {
    console.error('Failed to start MetaPeek observer', e);
  }
  
  // Collect initial metadata
  try {
    console.log('Collecting initial metadata');
    const metadata = getPageMetadata();
    window.MetaPeek.metadata = metadata;
    console.log('Initial metadata collected:', metadata);
  } catch (e) {
    console.error('Error collecting initial metadata', e);
  }
}

// Enhance the message listener with better debugging
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in content script:', request);
  
  try {
    if (request.type === 'getMetadata') {
      console.log('Processing getMetadata request');
      
      // Always collect fresh metadata when requested
      const metadata = getPageMetadata();
      
      // Cache it for later use
      window.MetaPeek.metadata = metadata;
      
      console.log('Sending metadata response:', metadata);
      sendResponse(metadata);
    } else if (request.type === 'getSEOHealth') {
      console.log('Processing getSEOHealth request');
      
      const metadata = getPageMetadata();
      const seoHealth = calculateSEOHealthScore(metadata);
      
      console.log('Sending SEO health response:', seoHealth);
      sendResponse(seoHealth);
    } else if (request.type === 'initWebVitals') {
      console.log('Processing initWebVitals request');
      
      const metrics = initWebVitals();
      
      console.log('Sending web vitals init response');
      sendResponse({ 
        status: 'initialized',
        hasCachedMetrics: !!window.MetaPeek.cachedMetrics,
        metrics: metrics
      });
    } else if (request.type === 'getWebVitals') {
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
    } else {
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

// SEO Health Score calculation function
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
  
  // Default content and performance scores
  scores.content = 0.7;
  
  // Handle performance score and recommendations
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
    const perfScore = calculatePerformanceScore(metadata.performance);
    scores.performance = perfScore !== null ? perfScore : 0.5;
    
    // Add performance recommendations
    const performanceIssues = [];
    
    // LCP recommendations
    if (metadata.performance.lcp > 4000) {
      performanceIssues.push({
        issue: 'Improve Largest Contentful Paint (LCP)',
        details: `Current LCP is ${(metadata.performance.lcp/1000).toFixed(2)}s. Aim for under 2.5s.`,
        impact: 'High'
      });
    } else if (metadata.performance.lcp > 2500) {
      performanceIssues.push({
        issue: 'Optimize Largest Contentful Paint (LCP)',
        details: `Current LCP is ${(metadata.performance.lcp/1000).toFixed(2)}s. Consider optimizing for better performance.`,
        impact: 'Medium'
      });
    }
    
    // CLS recommendations
    if (metadata.performance.cls > 0.25) {
      performanceIssues.push({
        issue: 'Fix Cumulative Layout Shift (CLS)',
        details: `Current CLS is ${metadata.performance.cls.toFixed(3)}. Aim for under 0.1.`,
        impact: 'High'
      });
    } else if (metadata.performance.cls > 0.1) {
      performanceIssues.push({
        issue: 'Improve Cumulative Layout Shift (CLS)',
        details: `Current CLS is ${metadata.performance.cls.toFixed(3)}. Consider optimizing for better stability.`,
        impact: 'Medium'
      });
    }
    
    // INP recommendations
    if (metadata.performance.inp > 500) {
      performanceIssues.push({
        issue: 'Fix Interaction to Next Paint (INP)',
        details: `Current INP is ${metadata.performance.inp.toFixed(0)}ms. Aim for under 200ms.`,
        impact: 'High'
      });
    } else if (metadata.performance.inp > 200) {
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
  
  // Return combined score data
  return {
    score: scaledScore,
    categoryScores: scores,
    recommendations: recommendations,
    status: scaledScore >= 80 ? 'good' : scaledScore >= 60 ? 'warning' : 'error'
  };
}

// HTML generation function for SEO report
function generateSEOReportHTML(seoData) {
  let html = `<div class="seo-report">
    <div class="seo-score-container">
      <div class="seo-score-circle status-${seoData.status}">
        <svg viewBox="0 0 36 36">
          <path class="score-circle-bg"
            d="M18 2.0845 
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke-width="3"
            stroke-dasharray="100, 100"
          />
          <path class="score-circle"
            d="M18 2.0845 
              a 15.9155 15.9155 0 0 1 0 31.831
              a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke-width="3"
            stroke-dasharray="${seoData.score}, 100"
          />
          <text x="18" y="20.5" class="score-text">${seoData.score}</text>
        </svg>
      </div>
      <div class="seo-score-details">
        <h3>SEO Health Score</h3>
        <div class="seo-score-breakdown">`;
  
  // Add category breakdown
  Object.entries(seoData.categoryScores).forEach(([category, score]) => {
    const formattedCategory = category
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
      
    html += `
      <div class="score-category">
        <span class="category-name">${formattedCategory}</span>
        <div class="category-bar-container">
          <div class="category-bar" style="width: ${score * 100}%"></div>
        </div>
        <span class="category-score">${Math.round(score * 100)}</span>
      </div>`;
  });
  
  html += `
      </div>
    </div>
  </div>`;
  
  // Add recommendations if there are any
  if (seoData.recommendations && seoData.recommendations.length > 0) {
    html += `
    <div class="seo-recommendations">
      <h3>Recommended Improvements</h3>`;
      
    seoData.recommendations.forEach(category => {
      html += `
        <div class="recommendation-category">
          <div class="recommendation-header">
            <h4>${category.category}</h4>
          </div>
          <ul class="recommendation-items">`;
            
      category.items.forEach(item => {
        const impactClass = `impact-${item.impact ? item.impact.toLowerCase() : 'medium'}`;
        
        html += `
            <li class="recommendation-item ${impactClass}">
              <div class="recommendation-title">${item.issue}</div>
              <div class="recommendation-details">${item.details}</div>
            </li>`;
      });
            
      html += `
          </ul>
        </div>`;
    });
      
    html += `
    </div>`;
  } else {
    // No recommendations - everything looks good
    html += `
    <div class="seo-perfect">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--status-good)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <div>
        <div class="seo-perfect-title">Excellent SEO</div>
        <div class="seo-perfect-message">All critical SEO factors look good</div>
      </div>
    </div>`;
  }
  
  return html;
}

// Initialize MetaPeek object if not already initialized
if (typeof window.MetaPeek === 'undefined') {
  window.MetaPeek = {
    initialized: false,
    observer: null,
    webVitalsInitialized: false,
    cachedMetrics: null,
    lastMetricsUpdate: 0
  };
}

// Only initialize if not already initialized
if (!window.MetaPeek.initialized) {
  window.MetaPeek.initialized = true;

  // Function to initialize the observer
  function initializeObserver() {
    if (!window.MetaPeek.observer) {
      window.MetaPeek.observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            // Handle DOM changes
            const metadata = getPageMetadata();
            window.MetaPeek.metadata = metadata;
            chrome.runtime.sendMessage({ type: 'metadataUpdated', metadata });
          }
        });
      });
    }
    return window.MetaPeek.observer;
  }

  // Initialize the observer when the script loads
  initializeObserver();
}

// OPTIMIZED: Lazy-initialize web vitals only when requested
function initWebVitals() {
  // Don't re-initialize if already done
  if (window.MetaPeek.webVitalsInitialized) {
    // If we already have cached metrics that are recent (less than 2 minutes old)
    if (window.MetaPeek.cachedMetrics && 
        (Date.now() - window.MetaPeek.lastMetricsUpdate < 120000)) {
      // Immediately notify that we have metrics available
      chrome.runtime.sendMessage({ 
        type: 'webVitalsUpdate', 
        data: window.MetaPeek.cachedMetrics,
        cached: true
      });
      return window.MetaPeek.cachedMetrics;
    }
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
  
  // OPTIMIZATION: Use a single function to notify about metrics updates
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
    });
  }
  
  // OPTIMIZATION: Implement prioritized metrics collection
  // Start with the quickest metrics (TTFB, FCP) and then collect slower ones
  
  // Only run if web-vitals is available
  if (typeof webVitals !== 'undefined') {
    try {
      // Fast metrics - collect these first
      
      // Collect TTFB (Time to First Byte)
      webVitals.onTTFB(metric => {
        metrics.ttfb = metric.value;
        notifyMetricsUpdate(metrics, 'ttfb');
      });
      
      // Collect FCP (First Contentful Paint)
      webVitals.onFCP(metric => {
        metrics.fcp = metric.value;
        notifyMetricsUpdate(metrics, 'fcp');
      });
      
      // Slower metrics - These take longer to calculate
      
      // Collect LCP (Largest Contentful Paint)
      webVitals.onLCP(metric => {
        metrics.lcp = metric.value;
        metrics.metricsCollected = true;
        notifyMetricsUpdate(metrics, 'lcp');
      });
      
      // Collect CLS (Cumulative Layout Shift)
      webVitals.onCLS(metric => {
        metrics.cls = metric.value;
        metrics.metricsCollected = true;
        notifyMetricsUpdate(metrics, 'cls');
      });
      
      // Collect INP (Interaction to Next Paint)
      webVitals.onINP(metric => {
        metrics.inp = metric.value;
        metrics.metricsCollected = true;
        notifyMetricsUpdate(metrics, 'inp');
      });
      
      console.log('MetaPeek: Web Vitals initialized successfully');
    } catch (error) {
      console.error('MetaPeek: Error initializing Web Vitals', error);
    }
  } else {
    console.warn('MetaPeek: Web Vitals library not available');
    
    // OPTIMIZATION: Fall back to using Performance API directly for basic metrics
    // when web-vitals library isn't available
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
      console.error('MetaPeek: Error with Performance API fallback', e);
    }
  }
  
  return metrics;
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
    performance: window.MetaPeek.cachedMetrics || { 
      metricsCollected: false,
      partialMetricsAvailable: false
    }
  };
  
  try {
    // Get basic meta tags
    const title = document.querySelector('title')?.textContent || '';
    const description = document.querySelector('meta[name="description"]')?.content || '';
    const keywords = document.querySelector('meta[name="keywords"]')?.content || '';
    const viewport = document.querySelector('meta[name="viewport"]')?.content || '';
    const robots = document.querySelector('meta[name="robots"]')?.content || '';
    
    // Basic validation for meta tags without SEO_STANDARDS dependency
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
    
    // Get Open Graph tags with basic validation
    const ogTags = document.querySelectorAll('meta[property^="og:"]');
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
    
    // Get Twitter Card tags with basic validation
    const twitterTags = document.querySelectorAll('meta[name^="twitter:"]');
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
    
    // Calculate SEO health score using our local function
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

// Calculate performance score based on Core Web Vitals
function calculatePerformanceScore(metrics) {
  // OPTIMIZATION: Allow calculating scores with partial metrics
  // Return partial score even if not all metrics are available
  if (!metrics || (!metrics.metricsCollected && !metrics.partialMetricsAvailable)) {
    return null;
  }

  let score = 0;
  let weightSum = 0;
  
  // LCP scoring (25% of score)
  if (metrics.lcp !== null) {
    const lcpWeight = 0.25;
    weightSum += lcpWeight;
    
    // Good: <= 2.5s, Poor: > 4s
    if (metrics.lcp <= 2500) {
      score += lcpWeight;
    } else if (metrics.lcp <= 4000) {
      // Linear scale between 2500-4000ms
      const lcpScore = 1 - ((metrics.lcp - 2500) / 1500);
      score += lcpWeight * lcpScore;
    }
    // Otherwise score is 0 for this metric
  }
  
  // CLS scoring (15% of score)
  if (metrics.cls !== null) {
    const clsWeight = 0.15;
    weightSum += clsWeight;
    
    // Good: <= 0.1, Poor: > 0.25
    if (metrics.cls <= 0.1) {
      score += clsWeight;
    } else if (metrics.cls <= 0.25) {
      // Linear scale between 0.1-0.25
      const clsScore = 1 - ((metrics.cls - 0.1) / 0.15);
      score += clsWeight * clsScore;
    }
    // Otherwise score is 0 for this metric
  }
  
  // INP scoring (15% of score)
  if (metrics.inp !== null) {
    const inpWeight = 0.15;
    weightSum += inpWeight;
    
    // Good: <= 200ms, Poor: > 500ms
    if (metrics.inp <= 200) {
      score += inpWeight;
    } else if (metrics.inp <= 500) {
      // Linear scale between 200-500ms
      const inpScore = 1 - ((metrics.inp - 200) / 300);
      score += inpWeight * inpScore;
    }
    // Otherwise score is 0 for this metric
  }
  
  // FCP scoring (10% of score)
  if (metrics.fcp !== null) {
    const fcpWeight = 0.10;
    weightSum += fcpWeight;
    
    // Good: <= 1.8s, Poor: > 3s
    if (metrics.fcp <= 1800) {
      score += fcpWeight;
    } else if (metrics.fcp <= 3000) {
      // Linear scale between 1800-3000ms
      const fcpScore = 1 - ((metrics.fcp - 1800) / 1200);
      score += fcpWeight * fcpScore;
    }
    // Otherwise score is 0 for this metric
  }
  
  // TTFB scoring (10% of score)
  if (metrics.ttfb !== null) {
    const ttfbWeight = 0.10;
    weightSum += ttfbWeight;
    
    // Good: <= 800ms, Poor: > 1800ms
    if (metrics.ttfb <= 800) {
      score += ttfbWeight;
    } else if (metrics.ttfb <= 1800) {
      // Linear scale between 800-1800ms
      const ttfbScore = 1 - ((metrics.ttfb - 800) / 1000);
      score += ttfbWeight * ttfbScore;
    }
    // Otherwise score is 0 for this metric
  }
  
  // OPTIMIZATION: Scale the score based on available metrics 
  if (weightSum > 0) {
    // Scale based on collected metrics rather than using a default
    return score / weightSum;
  } else {
    // Default if we really have no metrics
    return 0.5;
  }
} 