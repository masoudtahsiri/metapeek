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
  if (metadata.performance) {
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
  
  // Create recommendation list
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
    observer: null
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

// Initialize core web vitals collection
function initWebVitals() {
  // Create storage for metrics
  window.metaPeekMetrics = {
    lcp: null,
    cls: null,
    inp: null,
    fcp: null, 
    ttfb: null
  };
  
  // Only run if web-vitals is available
  if (typeof webVitals !== 'undefined') {
    // Collect LCP (Largest Contentful Paint)
    webVitals.onLCP(metric => {
      window.metaPeekMetrics.lcp = metric.value;
      console.log('MetaPeek: LCP collected', metric.value);
    });
    
    // Collect CLS (Cumulative Layout Shift)
    webVitals.onCLS(metric => {
      window.metaPeekMetrics.cls = metric.value;
      console.log('MetaPeek: CLS collected', metric.value);
    });
    
    // Collect INP (Interaction to Next Paint)
    webVitals.onINP(metric => {
      window.metaPeekMetrics.inp = metric.value;
      console.log('MetaPeek: INP collected', metric.value);
    });
    
    // Collect FCP (First Contentful Paint)
    webVitals.onFCP(metric => {
      window.metaPeekMetrics.fcp = metric.value;
      console.log('MetaPeek: FCP collected', metric.value);
    });
    
    // Collect TTFB (Time to First Byte)
    webVitals.onTTFB(metric => {
      window.metaPeekMetrics.ttfb = metric.value;
      console.log('MetaPeek: TTFB collected', metric.value);
    });
  }
}

// Initialize web vitals collection when the page loads
initWebVitals();

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

    // Add performance metrics to the metadata
    if (window.metaPeekMetrics) {
      metadata.performance = window.metaPeekMetrics;
    }

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

// Listen for SEO analysis requests from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "getSEOHealth") {
    try {
      // Use the data sent from popup or get new data
      const metadata = request.metadata || getPageMetadata();
      
      // Use the local functions directly 
      const seoScore = calculateSEOHealthScore(metadata);
      const seoReport = generateSEOReportHTML(seoScore);
      
      sendResponse({
        success: true,
        seoReport: seoReport
      });
    } catch (error) {
      console.error("Error generating SEO report:", error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
    
    return true; // Keep the messaging channel open for async response
  }
});

// Calculate performance score based on Core Web Vitals
function calculatePerformanceScore(metrics) {
  // No metrics available
  if (!metrics || (!metrics.lcp && !metrics.cls && !metrics.inp)) {
    return 0.5; // Default score when metrics aren't available
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
  
  // For remaining 25%, use a default good score since we can't measure more metrics
  const remainingWeight = 1 - weightSum;
  score += remainingWeight * 0.7;
  
  // Return score between 0-1
  return score;
} 