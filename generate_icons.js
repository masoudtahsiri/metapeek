const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128, 256, 512, 1000];
const inputFile = path.join(__dirname, 'icons', 'icon.svg');
const outputDir = path.join(__dirname, 'icons');

async function generateIcons() {
  try {
    // Read the SVG file
    const svgBuffer = fs.readFileSync(inputFile);
    
    // Generate PNGs for each size
    for (const size of sizes) {
      const outputFile = path.join(outputDir, `icon${size}.png`);
      
      await sharp(svgBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputFile);
      
      console.log(`Generated ${size}x${size} icon`);
    }
    
    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons(); 