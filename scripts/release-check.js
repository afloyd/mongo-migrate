const path = require('path');
const fs = require('fs');

function failWithMsg(msg) {
  console.error(msg);
  process.exit(1);
}

const root = path.resolve(__dirname, '../');
console.log('root dir->', root);
const pkgFile = path.join(root, 'package.json');
if (!fs.existsSync(pkgFile)) {
  failWithMsg(`File: ${pkgFile} doesn't exist!`);
}

const pkgInfo = JSON.parse(fs.readFileSync(pkgFile, 'utf-8'));
const pkgVer = pkgInfo.version;
const currentGitTag = process.env.CIRCLE_TAG;

console.log(`version in package.json: ${pkgVer}`);
console.log(`currrent git tag: ${currentGitTag}`);

if (!pkgInfo || !currentGitTag) {
  failWithMsg('No version found in package.json or no git tag found!');
}

if (pkgVer !== currentGitTag.substring(1)) {
  failWithMsg(
    `Current version computed from git tag(${currentGitTag}) is not equals version(${pkgVer}) in package.json`
  );
}

if (!pkgInfo.name.startsWith('@thimbledev/')) {
  failWithMsg(`invalid package name: ${pkgInfo.name}`);
}

// reference:
// 1. https://semver.org/
// 2. https://regex101.com/r/vkijKf/1/
const versionRegex =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

if (!versionRegex.test(pkgVer)) {
  failWithMsg(`version: ${pkgVer} in package.json is invalid.`);
}

const verParts = pkgVer.split(/[\.\-]/);
if (verParts.length < 3) {
  failWithMsg(`version: ${pkgVer} in pakcage.json is invalid.`);
}

console.log('👌 pass');
