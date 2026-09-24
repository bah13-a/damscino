// Makes the release build of the generated Android project use the Damascino upload key (DP_UPLOAD_* Gradle
// properties) instead of the debug key of the Expo template.
import fs from 'node:fs';

const file = process.argv[2];
let gradle = fs.readFileSync(file, 'utf8');
const release = `
        release {
            storeFile file(DP_UPLOAD_STORE_FILE)
            storePassword DP_UPLOAD_STORE_PASSWORD
            keyAlias DP_UPLOAD_KEY_ALIAS
            keyPassword DP_UPLOAD_KEY_PASSWORD
        }`;
gradle = gradle.replace(/signingConfigs\s*\{/, (match) => `${match}${release}`);
gradle = gradle.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/, '$1signingConfig signingConfigs.release');
fs.writeFileSync(file, gradle);
if (!gradle.includes('signingConfig signingConfigs.release')) {
  console.error('Release signing could not be configured');
  process.exit(1);
}
