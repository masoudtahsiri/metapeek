const META_LIMITS = {
  title: { max: 60, min: 30 },
  description: { max: 160, min: 120 },
  ogTitle: { max: 90, min: 30 },
  ogDescription: { max: 200, min: 120 }
};

function validateMetaLength(value, type) {
  if (!value) return { valid: false, message: 'Missing' };
  
  const limits = META_LIMITS[type];
  if (!limits) return { valid: true, message: '' };

  if (value.length < limits.min) {
    return { valid: false, message: `Too short (${value.length}/${limits.min})` };
  }
  if (value.length > limits.max) {
    return { valid: false, message: `Too long (${value.length}/${limits.max})` };
  }
  return { valid: true, message: `Good (${value.length})` };
}

function createMetaItem(name, value, validation) {
  const div = document.createElement('div');
  div.className = 'meta-item';
  
  if (!validation.valid) {
    div.classList.add('warning');
  }

  const nameSpan = document.createElement('strong');
  nameSpan.textContent = name + ': ';
  
  const valueSpan = document.createElement('span');
  valueSpan.textContent = value || 'Not set';
  
  const statusSpan = document.createElement('span');
  statusSpan.className = 'status';
  statusSpan.textContent = validation.message;
  
  div.appendChild(nameSpan);
  div.appendChild(valueSpan);
  div.appendChild(statusSpan);
  
  return div;
}

function generateMetaHTML(metaData) {
  let html = '';
  
  // Basic meta tags
  if (metaData.basic.title) {
    html += `<title>${metaData.basic.title}</title>\n`;
  }
  if (metaData.basic.description) {
    html += `<meta name="description" content="${metaData.basic.description}">\n`;
  }
  if (metaData.basic.robots) {
    html += `<meta name="robots" content="${metaData.basic.robots}">\n`;
  }
  if (metaData.basic.viewport) {
    html += `<meta name="viewport" content="${metaData.basic.viewport}">\n`;
  }

  // Open Graph tags
  Object.entries(metaData.og).forEach(([key, value]) => {
    if (value) {
      html += `<meta property="og:${key}" content="${value}">\n`;
    }
  });

  // Twitter Card tags
  Object.entries(metaData.twitter).forEach(([key, value]) => {
    if (value) {
      html += `<meta name="twitter:${key}" content="${value}">\n`;
    }
  });

  // Canonical URL
  if (metaData.canonical) {
    html += `<link rel="canonical" href="${metaData.canonical}">\n`;
  }

  return html;
}

function createPreviewCard(platform, metaData) {
  const card = document.createElement('div');
  card.className = 'preview-card-content';

  const title = metaData.og.title || metaData.basic.title;
  const description = metaData.og.description || metaData.basic.description;
  const image = metaData.og.image;
  const url = metaData.og.url || window.location.href;

  if (image) {
    const img = document.createElement('img');
    img.src = image;
    img.alt = title;
    card.appendChild(img);
  }

  const titleEl = document.createElement('h4');
  titleEl.textContent = title;
  card.appendChild(titleEl);

  const descEl = document.createElement('p');
  descEl.textContent = description;
  card.appendChild(descEl);

  const urlEl = document.createElement('small');
  urlEl.textContent = url;
  card.appendChild(urlEl);

  return card;
} 