#!/usr/bin/env node
/**
 * generate-assets.js
 * Run once with: node generate-assets.js
 * Creates placeholder PNG assets required by Expo (icon, splash, adaptive-icon, favicon).
 * Replace these with your own artwork before publishing.
 *
 * Requires: npm install -g sharp-cli  OR  just use any 1024×1024 PNG named icon.png
 * 
 * For a quick start without this script:
 *   1. Grab any square PNG image (≥1024×1024)
 *   2. Save it as assets/icon.png
 *   3. Copy it to assets/adaptive-icon.png and assets/splash.png
 *   4. Save any 32×32 PNG as assets/favicon.png
 */

const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);

// Minimal 1×1 transparent PNG in base64
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

const files = ['icon.png', 'splash.png', 'adaptive-icon.png', 'favicon.png'];
for (const file of files) {
  const dest = path.join(assetsDir, file);
  if (!fs.existsSync(dest)) {
    fs.writeFileSync(dest, TINY_PNG);
    console.log(`Created placeholder: assets/${file}`);
  } else {
    console.log(`Already exists:      assets/${file}`);
  }
}
console.log('\nDone. Replace these with real artwork before publishing.');
