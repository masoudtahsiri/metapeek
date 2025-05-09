# MetaPeek Chrome Extension

MetaPeek is a Chrome extension that helps you audit and preview meta tags for web pages. It provides a comprehensive view of your page's meta information, including basic meta tags, Open Graph tags, Twitter Card tags, and canonical URLs.

## Features

- Extract and display meta tags from the current page
- Validate meta tag lengths and provide warnings
- Preview social media cards (Facebook, Twitter, LinkedIn)
- Check canonical URL matching
- Copy all meta tags as HTML

## Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory

## Usage

1. Click the MetaPeek icon in your Chrome toolbar while on any webpage
2. The popup will show three tabs:
   - Meta Info: View all meta tags with validation
   - Canonical: Check canonical URL matching
   - Previews: See how your page will appear on social media

## Meta Tag Validation

The extension checks the following length limits:
- Title: 30-60 characters
- Description: 120-160 characters
- OG Title: 30-90 characters
- OG Description: 120-200 characters

## Development

The extension is built using:
- Manifest V3
- Vanilla JavaScript
- HTML/CSS

## License

MIT License 