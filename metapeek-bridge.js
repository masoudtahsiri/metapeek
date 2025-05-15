// metapeek-bridge.js
window.MetaPeek = {
  initialized: false,
  observer: null,
  seoStandardsLoaded: false,
  
  // Functions that can be called from any module
  init: function() {
    if (this.initialized) return;
    this.initialized = true;
    console.log('MetaPeek initialized');
  },
  
  // Register when SEO standards are loaded
  registerSEOStandards: function() {
    this.seoStandardsLoaded = true;
    console.log('SEO Standards registered');
    
    // Dispatch an event so other scripts know SEO standards are ready
    document.dispatchEvent(new CustomEvent('metapeek-seo-ready'));
  },
  
  // Function to safely calculate SEO score with fallback
  calculateSEO: function(metadata) {
    if (typeof window.calculateSEOHealthScore === 'function') {
      return window.calculateSEOHealthScore(metadata);
    } else {
      console.error('SEO Health calculation function not available');
      return {
        score: 50,
        status: 'warning',
        categoryScores: { basicMeta: 0.5, socialMeta: 0.5, technical: 0.5, content: 0.5, performance: 0.5 },
        recommendations: [{
          category: 'SEO Analysis',
          items: [{
            issue: 'Unable to calculate SEO health',
            details: 'SEO analysis function not available',
            impact: 'Medium'
          }]
        }]
      };
    }
  }
}; 