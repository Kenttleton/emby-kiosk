#!/usr/bin/env node
/**
 * Usage: node scripts/bump-version.js <version>
 * Example: node scripts/bump-version.js 0.1.0
 *
 * Updates app.json:
 *   expo.version          → "0.1.0"
 *   expo.android.versionCode → major*10000 + minor*100 + patch  (e.g. 100)
 *   expo.ios.buildNumber  → same integer as string              (e.g. "100")
 */

const fs = require('fs');
const path = require('path');

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/bump-version.js <version>');
  process.exit(1);
}

const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
if (!match) {
  console.error('Version must be in semver format: X.Y.Z');
  process.exit(1);
}

const [, major, minor, patch] = match.map(Number);
const versionCode = major * 10000 + minor * 100 + patch;

const appJsonPath = path.join(__dirname, '..', 'app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

appJson.expo.version = version;
appJson.expo.android = appJson.expo.android ?? {};
appJson.expo.android.versionCode = versionCode;
appJson.expo.ios = appJson.expo.ios ?? {};
appJson.expo.ios.buildNumber = String(versionCode);

fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
console.log(`Bumped to ${version} (versionCode: ${versionCode})`);
