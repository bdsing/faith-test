'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'faith-map-v18');
const dist = path.join(root, 'dist');
const manifest = require('../package.json');
require('../faith-map-v18/data.js');
const data = globalThis.FaithMapV18Data;
const publicFiles = ['index.html', 'styles.css', 'data.js', 'score.js', 'people.js', 'share.js', 'app.js', 'robots.txt', '.nojekyll', 'version.json'];

function build() {
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
  for (const file of publicFiles.filter(name => name !== 'version.json' && name !== 'data.js')) {
    const filePath = path.join(source, file);
    if (file === '.nojekyll') {
      fs.writeFileSync(path.join(dist, file), '');
      continue;
    }
    assert.ok(fs.existsSync(filePath), `배포 원본 파일이 없습니다: ${file}`);
    fs.copyFileSync(filePath, path.join(dist, file));
  }
  const publicData = data;
  fs.writeFileSync(path.join(dist, 'data.js'),
    `globalThis.FaithMapV18Data = ${JSON.stringify(publicData)};\n`);
  const version = {
    releaseVersion: manifest.version,
    questionnaireVersion: data.version,
    questionCount: data.questions.length,
    traditionCount: data.traditions.length,
    generatedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(dist, 'version.json'), JSON.stringify(version, null, 2) + '\n');
  const actualFiles = fs.readdirSync(dist).sort();
  assert.deepEqual(actualFiles, publicFiles.slice().sort(), '배포 폴더에 허용된 파일만 있어야 합니다.');
  const hashes = Object.fromEntries(publicFiles.map(file => [
    file, crypto.createHash('sha256').update(fs.readFileSync(path.join(dist, file))).digest('hex')
  ]));
  fs.writeFileSync(path.join(dist, 'build-manifest.json'), JSON.stringify({ ...version, hashes }, null, 2) + '\n');
  console.log(JSON.stringify({ version: manifest.version, output: 'dist', publicFiles, researchFilesIncluded: false, clientSideScoring: true }));
}

build();
