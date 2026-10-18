'use strict';
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const publicFiles = ['index.html', 'styles.css', 'data.js', 'score.js', 'people.js', 'share.js', 'app.js', 'version.json', 'robots.txt', '.nojekyll'];
function sourceFiles() {
  return [
    'package.json',
    'release.config.json',
    'README.md',
    'HOSTING.md',
    'faith-map-v18/index.html',
    'faith-map-v18/styles.css',
    'faith-map-v18/data.js',
    'faith-map-v18/score.js',
    'faith-map-v18/people.js',
    'faith-map-v18/share.js',
    'faith-map-v18/app.js',
    'faith-map-v18/robots.txt',
    'scripts/build-site-v18.cjs',
    'scripts/check-v18.cjs',
    'scripts/test-v18.cjs',
  ];
}
module.exports = { root, publicFiles, sourceFiles };
