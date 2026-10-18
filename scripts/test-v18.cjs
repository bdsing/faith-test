'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
require('../faith-map-v18/data.js');
const data = globalThis.FaithMapV18Data;
const scoring = require('../faith-map-v18/score.js');
const people = require('../faith-map-v18/people.js');
const share = require('../faith-map-v18/share.js');

assert.equal(data.version, 'v18-final.1');
assert.equal(data.questions.length, 31);
assert.equal(data.traditions.length, 11);
assert.equal(new Set(data.traditions.map(tradition => tradition.id)).size, 11);
assert.ok(data.traditions.every(tradition => !Object.hasOwn(tradition, 'people')));
assert.equal(data.traditions.find(item => item.id === 'presbyterian-tonghap').name, '장로교(통합권)');
assert.equal(data.traditions.find(item => item.id === 'presbyterian-hapdong').name, '장로교(합동권)');
assert.match(data.traditions.find(item => item.id === 'presbyterian-tonghap').intro, /예장통합·기장/);
assert.match(data.traditions.find(item => item.id === 'presbyterian-hapdong').intro, /예장합동·고신·합신/);
assert.match(data.traditions.find(item => item.id === 'presbyterian-hapdong').belief, /백석 등 일부 교단은 여성 안수를 시행/);
assert.ok(data.traditions.every(item => item.intro && item.worship && item.belief && item.keywords.length >= 3));
assert.equal(new Set(data.sections.map(section => section.title)).size, 5);
{
  const questionIds = new Set(data.questions.map(question => question.id));
  const byAxis = { x: [], y: [], z: [] };
  for (const [id, assigned] of Object.entries(data.mapAxes)) {
    assert.ok(questionIds.has(id), `${id} is not a question`);
    assert.equal(Object.keys(assigned).length, 1, `${id} must sit on one axis`);
    const [axis, direction] = Object.entries(assigned)[0];
    assert.ok(axis in byAxis && Math.abs(direction) === 1);
    byAxis[axis].push(id);
  }
  assert.deepEqual(byAxis.x, ['V14_20', 'V15_22', 'V16_24', 'V17_25', 'V18_27', 'V19_28', 'V20_30']);
  assert.equal(byAxis.y.length, 17);
  assert.deepEqual(byAxis.z.sort(), ['V02_04', 'V03_06', 'V04_08', 'V05_09', 'V06_37', 'V06_38']);
  assert.deepEqual([data.mapAxes.V06_33.y, data.mapAxes.V06_35.y, data.mapAxes.V02_04.z, data.mapAxes.V03_06.z, data.mapAxes.V04_08.z], [-1, -1, -1, -1, -1]);
  assert.equal(data.mapAxes.V08_12, undefined);
  // Tradition coordinates from reference-range midpoints (0~100).
  const coordinate = (tradition, axis) => {
    let sum = 0, weight = 0;
    for (const question of data.questions) {
      const direction = data.mapAxes[question.id]?.[axis];
      if (!direction) continue;
      const [low, high] = question.refs[tradition];
      const midpoint = (low + high) / 2;
      sum += question.weight * (direction > 0 ? midpoint : 1 - midpoint);
      weight += question.weight;
    }
    return Math.round(sum / weight * 100);
  };
  const catholic = data.traditions[0].id;
  assert.equal(coordinate(catholic, 'y'), 100);
  assert.equal(coordinate('presbyterian-hapdong', 'x'), 0);
  assert.ok(coordinate('pentecostal', 'x') > 80);
  assert.ok(coordinate('presbyterian-tonghap', 'z') > coordinate('presbyterian-hapdong', 'z') + 50);
}
assert.deepEqual(data.scale, [0, .25, .5, .75, 1]);
assert.deepEqual(data.sections.map(section => section.weight), [20, 27, 21, 20, 12]);
assert.equal(data.questions.reduce((sum, question) => sum + question.weight, 0), 100);
assert.deepEqual(data.sections.map((section, index) =>
  data.questions.filter(question => question.domain === index).reduce((sum, question) => sum + question.weight, 0)
), [20, 27, 21, 20, 12]);

for (const [index, question] of data.questions.entries()) {
  assert.equal(question.number, index + 1);
  assert.ok(question.title && question.left && question.right);
  assert.ok(question.weight > 0);
  assert.deepEqual(Object.keys(question.refs).sort(), data.traditions.map(t => t.id).sort());
  for (const range of Object.values(question.refs)) {
    assert.equal(range.length, 2);
    assert.ok(range[0] >= 0 && range[1] <= 1 && range[0] <= range[1]);
  }
  for (const value of data.scale) {
    const scores = data.traditions.map(entry => scoring.proximity(value, question.refs[entry.id]));
    assert.ok(Math.max(...scores) > 0, `${question.id} / ${value}: attainable maximum must be positive`);
  }
}

const Q = id => data.questions.find(question => question.id === id);
const tradition = id => data.traditions.find(entry => entry.id === id);
const midAnswer = { [Q('V01_01').id]: { value: .5 } };
const midScore = scoring.calculate(data, midAnswer);
const anglican = midScore.scored.find(entry => entry.tradition.id === 'anglican');
const catholic = midScore.scored.find(entry => entry.tradition.id === 'catholic');
assert.equal(anglican.score, 100);
assert.ok(Math.abs(catholic.score - 60.8) < 1);

const polarized = Q('V07_10');
const equalMiddle = scoring.calculate(data, { [polarized.id]: { value: .5 } });
assert.ok(equalMiddle.scored.every(entry => entry.score === 100));

const nearLeft = scoring.calculate(data, { [Q('V07_11').id]: { value: .25 } });
const left = nearLeft.scored.find(entry => entry.tradition.id === 'baptist');
const right = nearLeft.scored.find(entry => entry.tradition.id === 'catholic');
assert.equal(left.score, 100);
assert.ok(Math.abs(right.score - 37.2) < 1);

const twoAnswers = scoring.calculate(data, {
  [Q('V07_10').id]: { value: 0 },
  [Q('V06_37').id]: { value: 1 },
  [Q('V06_38').id]: { value: null, reason: 'unsure' }
});
assert.equal(twoAnswers.answered.length, 2);
assert.equal(twoAnswers.totalWeight, 7.5);
assert.equal(twoAnswers.domains[0].answeredWeight, 0);
assert.equal(twoAnswers.domains[1].answeredWeight, 2.5);
assert.ok(twoAnswers.scored.every(entry => entry.score >= 0 && entry.score <= 100));

const noAnswers = scoring.calculate(data, {});
assert.equal(noAnswers.scored.length, 11);
assert.ok(noAnswers.scored.every(entry => entry.score === null && entry.rank === null));
assert.equal(scoring.distance(.5, [0, 1]), .05);
assert.equal(scoring.distance(.25, [0, 0]), .25);
assert.ok(data.traditions.every(entry => entry.keywords.length >= 3 && entry.summary.length > 0));
assert.ok(Object.values(people.byTradition).every(candidates => candidates.length === 4));
assert.equal(Object.values(people.byTradition).flat().length, 44);
assert.equal(new Set(Object.values(people.byTradition).flat().map(person => person.name)).size, 44);
assert.ok(!Object.values(people.byTradition).flat().some(person => /이승구|김영한/.test(person.name)));
assert.deepEqual(
  people.byTradition.anglican.map(person => person.name),
  ['토머스 크랜머', '리처드 후커', 'C. S. 루이스', '로완 윌리엄스']
);

const shareAnswers = Object.fromEntries(data.questions.map((question, index) => [
  question.id,
  index % 7 === 0 ? { value: null, reason: 'unsure' }
    : index % 7 === 1 ? { value: null, reason: 'neither' }
      : { value: data.scale[index % data.scale.length] }
]));
const shareCalculation = scoring.calculate(data, shareAnswers);
const shareCode = share.encodeResult(data.traditions, shareCalculation.scored.map(entry => ({
  traditionId: entry.tradition.id,
  score: entry.score
})));
assert.equal(typeof share.encodeAnswers, 'undefined');
assert.match(shareCode, /^2[0-9a-z]{33}$/);
const decodedShare = share.decodeResult(data.traditions, shareCode);
assert.deepEqual(decodedShare.map(entry => Object.keys(entry).sort()), decodedShare.map(() => ['rank', 'score', 'traditionId']));
assert.deepEqual(decodedShare.map(entry => entry.traditionId), shareCalculation.scored.map(entry => entry.tradition.id));
assert.deepEqual(decodedShare.map(entry => entry.score), shareCalculation.scored.map(entry => Math.round(entry.score * 10) / 10));
const reshuffledAnswers = { ...shareAnswers, [data.questions[0].id]: { value: null, reason: 'neither' } };
assert.equal(share.encodeResult(data.traditions, scoring.calculate(data, reshuffledAnswers).scored.map(entry => ({
  traditionId: entry.tradition.id, score: entry.score
}))), shareCode, 'answer-only differences that do not change scores must not change the link');
assert.throws(() => share.decodeResult(data.traditions, 'invalid'), /결과 코드/);
assert.throws(() => share.decodeResult(data.traditions, '2' + '000'.repeat(11)), /결과 코드/);
const legacyMiddle = share.decodeLegacyAnswers(data.questions, '1SSSSSSSSSSSSSSSQ');
assert.ok(data.questions.every(question => legacyMiddle[question.id].value === .5));

const pageView = { innerHTML: '', querySelector: () => null };
const handlers = {};
const appSource = fs.readFileSync(path.join(__dirname, '../faith-map-v18/app.js'), 'utf8');
const fakeDocument = {
  getElementById: () => pageView,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: (type, handler) => { handlers[type] = handler; }
};
vm.runInNewContext(appSource, {
  document: fakeDocument,
  window: {
    FaithMapV18Data: data,
    FaithMapPeopleV18: people,
    FaithMapShareV18: share,
    location: { search: '' }
  },
  URLSearchParams,
  FaithMapScoreV18: scoring
});
handlers.click({
  target: {
    closest: selector => selector === '[data-action]' ? { dataset: { action: 'start' } } : null
  }
});
assert.match(pageView.innerHTML, /progress-track/);
assert.match(pageView.innerHTML, /0 \/ 31/);
assert.match(pageView.innerHTML, /section-steps/);
assert.match(pageView.innerHTML, /둘 다 내 생각과 다름/);
assert.doesNotMatch(pageView.innerHTML, /사회·에큐메니칼·성경·교회 직제|자동 저장|응답 저장 상태/);
assert.match(pageView.innerHTML, /첫 번째 문장/);
assert.match(pageView.innerHTML, /두 번째 문장/);
assert.equal((pageView.innerHTML.match(/data-question-card=/g) || []).length, 5);
assert.match(pageView.innerHTML, /동의/);
assert.match(pageView.innerHTML, /조금 동의/);
assert.match(appSource, /function domainVectors\(selected\)/);
assert.match(appSource, /<p class="start-notice"><strong>배운 내용을 테스트하는 것이 아닙니다\. 본인의 주관대로 테스트해 주세요\.<\/strong><\/p>\s*<button class="button button-primary start-button"/);
assert.match(appSource, /소속 교파 선택은 점수에 영향을 주지 않습니다\./);
assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../faith-map-v18/index.html'), 'utf8'), /응답이 포함됩니다/);
assert.match(appSource, /5개 영역별 점수/);
assert.match(appSource, /내 답변 살펴보기/);
assert.match(appSource, /내 답변과 선택한 교파를 영역별로 비교합니다\./);
assert.doesNotMatch(appSource, /map-axis-guides|<b>세로축<\/b>|<b>가로축<\/b>|왼쪽 문장 쪽은 0점/);
assert.match(appSource, /\(weight\[axis\] \? sum\[axis\] \/ weight\[axis\] : \.5\) \* 100/);
assert.doesNotMatch(appSource, /가운데 교점은 두 축의 절대 0점|map-endpoint|layoutMapLabels/);
assert.match(appSource, /class="spectrum-scale"/);
assert.match(appSource, /traditionSlideIndex = Number\(button\.dataset\.index\)/);
assert.doesNotMatch(appSource, /<div class="block-heading"><span>0\d<\/span>/);
{
  // Axis end labels stay on their own ends and never overlap, whatever the rotation.
  const helpers = ['mapFontScale', 'mapTextWidth', 'mapAxisLabels'].map(name => appSource.match(new RegExp(`  function ${name}\\([\\s\\S]*?\\r?\\n  \\}\\r?\\n`))[0]).join('');
  const axisLabels = vm.runInNewContext(`${helpers}; mapAxisLabels`);
  const info = { title: 'X축 · 구원과 영성', low: '구원의 확신', high: '성화의 여정' };
  for (let angle = 0; angle < 360; angle += 15) {
    for (const length of [120, 200, 300]) {
      const dx = Math.cos(angle * Math.PI / 180) * length / 2, dy = Math.sin(angle * Math.PI / 180) * length / 2;
      const svg = axisLabels({ x: 380 - dx, y: 270 - dy }, { x: 380 + dx, y: 270 + dy }, { x: 380, y: 200 }, info);
      const ends = [...svg.matchAll(/class="map-axis-end" x="([-\d.]+)"[^>]*text-anchor="(start|end)"[^>]*>([^<]+)</g)];
      assert.equal(ends.length, 2);
      const spans = ends.map(([, x, anchor, text]) => {
        const width = [...text].reduce((sum, c) => sum + 10.5 * (/[\u3131-\uD79D]/.test(c) ? .95 : c === ' ' ? .3 : .6), 0) * .8;
        return anchor === 'start' ? [Number(x), Number(x) + width] : [Number(x) - width, Number(x)];
      }).sort((p, q) => p[0] - q[0]);
      assert.ok(spans[0][1] <= spans[1][0], `axis end labels overlap at ${angle}° / ${length}`);
      assert.ok(ends.some(match => match[3].startsWith('← ')) && ends.some(match => match[3].endsWith(' →')));
    }
  }
  assert.match(appSource, /pointermove/);
  assert.match(appSource, /action === 'map-view'/);
}
assert.doesNotMatch(appSource, /가까운 교파 TOP 3|1위 교파를 원점/);
assert.equal((appSource.match(/<select name="comparison-tradition"/g) || []).length, 1);
assert.doesNotMatch(appSource, /5개 영역 적합도|1위 교파와 비교하기/);
assert.doesNotMatch(appSource, /painting\(|FaithMapArtV18/);

const css = fs.readFileSync(path.join(__dirname, '../faith-map-v18/styles.css'), 'utf8');
assert.doesNotMatch(css, /\.map-y-labels\s*\{[^}]*rotate\(180deg\)/);
assert.doesNotMatch(css, /\.spectrum-comparison-labels \.your-label::before\s*\{[^}]*(?:width:\s*3px|border-radius:\s*0)/);
assert.match(css, /\.poles\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*1fr 1fr;/);
const mobileStyles = css.slice(css.indexOf('@media (max-width: 760px)'), css.indexOf('@media (max-width: 520px)'));
assert.doesNotMatch(mobileStyles, /\.poles\s*\{[^}]*grid-template-columns:\s*1fr\s*;/);

const legacyMiddleCode = '1SSSSSSSSSSSSSSSQ';
function renderResultsWith(source, search, counted = []) {
  const resultView = { innerHTML: '', querySelector: () => null };
  const replaced = [];
  vm.runInNewContext(source, {
    document: {
      getElementById: () => resultView,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    },
    window: {
      FaithMapV18Data: data,
      FaithMapPeopleV18: people,
      FaithMapShareV18: share,
      goatcounter: { count: event => counted.push(event) },
      location: { search, href: `https://example.test/faith-test/${search}` },
      history: { replaceState: (state, title, url) => replaced.push(String(url)) }
    },
    URL,
    URLSearchParams,
    FaithMapScoreV18: scoring
  });
  return { html: resultView.innerHTML, replaced };
}

// Post-quiz results: same rendering path with sharedView disabled.
const normalSource = appSource.replace('showSharedResult(resultCode);',
  'answers = shareCodec.decodeLegacyAnswers(data.questions, sharedCode); sharedView = false; void requestResults();');
assert.notEqual(normalSource, appSource);
const normalCounted = [];
const resultsView = { innerHTML: renderResultsWith(normalSource, `?r=${legacyMiddleCode}`, normalCounted).html };
assert.deepEqual(JSON.parse(JSON.stringify(normalCounted)), [{ path: 'test-complete', title: '테스트 완료', event: true }]);
const indexHtml = fs.readFileSync(path.join(__dirname, '../faith-map-v18/index.html'), 'utf8');
assert.match(indexHtml, /data-goatcounter="https:\/\/bdsing\.goatcounter\.com\/count"/);
assert.match(indexHtml, /window\.goatcounter = \{ path: function \(\) \{ return window\.location\.pathname; \} \};/);
assert.equal((appSource.match(/trackEvent\('/g) || []).length, 2);
assert.match(appSource, /trackEvent\('test-start', '테스트 시작'\)/);
assert.match(resultsView.innerHTML, /내 답변 살펴보기/);
assert.match(resultsView.innerHTML, /data-action="share"/);
assert.match(resultsView.innerHTML, /내 응답은 포함되지 않습니다/);
assert.match(resultsView.innerHTML, /class="results-summary-grid"/);
assert.match(resultsView.innerHTML, /<p>당신과 닮아있는 대표 인물을 소개합니다\.<\/p>/);
assert.equal((resultsView.innerHTML.match(/class="podium-card"/g) || []).length, 2);
assert.match(resultsView.innerHTML, /<h2 id="tradition-explanations-title">교파별 설명<\/h2>/);
assert.match(resultsView.innerHTML, /class="tradition-choices" role="group"/);
assert.equal((resultsView.innerHTML.match(/data-action="tradition-select"/g) || []).length, 11);
assert.match(resultsView.innerHTML, /<option value="anglican" selected>/);
assert.equal((resultsView.innerHTML.match(/<option [^>]*selected>/g) || []).length, 1);
assert.match(appSource, /resultsLoading\(\);\r?\n    window\.scrollTo\?\.\(0, 0\);/);
assert.match(resultsView.innerHTML, /class="tradition-choice is-active"[^>]*aria-pressed="true">성공회<\/button>/);
assert.doesNotMatch(resultsView.innerHTML, /tradition-slides|slide-button|data-action="tradition-slide"/);
assert.match(resultsView.innerHTML, /<article class="tradition-detail"[^>]*>\s*<h2>성공회<\/h2>/);
assert.doesNotMatch(resultsView.innerHTML, /가까운 교파 TOP 3|spectrum-track|spectrum-range/);
assert.equal((resultsView.innerHTML.match(/class="spectrum-step/g) || []).length, 31 * 5);
assert.match(resultsView.innerHTML, /<h2>나의 신앙 좌표<\/h2><p>드래그 하여 움직일 수 있습니다\.<\/p>/);
assert.equal((resultsView.innerHTML.match(/data-action="map-view"/g) || []).length, 4);
assert.match(resultsView.innerHTML, /class="map-view-button is-active" data-action="map-view" data-mode="3d" aria-pressed="true">3D 입체뷰/);
assert.match(resultsView.innerHTML, /aria-label="나의 신앙 좌표\(0~100\): 구원과 영성 \d+, 예배의 태도 \d+, 공적·사회적 태도 \d+\./);
assert.equal((resultsView.innerHTML.match(/class="map-point"/g) || []).length, 11);
assert.equal((resultsView.innerHTML.match(/class="map-point map-point-me"/g) || []).length, 1);
for (const label of ['X축 · 구원과 영성', 'Y축 · 예배의 태도', 'Z축 · 공적·사회적 태도', '↑ 사회적 실천·열린 연대', '↓ 규범 준수·내부 안정']) {
  assert.ok(resultsView.innerHTML.includes(label), label);
}
assert.doesNotMatch(resultsView.innerHTML, /NaN|undefined/);

const answerDetailPattern = /내 답변|spectrum-|faith-map-chart|radar|domain-grid|person-grid|rank-explanation|affinity|tradition-panel|tradition-choices|comparison-tradition|review-answers|data-action="share"|<details/;
const legacyCounted = [];
const legacyShared = renderResultsWith(appSource, `?r=${legacyMiddleCode}`, legacyCounted);
assert.equal(legacyCounted.length, 0);
assert.equal(legacyShared.replaced.length, 1);
const upgradedCode = new URL(legacyShared.replaced[0]).searchParams.get('r');
assert.match(upgradedCode, /^2[0-9a-z]{33}$/);
for (const shared of [legacyShared, renderResultsWith(appSource, `?r=${upgradedCode}`)]) {
  assert.match(shared.html, /<h1>당신은 '성공회'에 가장 가깝습니다!<\/h1>/);
  assert.match(shared.html, /class="results-summary-grid"/);
  assert.equal((shared.html.match(/class="podium-card"/g) || []).length, 2);
  assert.equal((shared.html.match(/class="rank-detail rank-static"/g) || []).length, 11);
  assert.match(shared.html, /<h2>교파별 점수<\/h2>/);
  assert.match(shared.html, /data-action="retake"/);
  assert.doesNotMatch(shared.html, answerDetailPattern);
}
assert.equal(renderResultsWith(appSource, `?r=${upgradedCode}`).replaced.length, 0);

console.log(JSON.stringify({
  status: 'passed',
  questions: data.questions.length,
  traditions: data.traditions.length,
  resultSuggestions: 'one representative for each top-three tradition',
  scale: data.scale,
  domains: data.sections.length,
  questionLayout: 'unlabeled, side-by-side, progress bar only',
  illustrations: 'removed',
  metric: 'attainable-max normalized ideal-point proximity',
  map: '3D X·Y·Z (0~100) with rotatable view and X·Y/X·Z/Y·Z planes',
  answerComparisons: 'five discrete scale markers',
  shareLinks: 'denomination order and rounded scores only'
}));
