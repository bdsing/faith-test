'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const packageData = require('../package.json');
const releaseData = require('../release.config.json');
require('../faith-map-v18/data.js');
const questionnaire = globalThis.FaithMapV18Data;

if (packageData.version !== releaseData.version || questionnaire.version !== releaseData.questionnaireVersion) {
  throw new Error('package.json, release.config.json, 문항 버전이 일치하지 않습니다.');
}

const check = spawnSync(process.execPath, ['scripts/check-v18.cjs'], {
  cwd: root,
  encoding: 'utf8',
  windowsHide: true
});
process.stdout.write(check.stdout || '');
process.stderr.write(check.stderr || '');
if (check.status !== 0) process.exit(check.status || 1);

const releaseRoot = path.join(root, 'releases');
const destination = path.join(releaseRoot, packageData.version);
if (fs.existsSync(destination)) throw new Error(`릴리스가 이미 존재합니다. 덮어쓰지 않습니다: ${destination}`);
fs.mkdirSync(releaseRoot, { recursive: true });
fs.mkdirSync(destination);
fs.cpSync(path.join(root, 'dist'), path.join(destination, 'site'), { recursive: true });
fs.writeFileSync(path.join(destination, 'release.json'), JSON.stringify({
  version: packageData.version,
  questionnaireVersion: questionnaire.version,
  createdAt: new Date().toISOString(),
  siteDirectory: 'site',
  publication: 'not-deployed'
}, null, 2) + '\n');
console.log(`정적 릴리스 준비 완료: releases/${packageData.version}/site`);
