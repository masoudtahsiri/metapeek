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
    canonical: getCanonicalUrl()
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

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getMetaTags') {
    const metaData = extractMetaTags();
    sendResponse(metaData);
  }
}); 