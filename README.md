# MetaPeek Chrome Extension

MetaPeek is a Chrome extension that helps you audit and optimize your webpage's meta tags and SEO. It provides a comprehensive analysis of your page's meta information, including basic meta tags, Open Graph tags, Twitter Card tags, Schema.org data, and canonical URLs.

## Features

- **Comprehensive Meta Tag Analysis**
  - Extract and display all meta tags from the current page
  - Validate meta tag lengths and provide warnings
  - Check canonical URL matching
  - Analyze Schema.org structured data

- **Social Media Previews**
  - Preview how your page appears on:
    - Google Search Results
    - Facebook
    - Twitter/X
    - LinkedIn
  - Live preview updates as you modify meta tags

- **SEO Health Scoring**
  - Overall SEO score with category breakdown
  - Priority issues highlighting
  - Detailed recommendations for improvement
  - Progress tracking for meta tag optimization

- **Export & Reporting**
  - Generate comprehensive Excel reports
  - Export all meta tags as HTML
  - Detailed technical SEO audit
  - Mobile optimization analysis

## Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Usage

1. Click the MetaPeek icon in your Chrome toolbar while on any webpage
2. The popup will show three main tabs:
   - **Overview**: View SEO score, priority issues, and quick fixes
   - **Meta Tags**: Detailed analysis of all meta tags with validation
   - **Social Preview**: See how your page appears on different platforms

## Meta Tag Validation

The extension checks the following length limits:
- Title: 30-60 characters
- Description: 120-160 characters
- OG Title: 30-90 characters
- OG Description: 120-200 characters
- Twitter Title: 40-70 characters
- Twitter Description: 125-200 characters

## Development

The extension is built using:
- Manifest V3
- Vanilla JavaScript
- HTML/CSS
- ExcelJS for report generation

## Privacy

MetaPeek operates entirely locally in your browser:
- No data is sent to external servers
- All analysis is performed on your device
- No personal information is collected
- Data is cleared when the popup is closed

## Copyright

Copyright © 2025 Refact, LLC. All rights reserved.

## License

MIT License 