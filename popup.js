document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const panes = document.querySelectorAll('.tab-pane');
      panes.forEach(pane => pane.classList.remove('active'));
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });

  // Get meta tags from the current page
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'getMetaTags' }, (metaData) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        return;
      }

      // Populate Meta Info tab
      const metaContent = document.getElementById('meta-content');
      
      // Basic meta tags
      metaContent.appendChild(createMetaItem('Title', metaData.basic.title, 
        validateMetaLength(metaData.basic.title, 'title')));
      metaContent.appendChild(createMetaItem('Description', metaData.basic.description,
        validateMetaLength(metaData.basic.description, 'description')));
      metaContent.appendChild(createMetaItem('Robots', metaData.basic.robots, { valid: true, message: '' }));
      metaContent.appendChild(createMetaItem('Viewport', metaData.basic.viewport, { valid: true, message: '' }));

      // Open Graph tags
      Object.entries(metaData.og).forEach(([key, value]) => {
        const validation = key === 'title' ? validateMetaLength(value, 'ogTitle') :
                         key === 'description' ? validateMetaLength(value, 'ogDescription') :
                         { valid: true, message: '' };
        metaContent.appendChild(createMetaItem(`og:${key}`, value, validation));
      });

      // Twitter Card tags
      Object.entries(metaData.twitter).forEach(([key, value]) => {
        metaContent.appendChild(createMetaItem(`twitter:${key}`, value, { valid: true, message: '' }));
      });

      // Populate Canonical tab
      const canonicalContent = document.getElementById('canonical-content');
      const currentUrl = tabs[0].url;
      const isCanonicalMatch = metaData.canonical === currentUrl;
      
      const canonicalDiv = document.createElement('div');
      canonicalDiv.className = `meta-item ${!isCanonicalMatch ? 'warning' : ''}`;
      canonicalDiv.innerHTML = `
        <strong>Canonical URL:</strong> ${metaData.canonical || 'Not set'}<br>
        <strong>Current URL:</strong> ${currentUrl}<br>
        <span class="status">${!metaData.canonical ? 'Missing canonical URL' : 
          !isCanonicalMatch ? 'URLs do not match' : 'URLs match'}</span>
      `;
      canonicalContent.appendChild(canonicalDiv);

      // Populate Previews tab
      const facebookPreview = document.getElementById('facebook-preview');
      const twitterPreview = document.getElementById('twitter-preview');
      const linkedinPreview = document.getElementById('linkedin-preview');

      facebookPreview.appendChild(createPreviewCard('facebook', metaData));
      twitterPreview.appendChild(createPreviewCard('twitter', metaData));
      linkedinPreview.appendChild(createPreviewCard('linkedin', metaData));

      // Copy meta tags button
      document.getElementById('copy-meta').addEventListener('click', () => {
        const metaHTML = generateMetaHTML(metaData);
        navigator.clipboard.writeText(metaHTML).then(() => {
          const btn = document.getElementById('copy-meta');
          const originalText = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => {
            btn.textContent = originalText;
          }, 2000);
        });
      });
    });
  });
}); 