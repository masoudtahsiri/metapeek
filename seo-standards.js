/**
 * MetaPeek SEO Standards (2025)
 * 
 * This file contains the current SEO standards used for validation and analysis.
 * Update this file when industry standards change.
 */

const SEO_STANDARDS = {
  /**
   * Meta tag standards
   */
  meta: {
    title: {
      min: 30,            // Minimum characters
      max: 60,            // Maximum before likely truncation
      optimal: 50,        // Optimal/target length
      pixelWidth: 580,    // Approximate pixel width for Google SERP
      importance: 'high', // SEO importance
      validation: (value) => {
        if (!value) return { status: 'error', message: 'Missing title tag' };
        
        const length = value.length;
        
        if (length < 30) {
          return { status: 'warning', message: `Too short (${length}/30 chars minimum)` };
        }
        
        if (length > 60) {
          return { status: 'warning', message: `May be truncated (${length}/60 chars recommended)` };
        }
        
        if (length >= 45 && length <= 55) {
          return { status: 'good', message: `Optimal length (${length} chars)` };
        }
        
        return { status: 'good', message: `Good length (${length} chars)` };
      }
    },
    
    description: {
      min: 120,              // Minimum for adequate description
      max: 160,              // Maximum before desktop truncation
      optimal: 150,          // Optimal/target length
      mobileMax: 120,        // Mobile truncation typically occurs earlier
      importance: 'medium',  // Indirect ranking factor (CTR impact)
      validation: (value) => {
        if (!value) return { status: 'error', message: 'Missing meta description' };
        
        const length = value.length;
        
        if (length < 120) {
          return { status: 'warning', message: `Too short (${length}/120 chars minimum)` };
        }
        
        if (length > 160) {
          return { status: 'warning', message: `May be truncated (${length}/160 chars recommended)` };
        }
        
        if (length >= 140 && length <= 155) {
          return { status: 'good', message: `Optimal length (${length} chars)` };
        }
        
        return { status: 'good', message: `Good length (${length} chars)` };
      }
    },
    
    viewport: {
      required: true,
      recommended: 'width=device-width, initial-scale=1',
      importance: 'high', // Critical for mobile optimization
      validation: (value) => {
        if (!value) return { status: 'error', message: 'Missing viewport meta tag' };
        
        if (!value.includes('width=device-width')) {
          return { status: 'warning', message: 'Should include width=device-width' };
        }
        
        if (!value.includes('initial-scale=1')) {
          return { status: 'warning', message: 'Should include initial-scale=1' };
        }
        
        if (value.includes('user-scalable=no')) {
          return { status: 'warning', message: 'Avoid user-scalable=no for accessibility' };
        }
        
        return { status: 'good', message: 'Properly configured' };
      }
    },
    
    robots: {
      recommended: 'index, follow',
      importance: 'high',
      indexValues: ['index', 'noindex'],
      followValues: ['follow', 'nofollow'],
      otherValues: ['noarchive', 'nosnippet', 'notranslate', 'noimageindex'],
      validation: (value) => {
        if (!value) {
          return { status: 'info', message: 'No robots meta (defaults to index, follow)' };
        }
        
        const hasNoindex = value.toLowerCase().includes('noindex');
        
        if (hasNoindex) {
          return { status: 'warning', message: 'Page set to noindex (won\'t appear in search results)' };
        }
        
        const hasNofollow = value.toLowerCase().includes('nofollow');
        
        if (hasNofollow) {
          return { status: 'info', message: 'Page set to nofollow (links won\'t pass ranking signals)' };
        }
        
        return { status: 'good', message: 'Robots meta properly set' };
      }
    },
    
    canonical: {
      importance: 'high',
      validation: (value, currentUrl) => {
        if (!value) {
          return { status: 'warning', message: 'Missing canonical URL' };
        }
        
        // Check if canonical URL matches current URL (normalized)
        const normalizeUrl = (url) => {
          try {
            // Remove trailing slash, protocol, and www for comparison
            return url.replace(/\/$/, '')
                     .replace(/^https?:\/\/(www\.)?/, '')
                     .replace(/\?$/, '');
          } catch (e) {
            return url;
          }
        };
        
        if (currentUrl && normalizeUrl(value) !== normalizeUrl(currentUrl)) {
          return { 
            status: 'warning', 
            message: 'Canonical URL doesn\'t match current URL'
          };
        }
        
        if (!value.startsWith('https')) {
          return { status: 'warning', message: 'Canonical should use HTTPS' };
        }
        
        return { status: 'good', message: 'Canonical URL properly set' };
      }
    },
    
    keywords: {
      importance: 'very-low', // No longer used by Google
      validation: (value) => {
        if (!value) {
          return { status: 'info', message: 'No meta keywords (not important for SEO)' };
        }
        
        const keywords = value.split(',').map(k => k.trim()).filter(k => k);
        
        if (keywords.length > 10) {
          return { status: 'info', message: 'Many keywords (not used by major search engines)' };
        }
        
        return { status: 'info', message: 'Meta keywords present (minimal SEO impact)' };
      }
    }
  },
  
  /**
   * Open Graph standards for social sharing
   */
  og: {
    required: ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'],
    importance: 'medium',
    
    'og:title': {
      min: 30,
      max: 90,
      optimal: 65,
      validation: (value) => {
        if (!value) return { status: 'error', message: 'Missing og:title' };
        
        const length = value.length;
        
        if (length < 30) {
          return { status: 'warning', message: `Too short (${length}/30 chars minimum)` };
        }
        
        if (length > 90) {
          return { status: 'warning', message: `May be truncated (${length}/90 chars maximum)` };
        }
        
        return { status: 'good', message: 'Good length' };
      }
    },
    
    'og:description': {
      min: 120,
      max: 200,
      optimal: 160,
      validation: (value) => {
        if (!value) return { status: 'error', message: 'Missing og:description' };
        
        const length = value.length;
        
        if (length < 120) {
          return { status: 'warning', message: `Too short (${length}/120 chars minimum)` };
        }
        
        if (length > 200) {
          return { status: 'warning', message: `May be truncated (${length}/200 chars maximum)` };
        }
        
        return { status: 'good', message: 'Good length' };
      }
    },
    
    'og:image': {
      required: true,
      recommended: {
        width: 1200,
        height: 630,
        ratio: 1.91, // Aspect ratio (width/height)
        formats: ['jpg', 'png', 'gif']
      },
      validation: (value) => {
        if (!value) return { status: 'error', message: 'Missing og:image' };
        
        // Basic URL validation
        try {
          new URL(value);
        } catch (e) {
          return { status: 'error', message: 'Invalid og:image URL' };
        }
        
        // Check image extension
        const extension = value.split('.').pop().toLowerCase();
        if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
          return { status: 'warning', message: 'Unusual image format' };
        }
        
        return { status: 'good', message: 'Image URL present' };
      }
    },
    
    'og:url': {
      required: true,
      validation: (value, currentUrl) => {
        if (!value) return { status: 'error', message: 'Missing og:url' };
        
        // Basic URL validation
        try {
          new URL(value);
        } catch (e) {
          return { status: 'error', message: 'Invalid og:url' };
        }
        
        // Should match canonical URL
        if (currentUrl && value !== currentUrl) {
          return { status: 'warning', message: 'Should match canonical URL' };
        }
        
        return { status: 'good', message: 'Present' };
      }
    },
    
    'og:type': {
      required: true,
      commonValues: ['website', 'article', 'product', 'profile'],
      validation: (value) => {
        if (!value) return { status: 'error', message: 'Missing og:type' };
        
        const commonTypes = ['website', 'article', 'product', 'profile', 'book', 'music', 'video'];
        
        if (!commonTypes.includes(value)) {
          return { status: 'info', message: `Uncommon og:type: ${value}` };
        }
        
        return { status: 'good', message: 'Present' };
      }
    },
    
    'og:site_name': {
      required: false,
      validation: (value) => {
        if (!value) return { status: 'info', message: 'Optional og:site_name not set' };
        return { status: 'good', message: 'Present' };
      }
    }
  },
  
  /**
   * Twitter Card standards
   */
  twitter: {
    required: ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'],
    importance: 'medium',
    
    'twitter:card': {
      required: true,
      validValues: ['summary', 'summary_large_image', 'app', 'player'],
      validation: (value) => {
        if (!value) return { status: 'error', message: 'Missing twitter:card' };
        
        const validCards = ['summary', 'summary_large_image', 'app', 'player'];
        
        if (!validCards.includes(value)) {
          return { status: 'error', message: `Invalid card type: ${value}` };
        }
        
        return { status: 'good', message: 'Present' };
      }
    },
    
    'twitter:title': {
      min: 30,
      max: 70,
      validation: (value) => {
        if (!value) return { status: 'error', message: 'Missing twitter:title' };
        
        const length = value.length;
        
        if (length > 70) {
          return { status: 'warning', message: `May be truncated (${length}/70 chars maximum)` };
        }
        
        return { status: 'good', message: 'Present' };
      }
    },
    
    'twitter:description': {
      max: 200,
      validation: (value) => {
        if (!value) return { status: 'error', message: 'Missing twitter:description' };
        
        const length = value.length;
        
        if (length > 200) {
          return { status: 'warning', message: `May be truncated (${length}/200 chars maximum)` };
        }
        
        return { status: 'good', message: 'Present' };
      }
    },
    
    'twitter:image': {
      required: true,
      validation: (value) => {
        if (!value) return { status: 'error', message: 'Missing twitter:image' };
        
        // Basic URL validation
        try {
          new URL(value);
        } catch (e) {
          return { status: 'error', message: 'Invalid twitter:image URL' };
        }
        
        return { status: 'good', message: 'Present' };
      }
    },
    
    'twitter:site': {
      required: false,
      validation: (value) => {
        if (!value) return { status: 'info', message: 'Optional twitter:site not set' };
        
        if (!value.startsWith('@')) {
          return { status: 'warning', message: 'Should start with @ symbol' };
        }
        
        return { status: 'good', message: 'Present' };
      }
    }
  },
  
  /**
   * Structured data (Schema.org) standards
   */
  schema: {
    importance: 'high',
    validation: (schemas) => {
      if (!schemas || schemas.length === 0) {
        return { status: 'warning', message: 'No Schema.org data found' };
      }
      
      let invalid = schemas.filter(s => !s.valid);
      
      if (invalid.length > 0) {
        return { status: 'error', message: `${invalid.length} invalid schema(s) detected` };
      }
      
      let hasPageSchema = schemas.some(s => {
        const types = Array.isArray(s.data['@type']) ? s.data['@type'] : [s.data['@type']];
        const pageSchemaTypes = [
          'WebPage', 'AboutPage', 'CheckoutPage', 'CollectionPage', 'ContactPage', 
          'FAQPage', 'ItemPage', 'ProfilePage', 'SearchResultsPage', 
          'Article', 'NewsArticle', 'BlogPosting'
        ];
        
        return types.some(t => pageSchemaTypes.includes(t));
      });
      
      if (!hasPageSchema) {
        return { status: 'info', message: 'No page-specific schema found' };
      }
      
      return { status: 'good', message: `${schemas.length} valid schema(s) found` };
    },
    
    /**
     * Validation for specific schema types
     */
    types: {
      'Article': {
        required: ['headline', 'author', 'datePublished', 'image']
      },
      'Product': {
        required: ['name', 'image', 'description', 'offers']
      },
      'LocalBusiness': {
        required: ['name', 'address', 'telephone']
      },
      'FAQPage': {
        required: ['mainEntity']
      },
      'BreadcrumbList': {
        required: ['itemListElement']
      }
    }
  },
  
  /**
   * HTML structure standards
   */
  html: {
    headings: {
      h1: {
        count: { min: 1, max: 1 },
        length: { min: 20, max: 70 },
        validation: (count, length) => {
          if (count === 0) {
            return { status: 'error', message: 'Missing H1 heading' };
          }
          
          if (count > 1) {
            return { status: 'warning', message: `Multiple H1 headings (${count})` };
          }
          
          if (length < 20) {
            return { status: 'warning', message: 'H1 too short' };
          }
          
          if (length > 70) {
            return { status: 'warning', message: 'H1 too long' };
          }
          
          return { status: 'good', message: 'H1 properly used' };
        }
      },
      structure: {
        validation: (headings) => {
          // Check for proper heading hierarchy (don't skip levels)
          let levels = headings.map(h => parseInt(h.tagName.substring(1)));
          let previousLevel = 0;
          
          for (let i = 0; i < levels.length; i++) {
            let current = levels[i];
            
            // Can't jump more than one level
            if (current > previousLevel + 1 && previousLevel > 0) {
              return { 
                status: 'warning', 
                message: `Heading structure skips from H${previousLevel} to H${current}`
              };
            }
            
            previousLevel = current;
          }
          
          return { status: 'good', message: 'Proper heading hierarchy' };
        }
      }
    },
    
    images: {
      alt: {
        required: true,
        validation: (images) => {
          const totalImages = images.length;
          const missingAlt = images.filter(img => !img.alt).length;
          const emptyAlt = images.filter(img => img.alt === '').length;
          
          if (totalImages === 0) {
            return { status: 'info', message: 'No images found' };
          }
          
          if (missingAlt > 0) {
            return { 
              status: 'warning', 
              message: `${missingAlt}/${totalImages} images missing alt text`
            };
          }
          
          // Empty alt is valid for decorative images, but worth noting
          if (emptyAlt > 0) {
            return { 
              status: 'info', 
              message: `${emptyAlt}/${totalImages} images have empty alt (decorative)`
            };
          }
          
          return { status: 'good', message: 'All images have alt text' };
        }
      }
    },
    
    links: {
      validation: (links) => {
        const totalLinks = links.length;
        const internalLinks = links.filter(link => {
          try {
            const url = new URL(link.href, window.location.origin);
            return url.hostname === window.location.hostname;
          } catch (e) {
            return false;
          }
        }).length;
        
        const emptyLinks = links.filter(link => !link.href || link.href === '#').length;
        const noTextLinks = links.filter(link => !link.textContent.trim() && (!link.querySelector('img') || !link.querySelector('img').alt)).length;
        
        if (emptyLinks > 0) {
          return { 
            status: 'warning', 
            message: `${emptyLinks} empty links found (href="#" or missing href)`
          };
        }
        
        if (noTextLinks > 0) {
          return { 
            status: 'warning', 
            message: `${noTextLinks} links without text or image alt found`
          };
        }
        
        if (internalLinks === 0 && totalLinks > 0) {
          return { 
            status: 'info', 
            message: 'No internal links found (may be single page)'
          };
        }
        
        return { 
          status: 'good', 
          message: `${totalLinks} links found (${internalLinks} internal)`
        };
      }
    }
  },
  
  /**
   * Performance standards (Core Web Vitals)
   */
  performance: {
    lcp: { // Largest Contentful Paint
      good: 2500,      // milliseconds
      needsImprovement: 4000,
      validation: (value) => {
        if (!value) return { status: 'info', message: 'LCP not measured' };
        
        if (value <= 2500) {
          return { status: 'good', message: `LCP: ${(value/1000).toFixed(2)}s (good)` };
        }
        
        if (value <= 4000) {
          return { status: 'warning', message: `LCP: ${(value/1000).toFixed(2)}s (needs improvement)` };
        }
        
        return { status: 'error', message: `LCP: ${(value/1000).toFixed(2)}s (poor)` };
      }
    },
    
    cls: { // Cumulative Layout Shift
      good: 0.1,
      needsImprovement: 0.25,
      validation: (value) => {
        if (value === undefined) return { status: 'info', message: 'CLS not measured' };
        
        if (value <= 0.1) {
          return { status: 'good', message: `CLS: ${value.toFixed(2)} (good)` };
        }
        
        if (value <= 0.25) {
          return { status: 'warning', message: `CLS: ${value.toFixed(2)} (needs improvement)` };
        }
        
        return { status: 'error', message: `CLS: ${value.toFixed(2)} (poor)` };
      }
    },
    
    inp: { // Interaction to Next Paint (replacing FID)
      good: 200,      // milliseconds  
      needsImprovement: 500,
      validation: (value) => {
        if (!value) return { status: 'info', message: 'INP not measured' };
        
        if (value <= 200) {
          return { status: 'good', message: `INP: ${value}ms (good)` };
        }
        
        if (value <= 500) {
          return { status: 'warning', message: `INP: ${value}ms (needs improvement)` };
        }
        
        return { status: 'error', message: `INP: ${value}ms (poor)` };
      }
    }
  },
  
  /**
   * Mobile optimization standards
   */
  mobile: {
    viewport: {
      required: true,
      validation: (viewport) => {
        if (!viewport) {
          return { status: 'error', message: 'Missing viewport meta tag' };
        }
        
        return { status: 'good', message: 'Viewport meta tag present' };
      }
    },
    
    tapTargets: {
      minSize: 48, // pixels
      minSpacing: 8, // pixels between targets
      validation: (smallTargets) => {
        if (smallTargets === 0) {
          return { status: 'good', message: 'All tap targets are properly sized' };
        }
        
        return { 
          status: 'warning', 
          message: `${smallTargets} tap targets too small (should be at least 48x48px)`
        };
      }
    },
    
    fontSize: {
      minimum: 16, // pixels
      validation: (smallText) => {
        if (smallText === 0) {
          return { status: 'good', message: 'All text is properly sized for mobile' };
        }
        
        return { 
          status: 'warning', 
          message: `${smallText} text elements too small (should be at least 16px)`
        };
      }
    }
  },
  
  /**
   * Security standards
   */
  security: {
    https: {
      required: true,
      validation: (url) => {
        if (!url) return { status: 'error', message: 'URL not available' };
        
        if (!url.startsWith('https://')) {
          return { status: 'error', message: 'Site not using HTTPS' };
        }
        
        return { status: 'good', message: 'HTTPS enabled' };
      }
    },
    
    mixedContent: {
      allowed: false,
      validation: (count) => {
        if (count > 0) {
          return { status: 'error', message: `${count} mixed content resources detected` };
        }
        
        return { status: 'good', message: 'No mixed content issues' };
      }
    }
  }
};

/**
 * Calculate overall SEO health score based on collected metrics
 * @param {Object} metadata All collected page metadata
 * @return {Object} Score info with value and recommendations
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
  
  // Check HTTPS
  if (metadata.canonicalUrl && metadata.canonicalUrl.startsWith('https://')) {
    technicalScore += 1;
    technicalFactors += 1;
  }
  
  scores.technical = technicalFactors > 0 ? technicalScore / technicalFactors : 0;
  
  // Content score (placeholder - in real implementation, evaluate content quality)
  scores.content = 0.7;
  
  // Performance score (placeholder - in real implementation, use Core Web Vitals)
  scores.performance = 0.8;
  
  // Calculate overall weighted score
  const overallScore = Object.entries(weights).reduce(
    (total, [category, weight]) => total + (scores[category] * weight),
    0
  );
  
  // Scale to 0-100
  const scaledScore = Math.round(overallScore * 100);
  
  // Create recommendation list
  const recommendations = [];
  
  // Add recommendations based on scores
  if (scores.basicMeta < 0.7) {
    const basicMetaRecs = [];
    
    // Check title
    const title = metadata.basicMeta.find(tag => tag.label === 'Title');
    if (!title || title.status !== 'good') {
      basicMetaRecs.push({
        issue: 'Optimize Title Tag',
        details: !title ? 'Missing title tag' : 
                 title.status === 'warning' && title.value.length < 30 ? 'Title too short' :
                 title.status === 'warning' && title.value.length > 60 ? 'Title too long' :
                 'Title needs improvement',
        impact: 'High'
      });
    }
    
    // Check description
    const description = metadata.basicMeta.find(tag => tag.label === 'Description');
    if (!description || description.status !== 'good') {
      basicMetaRecs.push({
        issue: 'Improve Meta Description',
        details: !description ? 'Missing meta description' :
                 description.status === 'warning' && description.value.length < 120 ? 'Description too short' :
                 description.status === 'warning' && description.value.length > 160 ? 'Description too long' :
                 'Description needs improvement',
        impact: 'Medium'
      });
    }
    
    // Add to main recommendations
    if (basicMetaRecs.length > 0) {
      recommendations.push({
        category: 'Basic Meta Tags',
        items: basicMetaRecs
      });
    }
  }
  
  // Check social tags
  if (scores.socialMeta < 0.7) {
    const socialRecs = [];
    
    // Check OG tags
    const criticalOgTags = ['og:title', 'og:description', 'og:image'];
    const missingOgTags = criticalOgTags.filter(tag => {
      const found = metadata.ogMeta.find(t => t.label === tag);
      return !found || found.status !== 'good';
    });
    
    if (missingOgTags.length > 0) {
      socialRecs.push({
        issue: 'Add Missing Open Graph Tags',
        details: `Add or improve: ${missingOgTags.join(', ')}`,
        impact: 'Medium'
      });
    }
    
    // Check Twitter tags
    const criticalTwitterTags = ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];
    const missingTwitterTags = criticalTwitterTags.filter(tag => {
      const found = metadata.twitterMeta.find(t => t.label === tag);
      return !found || found.status !== 'good';
    });
    
    if (missingTwitterTags.length > 0) {
      socialRecs.push({
        issue: 'Add Missing Twitter Card Tags',
        details: `Add or improve: ${missingTwitterTags.join(', ')}`,
        impact: 'Medium'
      });
    }
    
    // Add to main recommendations
    if (socialRecs.length > 0) {
      recommendations.push({
        category: 'Social Media Tags',
        items: socialRecs
      });
    }
  }
  
  // Check technical factors
  if (scores.technical < 0.7) {
    const technicalRecs = [];
    
    // Check canonical
    if (!metadata.canonicalUrl) {
      technicalRecs.push({
        issue: 'Add Canonical URL',
        details: 'Add a canonical URL to prevent duplicate content issues',
        impact: 'High'
      });
    }
    
    // Check schema
    if (!metadata.schemaData || metadata.schemaData.length === 0) {
      technicalRecs.push({
        issue: 'Add Structured Data',
        details: 'Add Schema.org markup to help search engines understand your content',
        impact: 'Medium'
      });
    } else if (metadata.schemaData.some(s => !s.valid)) {
      technicalRecs.push({
        issue: 'Fix Invalid Schema Markup',
        details: 'Current structured data contains errors that should be fixed',
        impact: 'Medium'
      });
    }
    
    // Check HTTPS
    if (metadata.canonicalUrl && !metadata.canonicalUrl.startsWith('https://')) {
      technicalRecs.push({
        issue: 'Enable HTTPS',
        details: 'Migrate your site to HTTPS for better security and SEO',
        impact: 'High'
      });
    }
    
    // Add to main recommendations
    if (technicalRecs.length > 0) {
      recommendations.push({
        category: 'Technical SEO',
        items: technicalRecs
      });
    }
  }
  
  // Return combined score data
  return {
    score: scaledScore,
    categoryScores: scores,
    recommendations: recommendations,
    status: scaledScore >= 80 ? 'good' : scaledScore >= 60 ? 'warning' : 'error'
  };
}

/**
 * Generate HTML for the full SEO report with formatted recommendations
 */
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

// Export the standards for use in the extension
window.SEO_STANDARDS = SEO_STANDARDS;
window.calculateSEOHealthScore = calculateSEOHealthScore;
window.generateSEOReportHTML = generateSEOReportHTML; 