/**
 * Expo config plugin: sets android:usesCleartextTraffic="true" on the
 * <application> tag so the app can reach Emby servers over plain HTTP.
 *
 * The app.json android.usesCleartextTraffic field is silently ignored by
 * expo prebuild; this plugin sets it directly in the AndroidManifest.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application[0].$;
    application['android:usesCleartextTraffic'] = 'true';
    return config;
  });
};
