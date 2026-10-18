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
assert.equal(data.mapAxes.V06_37.y, -1);
assert.equal(data.mapAxes.V06_38.y, -1);
assert.equal(data.mapAxes.V02_04.y, 1);
assert.equal(data.mapAxes.V07_11.x, 1);
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
assert.match(appSource, /5개 영역별 점수/);
assert.match(appSource, /내 답변 살펴보기/);
assert.match(appSource, /내 답변과 선택한 교파를 영역별로 비교합니다\./);
assert.doesNotMatch(appSource, /map-axis-guides|<b>세로축<\/b>|<b>가로축<\/b>|왼쪽 문장 쪽은 0점/);
assert.match(appSource, /\(weight\.x \? sum\.x \/ weight\.x : \.5\) \* 2 - 1/);
assert.match(appSource, /\(weight\.y \? sum\.y \/ weight\.y : \.5\) \* 2 - 1/);
assert.match(appSource, /가운데 교점은 두 축의 절대 0점/);
assert.match(appSource, /class="spectrum-scale"/);
assert.match(appSource, /traditionSlideIndex \+= Number\(button\.dataset\.direction\)/);
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
function renderResultsWith(source, search) {
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
const resultsView = { innerHTML: renderResultsWith(normalSource, `?r=${legacyMiddleCode}`).html };
assert.match(resultsView.innerHTML, /내 답변 살펴보기/);
assert.match(resultsView.innerHTML, /data-action="share"/);
assert.match(resultsView.innerHTML, /내 응답은 포함되지 않습니다/);
assert.match(resultsView.innerHTML, /class="results-summary-grid"/);
assert.match(resultsView.innerHTML, /<p>당신과 닮아있는 대표 인물을 소개합니다\.<\/p>/);
assert.equal((resultsView.innerHTML.match(/class="podium-card"/g) || []).length, 2);
assert.match(resultsView.innerHTML, /<h2 id="tradition-explanations-title">교파별 설명<\/h2>/);
assert.match(resultsView.innerHTML, /class="tradition-slides"/);
assert.match(resultsView.innerHTML, /<span aria-live="polite">3 \/ 11<\/span>/);
assert.match(resultsView.innerHTML, /<article class="tradition-slide"[^>]*>\s*<h2>성공회<\/h2>/);
assert.doesNotMatch(resultsView.innerHTML, /가까운 교파 TOP 3|spectrum-track|spectrum-range/);
assert.equal((resultsView.innerHTML.match(/class="spectrum-step/g) || []).length, 31 * 5);
assert.match(resultsView.innerHTML, /<circle cx="360" cy="220" r="9"><\/circle><text x="360" y="224">나<\/text>/);
assert.match(resultsView.innerHTML, /<text class="map-zero" x="368" y="212">0<\/text>/);
assert.equal((resultsView.innerHTML.match(/class="map-endpoint map-endpoint-/g) || []).length, 4);
assert.match(resultsView.innerHTML, /map-endpoint-top" x="360" y="34"/);
assert.match(resultsView.innerHTML, /map-endpoint-bottom" x="360" y="399"/);
assert.match(resultsView.innerHTML, /map-endpoint-left" x="106" y="212"/);
assert.match(resultsView.innerHTML, /map-endpoint-right" x="614" y="212"/);

const answerDetailPattern = /내 답변|spectrum-|faith-map-chart|radar|domain-grid|person-grid|rank-explanation|affinity|tradition-slides|comparison-tradition|review-answers|data-action="share"|<details/;
const legacyShared = renderResultsWith(appSource, `?r=${legacyMiddleCode}`);
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
  mapOrigin: 'absolute zero at the centered axis intersection',
  answerComparisons: 'five discrete scale markers',
  shareLinks: 'denomination order and rounded scores only'
}));
