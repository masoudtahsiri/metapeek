function displayFieldValue(value) {
  if (Array.isArray(value)) {
    return value.map(displayFieldValue).join(', ');
  } else if (value && typeof value === 'object') {
    return value.name || '';
  } else {
    return value;
  }
}

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

      // Generate SEO summary
      const summaryItems = [];
      const titleValidation = validateMetaLength(metaData.basic.title, 'title');
      const descValidation = validateMetaLength(metaData.basic.description, 'description');
      
      if (!titleValidation.valid) {
        summaryItems.push(`${titleValidation.message === 'Missing' ? '❌' : '⚠️'} Title ${titleValidation.message.toLowerCase()}`);
      }
      if (!descValidation.valid) {
        summaryItems.push(`${descValidation.message === 'Missing' ? '❌' : '⚠️'} Description ${descValidation.message.toLowerCase()}`);
      }
      if (!metaData.canonical) {
        summaryItems.push('❌ Missing canonical URL');
      }
      if (!metaData.og.title && !metaData.og.description) {
        summaryItems.push('⚠️ Missing Open Graph tags');
      }
      if (!metaData.twitter.card) {
        summaryItems.push('⚠️ Missing Twitter Card type');
      }

      const seoSummary = document.getElementById('seo-summary-content');
      if (summaryItems.length === 0) {
        seoSummary.innerHTML = '<div class="meta-status status-success"><span class="status-icon">✅</span> All meta tags look good!</div>';
      } else {
        seoSummary.innerHTML = summaryItems.map(item => `<div class="meta-status">${item}</div>`).join('');
      }

      // Basic meta tags
      const basicMetaContent = document.getElementById('basic-meta-content');
      basicMetaContent.appendChild(createMetaItem('Title', metaData.basic.title, validateMetaLength(metaData.basic.title, 'title')));
      basicMetaContent.appendChild(createMetaItem('Description', metaData.basic.description, validateMetaLength(metaData.basic.description, 'description')));
      basicMetaContent.appendChild(createMetaItem('Robots', metaData.basic.robots, { valid: true, message: '' }));
      basicMetaContent.appendChild(createMetaItem('Viewport', metaData.basic.viewport, { valid: true, message: '' }));

      // Open Graph tags
      const ogMetaContent = document.getElementById('og-meta-content');
      Object.entries(metaData.og).forEach(([key, value]) => {
        const validation = key === 'title' ? validateMetaLength(value, 'ogTitle') :
                         key === 'description' ? validateMetaLength(value, 'ogDescription') :
                         { valid: true, message: '' };
        ogMetaContent.appendChild(createMetaItem(`og:${key}`, value, validation));
      });

      // Twitter Card tags
      const twitterMetaContent = document.getElementById('twitter-meta-content');
      Object.entries(metaData.twitter).forEach(([key, value]) => {
        twitterMetaContent.appendChild(createMetaItem(`twitter:${key}`, value, { valid: true, message: '' }));
      });

      // Populate Canonical tab
      const canonicalContent = document.getElementById('canonical-content');
      const currentUrl = tabs[0].url;
      const isCanonicalMatch = metaData.canonical === currentUrl;
      
      const canonicalDiv = document.createElement('div');
      canonicalDiv.className = `meta-item ${!isCanonicalMatch ? 'warning' : ''}`;
      canonicalDiv.innerHTML = `
        <div class="meta-label">
          <span>Canonical URL</span>
          <span class="meta-status ${!metaData.canonical ? 'status-error' : !isCanonicalMatch ? 'status-warning' : 'status-success'}">
            <span class="status-icon">${!metaData.canonical ? '❌' : !isCanonicalMatch ? '⚠️' : '✅'}</span>
            ${!metaData.canonical ? 'Missing' : !isCanonicalMatch ? 'URLs do not match' : 'URLs match'}
          </span>
        </div>
        <div class="meta-value">${metaData.canonical || 'Not set'}</div>
        <div class="meta-label">Current URL</div>
        <div class="meta-value">${currentUrl}</div>
      `;
      canonicalContent.appendChild(canonicalDiv);

      // Populate Previews tab
      const facebookPreview = document.getElementById('facebook-preview');
      const twitterPreview = document.getElementById('twitter-preview');
      const linkedinPreview = document.getElementById('linkedin-preview');

      facebookPreview.appendChild(createPreviewCard('facebook', metaData));
      twitterPreview.appendChild(createPreviewCard('twitter', metaData));
      linkedinPreview.appendChild(createPreviewCard('linkedin', metaData));

      // Schema.org Structured Data
      const schemaContent = document.getElementById('schema-content');
      if (metaData.schema && metaData.schema.length > 0) {
        metaData.schema.forEach((schemaObj, idx) => {
          const wrapper = document.createElement('div');
          wrapper.className = 'meta-section';
          const header = document.createElement('div');
          header.className = 'section-header';

          // Status icon
          const statusSpan = document.createElement('span');
          statusSpan.className = `meta-status ${schemaObj.valid && schemaObj.hasType ? 'status-success' : 'status-error'}`;
          statusSpan.innerHTML = `<span class="status-icon">${schemaObj.valid && schemaObj.hasType ? '✅' : '❌'}</span>`;

          // Type
          const typeSpan = document.createElement('span');
          typeSpan.style.fontWeight = 'bold';
          typeSpan.textContent = schemaObj.hasType ? `@type: ${schemaObj.data['@type']}` : '@type missing';

          header.appendChild(typeSpan);
          header.appendChild(statusSpan);
          wrapper.appendChild(header);

          // Key fields
          const fields = ['headline', 'name', 'author', 'datePublished', 'dateModified', 'articleSection', 'description', 'url'];
          if (schemaObj.valid && schemaObj.hasType) {
            fields.forEach(field => {
              if (schemaObj.data[field]) {
                const fieldDiv = document.createElement('div');
                fieldDiv.className = 'meta-item';
                fieldDiv.innerHTML = `<span class="meta-label">${field}:</span><div class="meta-value">${displayFieldValue(schemaObj.data[field])}</div>`;
                wrapper.appendChild(fieldDiv);
              }
            });
          } else if (!schemaObj.valid) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'meta-item';
            errorDiv.innerHTML = '<span class="meta-label status-error">Invalid JSON</span>';
            wrapper.appendChild(errorDiv);
          } else if (!schemaObj.hasType) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'meta-item';
            errorDiv.innerHTML = '<span class="meta-label status-error">Missing @type</span>';
            wrapper.appendChild(errorDiv);
          }

          schemaContent.appendChild(wrapper);
        });
      } else {
        schemaContent.innerHTML = '<div class="meta-status status-warning"><span class="status-icon">⚠️</span> No schema.org structured data found.</div>';
      }

      // Copy Meta Tags button
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

      // Copy Canonical button
      document.getElementById('copy-canonical').addEventListener('click', () => {
        const canonical = metaData.canonical || '';
        const currentUrl = tabs[0].url;
        const text = `Canonical URL: ${canonical}\nCurrent URL: ${currentUrl}`;
        navigator.clipboard.writeText(text).then(() => {
          const btn = document.getElementById('copy-canonical');
          const originalText = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => {
            btn.textContent = originalText;
          }, 2000);
        });
      });

      // Copy Previews button
      document.getElementById('copy-previews').addEventListener('click', () => {
        let text = '';
        text += '[Facebook Preview]\n';
        text += `Title: ${metaData.og.title || ''}\nDescription: ${metaData.og.description || ''}\nImage: ${metaData.og.image || ''}\nURL: ${metaData.og.url || ''}\n\n`;
        text += '[Twitter Preview]\n';
        text += `Title: ${metaData.twitter.title || ''}\nDescription: ${metaData.twitter.description || ''}\nImage: ${metaData.twitter.image || ''}\nCard: ${metaData.twitter.card || ''}\n\n`;
        text += '[LinkedIn Preview]\n';
        text += `Title: ${metaData.og.title || ''}\nDescription: ${metaData.og.description || ''}\nImage: ${metaData.og.image || ''}\nURL: ${metaData.og.url || ''}`;
        navigator.clipboard.writeText(text).then(() => {
          const btn = document.getElementById('copy-previews');
          const originalText = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => {
            btn.textContent = originalText;
          }, 2000);
        });
      });

      // Copy Schema button
      document.getElementById('copy-schema').addEventListener('click', () => {
        let text = '';
        if (metaData.schema && metaData.schema.length > 0) {
          text = metaData.schema.map(obj => JSON.stringify(obj.data, null, 2)).join('\n---\n');
        } else {
          text = 'No page-level schema.org data found.';
        }
        navigator.clipboard.writeText(text).then(() => {
          const btn = document.getElementById('copy-schema');
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

function createMetaItem(name, value, validation) {
  const div = document.createElement('div');
  div.className = 'meta-item';
  
  const labelDiv = document.createElement('div');
  labelDiv.className = 'meta-label';
  
  const nameSpan = document.createElement('span');
  nameSpan.textContent = name;
  
  const statusSpan = document.createElement('span');
  statusSpan.className = `meta-status ${!validation.valid ? validation.message === 'Missing' ? 'status-error' : 'status-warning' : 'status-success'}`;
  
  const statusIcon = document.createElement('span');
  statusIcon.className = 'status-icon';
  statusIcon.textContent = !validation.valid ? validation.message === 'Missing' ? '❌' : '⚠️' : '✅';
  
  statusSpan.appendChild(statusIcon);
  statusSpan.appendChild(document.createTextNode(validation.message));
  
  labelDiv.appendChild(nameSpan);
  labelDiv.appendChild(statusSpan);
  
  const valueDiv = document.createElement('div');
  valueDiv.className = 'meta-value';
  valueDiv.textContent = value || 'Not set';
  
  div.appendChild(labelDiv);
  div.appendChild(valueDiv);
  
  return div;
} 