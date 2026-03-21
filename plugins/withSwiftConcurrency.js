/**
 * Expo config plugin: sets SWIFT_STRICT_CONCURRENCY = minimal on every
 * CocoaPods target so Xcode 16 / Swift 6 does not reject third-party code
 * (e.g. expo-modules-core) that uses @MainActor in ways Swift 6 considers
 * invalid under strict concurrency checking.
 *
 * The generated Podfile already contains one post_install hook (inside the
 * target block). CocoaPods forbids a second top-level hook, so we inject our
 * lines into the existing one instead.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Lines to inject immediately before react_native_post_install
const INJECTION = `    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        # Suppress Swift 6 strict concurrency errors in third-party pods.
        # Xcode 16+ defaults pod compilation to Swift 6 language mode, but pods
        # like expo-modules-core are not yet fully Swift-6 compatible.
        config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
        swift_ver = config.build_settings['SWIFT_VERSION']
        if swift_ver.nil? || swift_ver.to_f >= 6.0
          config.build_settings['SWIFT_VERSION'] = '5.9'
        end
      end
    end
`;

const ANCHOR = '    react_native_post_install(';

module.exports = function withSwiftConcurrency(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (!contents.includes('SWIFT_STRICT_CONCURRENCY') && contents.includes(ANCHOR)) {
        contents = contents.replace(ANCHOR, INJECTION + ANCHOR);
        fs.writeFileSync(podfilePath, contents);
      }
      return config;
    },
  ]);
};
