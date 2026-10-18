'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
require('../faith-map-v18/data.js');
const data = globalThis.FaithMapV18Data;

function run(file) {
  const result = spawnSync(process.execPath, [file], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exit(result.status || 1);
  }
  process.stdout.write(result.stdout);
}

run('scripts/test-v18.cjs');
run('scripts/build-site-v18.cjs');
const dist = path.join(root, 'dist');
const expected = ['.nojekyll', 'app.js', 'build-manifest.json', 'data.js', 'index.html', 'people.js', 'robots.txt', 'score.js', 'share.js', 'styles.css', 'version.json'];
if (JSON.stringify(fs.readdirSync(dist).sort()) !== JSON.stringify(expected)) {
  throw new Error('배포 파일 허용 목록이 예상과 다릅니다.');
}
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
for (const file of ['styles.css', 'data.js', 'score.js', 'people.js', 'share.js', 'app.js']) {
  if (!new RegExp(`"${file.replace(".", "\\.")}(\\?v=[0-9a-f]{10})?"`).test(html)) throw new Error(`사이트 진입점에서 ${file} 파일을 참조하지 않습니다.`);
}
for (const file of ['app.js', 'data.js', 'score.js', 'people.js', 'share.js']) {
  new vm.Script(fs.readFileSync(path.join(dist, file), 'utf8'), { filename: file });
}
const publicContext = {};
vm.createContext(publicContext);
vm.runInContext(fs.readFileSync(path.join(dist, 'data.js'), 'utf8'), publicContext);
const publicData = JSON.parse(JSON.stringify(publicContext.FaithMapV18Data));
if (JSON.stringify(publicData.questions) !== JSON.stringify(data.questions)) {
  throw new Error('정적 호스팅에 필요한 채점 기준이 공개 데이터에 포함되지 않았습니다.');
}
if (!html.includes('</html>') || !html.includes('name="viewport"')) {
  throw new Error('배포 HTML 문서 구조가 올바르지 않습니다.');
}
const version = JSON.parse(fs.readFileSync(path.join(dist, 'version.json'), 'utf8'));
if (version.questionCount !== 31 || version.traditionCount !== 11) throw new Error('빌드 메타데이터 범위가 잘못되었습니다.');
console.log(JSON.stringify({
  releaseFiles: expected.length,
  scriptSyntax: 'passed',
  sourceCorpusInBundle: false,
  comparisonCriteriaInStaticBundle: true,
  clientScoring: 'configured'
}));
