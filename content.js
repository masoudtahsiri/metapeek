function extractMetaTags() {
  const metaData = {
    basic: {
      title: document.title,
      description: getMetaContent('description'),
      robots: getMetaContent('robots'),
      viewport: getMetaContent('viewport')
    },
    og: {
      title: getMetaContent('og:title'),
      description: getMetaContent('og:description'),
      image: getMetaContent('og:image'),
      url: getMetaContent('og:url')
    },
    twitter: {
      title: getMetaContent('twitter:title'),
      description: getMetaContent('twitter:description'),
      image: getMetaContent('twitter:image'),
      card: getMetaContent('twitter:card')
    },
    canonical: getCanonicalUrl(),
    schema: getLatestSchemaOrg()
  };

  return metaData;
}

function getMetaContent(name) {
  const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
  return meta ? meta.getAttribute('content') : null;
}

function getCanonicalUrl() {
  const canonical = document.querySelector('link[rel="canonical"]');
  return canonical ? canonical.getAttribute('href') : null;
}

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
  // Only match if the schema's url/@id exactly matches the current page
  return objUrl && (objUrl === pageUrl);
}

function extractSchemaOrg() {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  let schemas = [];
  scripts.forEach(script => {
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
  return pageSchemas;
}

// Store latest schema in window for access by message handler
function updateSchemaOrgCache() {
  window.__metapeek_schema = extractSchemaOrg();
}

function getLatestSchemaOrg() {
  return window.__metapeek_schema || [];
}

// Initial extraction
updateSchemaOrgCache();

// MutationObserver for dynamically added JSON-LD
const observer = new MutationObserver(mutations => {
  let found = false;
  for (const mutation of mutations) {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach(node => {
        if (
          node.nodeType === 1 &&
          node.tagName === 'SCRIPT' &&
          node.type === 'application/ld+json'
        ) {
          found = true;
        }
      });
    }
  }
  if (found) {
    updateSchemaOrgCache();
  }
});
observer.observe(document.documentElement || document.body, {
  childList: true,
  subtree: true
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getMetaTags') {
    // Always update meta tags, but use cached schema (updated by observer)
    const metaData = extractMetaTags();
    sendResponse(metaData);
  }
}); 