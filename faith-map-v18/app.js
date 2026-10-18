(function () {
  'use strict';
  const data = window.FaithMapV18Data;
  const people = window.FaithMapPeopleV18;
  const shareCodec = window.FaithMapShareV18;
  const view = document.getElementById('view');
  const choices = [
    { value: 0, label: '동의', side: '첫 번째 문장' },
    { value: .25, label: '조금 동의', side: '첫 번째 문장' },
    { value: .5, label: '중립', side: '두 문장 모두' },
    { value: .75, label: '조금 동의', side: '두 번째 문장' },
    { value: 1, label: '동의', side: '두 번째 문장' }
  ];
  let answers = Object.create(null);
  let profile = { nickname: '', affiliation: '' };
  let currentSection = 0;
  let page = 'intro';
  let resultModel = null;
  let resultRequestId = 0;
  let sharedView = false;
  let comparisonId = '';
  let traditionSlideIndex = 0;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  function announce(message) {
    const status = view.querySelector('#live-status');
    if (status) status.textContent = message;
  }

  function intro() {
    page = 'intro';
    const affiliationOptions = data.traditions.map(tradition =>
      `<option value="${escapeHtml(tradition.id)}" ${profile.affiliation === tradition.id ? 'selected' : ''}>${escapeHtml(tradition.name)}</option>`
    ).join('');
    view.innerHTML = `<section class="intro">
      <h1>기독교 신앙 성향 <span>TEST</span></h1>
      <p class="intro-copy">응답하신 31개 문항을 분석해 기독교 신앙의 성향을 알려드립니다.</p>
      <div class="profile-fields">
        <label>닉네임 <span>선택</span><input name="nickname" maxlength="30" autocomplete="nickname" value="${escapeHtml(profile.nickname)}" placeholder="닉네임"></label>
        <label>현재 소속 교파 <span>선택</span><select name="affiliation">
          <option value="">선택 안 함</option>${affiliationOptions}
          <option value="other" ${profile.affiliation === 'other' ? 'selected' : ''}>무교 / 기타</option>
        </select></label>
      </div>
      <p class="profile-note">닉네임과 현재 소속은 이 브라우저 안에서만 사용합니다.</p>
      <button class="button button-primary start-button" data-action="start">테스트 시작 <span aria-hidden="true">↗</span></button>
    </section>`;
  }

  function answerCount() {
    return Object.keys(answers).length;
  }

  function questionCard(question) {
    const answer = answers[question.id];
    const selected = answer?.value;
    const scale = choices.map((choice, index) => {
      const checked = selected === choice.value;
      const accessible = index < 2
        ? `첫 번째 문장에 ${index === 0 ? '동의' : '조금 동의'}`
        : index === 2 ? '두 문장 모두, 중립'
          : `두 번째 문장에 ${index === 4 ? '동의' : '조금 동의'}`;
      return `<label class="scale-option${checked ? ' is-selected' : ''}">
        <input type="radio" name="answer-${question.id}" data-question-id="${question.id}" value="${choice.value}" aria-label="${accessible}" ${checked ? 'checked' : ''}>
        <span class="scale-dot"><i></i></span>
        <span class="scale-label">${choice.label}</span>
      </label>`;
    }).join('');
    const reason = answer?.reason;
    return `<article class="question-card" data-question-card="${question.id}">
      <div class="question-heading"><span>${String(question.number).padStart(2, '0')}</span><h2>${escapeHtml(question.title)}</h2></div>
      <div class="poles" role="group" aria-label="비교 문장">
        <p>${escapeHtml(question.left)}</p>
        <p>${escapeHtml(question.right)}</p>
      </div>
      <fieldset class="scale-field">
        <legend>어느 쪽 생각에 더 가까우신가요?</legend>
        <div class="scale-row">${scale}</div>
        <div class="axis-caption"><span>첫 번째 문장</span><span>두 문장이 비슷하면 가운데</span><span>두 번째 문장</span></div>
      </fieldset>
      <div class="nonanswer-options" aria-label="별도 응답">
        <button type="button" class="nonanswer-option${reason === 'unsure' ? ' is-selected' : ''}" data-action="answer-nonvalue" data-question-id="${question.id}" data-reason="unsure" aria-pressed="${reason === 'unsure'}">잘 모르겠음</button>
        <button type="button" class="nonanswer-option${reason === 'neither' ? ' is-selected' : ''}" data-action="answer-nonvalue" data-question-id="${question.id}" data-reason="neither" aria-pressed="${reason === 'neither'}">둘 다 내 생각과 다름</button>
      </div>
    </article>`;
  }

  function sectionSteps() {
    return data.sections.map((section, index) => `<button class="section-step${index === currentSection ? ' is-current' : ''}${data.questions.filter(question => question.domain === index).every(question => Object.hasOwn(answers, question.id)) ? ' is-complete' : ''}"
      data-action="section-page" data-section="${index}" aria-label="${index + 1}번째 영역" aria-current="${index === currentSection ? 'step' : 'false'}">${index + 1}</button>`).join('');
  }

  function questionView() {
    page = 'quiz';
    const sectionQuestions = data.questions.filter(question => question.domain === currentSection);
    const completed = answerCount();
    const finalPage = currentSection === data.sections.length - 1;
    view.innerHTML = `<section class="question-view">
      <div class="question-top"><span class="progress-count">${completed} / ${data.questions.length}</span></div>
      <div class="progress-track" role="progressbar" aria-label="응답 진행률" aria-valuemin="0" aria-valuemax="${data.questions.length}" aria-valuenow="${completed}"><i style="width:${completed / data.questions.length * 100}%"></i></div>
      <nav class="section-steps" aria-label="5개 영역 이동">${sectionSteps()}</nav>
      <div class="question-list">${sectionQuestions.map(questionCard).join('')}</div>
      <div class="question-nav">
        <button class="button button-quiet" data-action="previous-section" ${currentSection > 0 ? '' : 'disabled'}>이전</button>
        <span class="live-status" aria-hidden="true"></span>
        <button class="button button-primary" data-action="${finalPage ? 'finish' : 'next-section'}" ${finalPage && completed !== data.questions.length ? 'disabled' : ''}>${finalPage ? '결과 보기' : '다음'} <span aria-hidden="true">→</span></button>
      </div>
    </section>`;
  }

  function updateQuizProgress() {
    const completed = answerCount();
    const count = view.querySelector('.progress-count');
    const progress = view.querySelector('.progress-track');
    const fill = progress?.querySelector('i');
    const finish = view.querySelector('[data-action="finish"]');
    if (count) count.textContent = `${completed} / ${data.questions.length}`;
    if (progress) progress.setAttribute('aria-valuenow', String(completed));
    if (fill) fill.style.width = `${completed / data.questions.length * 100}%`;
    if (finish) finish.disabled = completed !== data.questions.length;
    view.querySelectorAll('.section-step').forEach((step, index) => {
      const complete = data.questions.filter(question => question.domain === index)
        .every(question => Object.hasOwn(answers, question.id));
      step.classList.toggle('is-complete', complete);
    });
  }

  function setAnswer(questionId, answer) {
    answers[questionId] = answer;
    const card = view.querySelector(`[data-question-card="${questionId}"]`);
    if (card) {
      if (answer.value === null) card.querySelectorAll('input[type="radio"]').forEach(input => {
        input.checked = false;
      });
      card.querySelectorAll('.scale-option').forEach(option => {
        const input = option.querySelector('input');
        option.classList.toggle('is-selected', Boolean(input?.checked));
      });
      card.querySelectorAll('.nonanswer-option').forEach(button => {
        const active = button.dataset.reason === answer.reason;
        button.classList.toggle('is-selected', active);
        button.setAttribute('aria-pressed', String(active));
      });
    }
    updateQuizProgress();
  }

  function leaders() {
    return resultModel.scored.filter(entry => Number.isFinite(entry.score)).slice(0, 3);
  }

  function keywordTags(tradition) {
    return `<div class="keyword-list">${tradition.keywords.map(keyword =>
      `<span>${escapeHtml(keyword)}</span>`).join('')}</div>`;
  }

  function descriptionHtml(tradition) {
    return `<div class="tradition-description">
      <p><b>소개</b>${escapeHtml(tradition.intro)}</p>
      <p><b>예배</b>${escapeHtml(tradition.worship)}</p>
      <p><b>믿음</b>${escapeHtml(tradition.belief)}</p>
    </div>`;
  }

  function podiumCards(entries) {
    return entries.slice(1, 3).map((entry, index) => `<article class="podium-card" style="--tradition:${entry.tradition.color}">
      <span class="rank-badge">${index + 2}위</span>
      <h3>${escapeHtml(entry.tradition.name)}</h3>
      <strong>${entry.score.toFixed(1)}<small>점</small></strong>
    </article>`).join('');
  }

  function selectedComparison() {
    const top = leaders();
    if (!top.length) return [];
    if (!comparisonId) {
      const preferred = data.traditions.some(tradition => tradition.id === profile.affiliation)
        ? profile.affiliation : '';
      comparisonId = preferred && preferred !== top[0].tradition.id
        ? preferred : (top[2]?.tradition.id || top[1]?.tradition.id || top[0].tradition.id);
    }
    return resultModel.scored.find(entry => entry.tradition.id === comparisonId) || top[0];
  }

  function domainVectors(selected) {
    return data.sections.map(section => {
      const questions = data.questions.filter(question => question.domain === section.id
        && Number.isFinite(answers[question.id]?.value));
      const weight = questions.reduce((sum, question) => sum + question.weight, 0);
      const score = read => weight > 0
        ? 100 * questions.reduce((sum, question) => sum + question.weight * read(question), 0) / weight
        : null;
      return {
        section,
        userScore: score(question => answers[question.id].value),
        traditionScore: score(question => {
          const range = resultModel.questionRanges[question.id]?.[selected.tradition.id];
          return range ? (range[0] + range[1]) / 2 : .5;
        })
      };
    });
  }

  function radarChart(selected, vectors) {
    const width = 480, height = 330, centerX = 240, centerY = 154, radius = 99;
    const angle = index => -Math.PI / 2 + index * Math.PI * 2 / data.sections.length;
    const point = (index, value) => {
      const distance = radius * (value ?? 50) / 100;
      return [centerX + Math.cos(angle(index)) * distance, centerY + Math.sin(angle(index)) * distance];
    };
    const rings = [.25, .5, .75, 1].map(level => {
      const points = data.sections.map((_, index) => {
        const [x, y] = point(index, level * 100);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      return `<polygon class="radar-ring" points="${points}"></polygon>`;
    }).join('');
    const axes = data.sections.map((section, index) => {
      const [x, y] = point(index, 100);
      const [lx, ly] = point(index, 135);
      const anchor = lx < centerX - 10 ? 'end' : lx > centerX + 10 ? 'start' : 'middle';
      return `<line class="radar-axis" x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}"></line>
        <text class="radar-label" x="${lx}" y="${ly}" text-anchor="${anchor}">${escapeHtml(section.short)}</text>`;
    }).join('');
    const areas = [
      { name: '내 점수', color: '#b8584f', values: vectors.map(item => item.userScore) },
      { name: selected.tradition.name, color: selected.tradition.color, values: vectors.map(item => item.traditionScore) }
    ].map((series, seriesIndex) => {
      const points = series.values.map((value, index) => {
        const [x, y] = point(index, value);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
      return `<polygon class="radar-area radar-area-${seriesIndex + 1}" points="${points}" style="--tradition:${series.color}"></polygon>`;
    }).join('');
    const legend = `<span class="your-label"><i></i>내 점수</span><span style="--tradition:${selected.tradition.color}"><i></i>${escapeHtml(selected.tradition.name)}</span>`;
    return `<div class="radar-wrap">
      <svg class="radar-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="내 점수와 ${escapeHtml(selected.tradition.name)}의 다섯 영역별 점수 비교">
        ${rings}${axes}${areas}<circle class="radar-center" cx="${centerX}" cy="${centerY}" r="2"></circle>
      </svg>
      <div class="radar-legend">${legend}</div>
    </div>`;
  }

  function domainCards(selected, vectors) {
    return vectors.map(({ section, userScore, traditionScore }) => {
      const difference = userScore === null ? null : traditionScore - userScore;
      const scoreRow = (label, score, color) => `<div class="domain-score" style="--tradition:${color}">
        <span>${label}</span><div class="domain-track"><i style="width:${score ?? 0}%"></i></div>
        <b>${score === null ? '—' : `${score.toFixed(0)}점`}</b>
      </div>`;
      return `<article class="domain-card">
        <div class="domain-heading"><span>${String(section.id + 1).padStart(2, '0')}</span><h3>${escapeHtml(section.title)}</h3></div>
        <div class="domain-bars">
          ${scoreRow('내 점수', userScore, '#b8584f')}
          ${scoreRow(escapeHtml(selected.tradition.name), traditionScore, selected.tradition.color)}
        </div>
        <p class="domain-difference">${difference === null ? '응답 없음' : `차이 ${difference > 0 ? '+' : ''}${difference.toFixed(0)}점`}</p>
      </article>`;
    }).join('');
  }

  function questionAffinity(entry) {
    const matches = data.questions
      .filter(question => Number.isFinite(answers[question.id]?.value))
      .map(question => ({
        question,
        distance: FaithMapScoreV18.proximity(
          answers[question.id].value,
          resultModel.questionRanges[question.id][entry.tradition.id]
        )
      }));
    return {
      similar: matches.slice().sort((a, b) => b.distance - a.distance).slice(0, 3),
      different: matches.slice().sort((a, b) => a.distance - b.distance).slice(0, 3)
    };
  }

  function affinityList(title, items) {
    return `<div class="affinity-group"><h4>${title}</h4>${items.length
      ? `<ul>${items.map(({ question }) => `<li><span>${escapeHtml(question.title)}</span><small>${escapeHtml(answerLabel(answers[question.id]))}</small></li>`).join('')}</ul>`
      : '<p>비교할 답변이 없습니다.</p>'}</div>`;
  }

  function rankingList() {
    return resultModel.scored.map(entry => {
      const affinity = resultModel.totalWeight > 0 ? questionAffinity(entry) : { similar: [], different: [] };
      return `<details class="rank-detail" style="--tradition:${entry.tradition.color}">
        <summary class="rank-row">
          <span class="rank-index">${entry.rank ? `${entry.rank}위` : '—'}</span>
          <span class="rank-row-name">${escapeHtml(entry.tradition.name)}</span>
          <span class="rank-meter"><i style="width:${entry.score ?? 0}%"></i></span>
          <b>${entry.score === null ? '—' : `${entry.score.toFixed(1)}점`}</b>
          <span class="rank-chevron" aria-hidden="true"></span>
        </summary>
        <div class="rank-explanation">
          <div class="affinity-grid">${affinityList('나와 닮은 답변', affinity.similar)}${affinityList('다른 방향의 답변', affinity.different)}</div>
        </div>
      </details>`;
    }).join('');
  }

  function answerLabel(answer) {
    if (!answer) return '응답 없음';
    if (answer.value === null) return answer.reason === 'neither'
      ? '둘 다 내 생각과 다름' : '잘 모르겠음';
    const selected = choices.find(choice => choice.value === answer.value);
    return `${selected.side}에 ${selected.label}`;
  }

  function questionSpectrum(question, comparison) {
    const answer = answers[question.id];
    const comparisonRange = resultModel.questionRanges[question.id][comparison.tradition.id];
    const reference = (comparisonRange[0] + comparisonRange[1]) / 2;
    const nearestScaleIndex = value => data.scale.reduce((bestIndex, option, index) =>
      Math.abs(option - value) < Math.abs(data.scale[bestIndex] - value) ? index : bestIndex, 0);
    const userIndex = Number.isFinite(answer?.value) ? nearestScaleIndex(answer.value) : -1;
    const traditionIndex = nearestScaleIndex(reference);
    const scale = data.scale.map((_, index) => {
      const userMark = index === userIndex;
      const traditionMark = index === traditionIndex;
      const mark = userMark && traditionMark ? 'is-overlap'
        : userMark ? 'is-user' : traditionMark ? 'is-tradition' : '';
      return `<span class="spectrum-step ${mark}" aria-hidden="true"><i></i></span>`;
    }).join('');
    return `<details class="spectrum-question">
      <summary>
        <span class="spectrum-num">${String(question.number).padStart(2, '0')}</span>
        <span>${escapeHtml(question.title)}</span>
        <span class="spectrum-answer">${escapeHtml(answerLabel(answer))}</span>
        <i class="chevron" aria-hidden="true"></i>
      </summary>
      <div class="spectrum-body" style="--tradition-comparison:${comparison.tradition.color}">
        <div class="spectrum-poles"><span>${escapeHtml(question.left)}</span><span>${escapeHtml(question.right)}</span></div>
        <div class="spectrum-comparison-labels"><span style="--tradition:${comparison.tradition.color}">${escapeHtml(comparison.tradition.name)} 기준</span><span class="your-label">내 답변</span></div>
        <div class="spectrum-scale" role="img" aria-label="다섯 단계 척도에서 교파 기준과 내 답변 위치">${scale}</div>
        <div class="axis-caption"><span>첫 번째 문장</span><span>두 번째 문장</span></div>
      </div>
    </details>`;
  }

  function mapCoordinateModel() {
    const sums = { user: { x: 0, y: 0 }, tradition: Object.fromEntries(
      data.traditions.map(tradition => [tradition.id, { x: 0, y: 0 }])
    ) };
    const weights = { user: { x: 0, y: 0 }, tradition: { x: 0, y: 0 } };
    for (const question of data.questions) {
      const axes = data.mapAxes[question.id];
      const references = resultModel.questionRanges?.[question.id];
      if (!axes || !references) continue;
      const answer = answers[question.id]?.value;
      for (const axis of ['x', 'y']) {
        const direction = axes[axis];
        if (!direction) continue;
        if (Number.isFinite(answer)) {
          const coordinate = direction > 0 ? answer : 1 - answer;
          sums.user[axis] += question.weight * coordinate;
          weights.user[axis] += question.weight;
        }
        for (const tradition of data.traditions) {
          const range = references[tradition.id];
          const midpoint = (range[0] + range[1]) / 2;
          sums.tradition[tradition.id][axis] += question.weight * (direction > 0 ? midpoint : 1 - midpoint);
        }
        weights.tradition[axis] += question.weight;
      }
    }
    const point = (sum, weight) => ({
      x: (weight.x ? sum.x / weight.x : .5) * 2 - 1,
      y: (weight.y ? sum.y / weight.y : .5) * 2 - 1
    });
    return {
      user: point(sums.user, weights.user),
      traditions: data.traditions.map(tradition => ({
        tradition,
        ...point(sums.tradition[tradition.id], weights.tradition)
      }))
    };
  }

  function mapChart() {
    const model = mapCoordinateModel();
    const width = 720, height = 370;
    const left = 52, top = 26, plotWidth = 616, plotHeight = 300;
    const position = (x, y) => [
      left + ((x + 1) / 2) * plotWidth,
      top + (1 - (y + 1) / 2) * plotHeight
    ];
    const grid = [.25, .5, .75].map(value => {
      const x = left + value * plotWidth, y = top + (1 - value) * plotHeight;
      return `<line class="map-grid" x1="${x}" y1="${top}" x2="${x}" y2="${top + plotHeight}"></line>
        <line class="map-grid" x1="${left}" y1="${y}" x2="${left + plotWidth}" y2="${y}"></line>`;
    }).join('');
    const labels = model.traditions.map(({ tradition, x, y }, index) => {
      const [cx, cy] = position(x, y);
      const dx = index % 2 === 0 ? 9 : -9;
      const anchor = dx > 0 ? 'start' : 'end';
      const dy = index % 2 === 0 ? -8 : 14;
      return `<g class="map-tradition" style="--tradition:${tradition.color}">
        <circle cx="${cx}" cy="${cy}" r="5"></circle>
        <text x="${cx + dx}" y="${cy + dy}" text-anchor="${anchor}">${escapeHtml(tradition.name)}</text>
      </g>`;
    }).join('');
    const [userX, userY] = position(model.user.x, model.user.y);
    const originX = left + plotWidth / 2, originY = top + plotHeight / 2;
    return `<div class="faith-map-wrap">
      <svg class="faith-map-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="가운데 절대 0점을 기준으로 내 답과 11개 교파를 표시한 신앙 좌표 지도">
        <rect class="map-background" x="${left}" y="${top}" width="${plotWidth}" height="${plotHeight}"></rect>
        ${grid}
        <line class="map-axis" x1="${left}" y1="${originY}" x2="${left + plotWidth}" y2="${originY}"></line>
        <line class="map-axis" x1="${originX}" y1="${top}" x2="${originX}" y2="${top + plotHeight}"></line>
        <text class="map-zero" x="${originX + 8}" y="${originY - 8}">0</text>
        ${labels}
        <g class="map-user"><circle cx="${userX}" cy="${userY}" r="9"></circle><text x="${userX}" y="${userY + 4}">나</text></g>
      </svg>
      <div class="map-axis-guides">
        <p><b>세로축</b><span>위 · 말씀 · 교리 · 주권적 은총</span><span>아래 · 성령 체험 · 성화 · 사회적 실천</span></p>
        <p class="map-axis-labels"><b>가로축</b><span>왼쪽 · 자유로운 예배 · 개교회 중심</span><span>오른쪽 · 사도적 전통 · 성례전 예배 중심</span></p>
      </div>
      <p class="map-note">가운데 교점은 두 축의 절대 0점이며, 내 답과 각 교파를 같은 기준으로 표시합니다.</p>
    </div>`;
  }

  function traditionDetails() {
    const index = ((traditionSlideIndex % data.traditions.length) + data.traditions.length) % data.traditions.length;
    const tradition = data.traditions[index];
    return `<div class="tradition-slides" aria-label="교파별 설명">
      <div class="tradition-slide-nav">
        <button class="slide-button" data-action="tradition-slide" data-direction="-1" aria-label="이전 교파">‹</button>
        <span aria-live="polite">${index + 1} / ${data.traditions.length}</span>
        <button class="slide-button" data-action="tradition-slide" data-direction="1" aria-label="다음 교파">›</button>
      </div>
      <article class="tradition-slide" style="--tradition:${tradition.color}">
        <h2>${escapeHtml(tradition.name)}</h2>${keywordTags(tradition)}${descriptionHtml(tradition)}
      </article>
    </div>`;
  }

  function personCards(entries) {
    return entries.map((entry, index) => {
      const candidates = people.byTradition[entry.tradition.id] || [];
      const person = candidates[0];
      if (!person) return '';
      const others = candidates.slice(1).map(candidate =>
        `<li><b>${escapeHtml(candidate.name)}</b><span>${escapeHtml(candidate.focus)}</span></li>`
      ).join('');
      return `<article class="person-card" style="--tradition:${entry.tradition.color}">
        <span class="rank-badge">${index + 1}순위 교파 · 대표 인물</span>
        <h3>${escapeHtml(person.name)}</h3>
        <p class="person-role">${escapeHtml(person.role)}</p>
        <p>${escapeHtml(person.focus)}</p>
        <p class="person-work"><b>함께 읽을 책</b> ${escapeHtml(person.work)}</p>
        <details class="person-more"><summary>이 교파의 다른 인물</summary><ul>${others}</ul></details>
      </article>`;
    }).join('');
  }

  function resultsLoading() {
    view.innerHTML = `<section class="results-view"><div class="empty-result" role="status">
      <p>결과를 계산하고 있습니다.</p>
    </div></section>`;
  }

  function hydrateResult(payload) {
    const findTradition = id => {
      const tradition = data.traditions.find(item => item.id === id);
      if (!tradition) throw new Error('결과에 알 수 없는 교파가 포함되어 있습니다.');
      return tradition;
    };
    const hydrateScores = entries => {
      if (!Array.isArray(entries) || entries.length !== data.traditions.length) {
        throw new Error('결과의 교파 점수 형식이 올바르지 않습니다.');
      }
      return entries.map(entry => {
        if (!entry || !(entry.score === null || (Number.isFinite(entry.score)
          && entry.score >= 0 && entry.score <= 100))) {
          throw new Error('결과 점수가 올바르지 않습니다.');
        }
        return {
          tradition: findTradition(entry.traditionId),
          score: entry.score,
          ...(Object.hasOwn(entry, 'rank') ? { rank: entry.rank } : {})
        };
      });
    };
    if (!payload || !Number.isFinite(payload.totalWeight) || payload.totalWeight < 0
      || !Array.isArray(payload.scored) || !Array.isArray(payload.domains)
      || payload.domains.length !== data.sections.length) {
      throw new Error('결과 응답 형식이 올바르지 않습니다.');
    }
    const questionRanges = payload.totalWeight > 0 ? payload.questionRanges : {};
    if (payload.totalWeight > 0) {
      for (const question of data.questions) {
        if (!Number.isFinite(answers[question.id]?.value)) continue;
        const references = questionRanges?.[question.id];
        if (!references || typeof references !== 'object') {
          throw new Error('문항 비교 범위가 결과에 포함되지 않았습니다.');
        }
        for (const tradition of data.traditions) {
          const range = references[tradition.id];
          if (!Array.isArray(range) || range.length !== 2
            || !Number.isFinite(range[0]) || !Number.isFinite(range[1])
            || range[0] < 0 || range[1] > 1 || range[0] > range[1]) {
            throw new Error('문항 비교 범위 형식이 올바르지 않습니다.');
          }
        }
      }
    }
    const domains = payload.domains.map(domain => {
      const section = data.sections.find(item => item.id === domain.sectionId);
      if (!section || !Number.isFinite(domain.answeredWeight)
        || !Number.isFinite(domain.totalDomainWeight)) {
        throw new Error('영역별 결과 형식이 올바르지 않습니다.');
      }
      return { ...domain, section, traditions: hydrateScores(domain.traditions) };
    });
    return { totalWeight: payload.totalWeight, scored: hydrateScores(payload.scored), domains, questionRanges };
  }

  async function requestResults() {
    const requestId = ++resultRequestId;
    page = 'results';
    resultModel = null;
    resultsLoading();
    try {
      const calculation = FaithMapScoreV18.calculate(data, answers);
      const payload = {
        totalWeight: calculation.totalWeight,
        scored: calculation.scored.map(entry => ({
          traditionId: entry.tradition.id,
          score: entry.score,
          rank: entry.rank
        })),
        domains: calculation.domains.map(domain => ({
          sectionId: domain.section.id,
          answeredWeight: domain.answeredWeight,
          totalDomainWeight: domain.totalDomainWeight,
          traditions: domain.traditions.map(entry => ({
            traditionId: entry.tradition.id,
            score: entry.score
          }))
        })),
        questionRanges: calculation.totalWeight > 0
          ? Object.fromEntries(data.questions.map(question => [question.id, question.refs]))
          : null
      };
      const model = hydrateResult(payload);
      if (requestId !== resultRequestId || page !== 'results') return;
      resultModel = model;
      const firstPlaceIndex = data.traditions.findIndex(item => item.id === leaders()[0]?.tradition.id);
      if (firstPlaceIndex >= 0) traditionSlideIndex = firstPlaceIndex;
      renderResults();
    } catch (error) {
      if (requestId !== resultRequestId || page !== 'results') return;
      console.error('결과 계산에 실패했습니다.', error);
      view.innerHTML = `<section class="results-view"><div class="empty-result" role="alert">
        <p>결과를 계산하지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.</p>
        <button class="button button-primary" data-action="retry-results">다시 시도</button>
        <button class="button button-quiet" data-action="home">처음 화면</button>
      </div></section>`;
    }
  }

  function renderResults() {
    const top = leaders();
    const hasScore = resultModel.totalWeight > 0 && top.length > 0;
    const selected = hasScore ? selectedComparison() : null;
    const vectors = hasScore ? domainVectors(selected) : [];
    const headline = hasScore
      ? `${profile.nickname ? `${escapeHtml(profile.nickname)}님은` : '당신은'} '${escapeHtml(top[0].tradition.name)}'에 가장 가깝습니다!`
      : '선택한 응답만으로는 교파 순위를 만들 수 없습니다.';
    view.innerHTML = `<section class="results-view">
      <div class="results-hero">
        <button class="text-link" data-action="home">← 처음으로</button>
        <h1>${headline}</h1>
        ${hasScore ? `
          <div class="results-summary-grid">
            <article class="primary-tradition" style="--tradition:${top[0].tradition.color}">
              <div class="primary-copy">
                <span class="rank-badge">가장 가까운 교파</span>
                <h2>${escapeHtml(top[0].tradition.name)}</h2>
                <strong class="primary-score">${top[0].score.toFixed(1)}<small>점</small></strong>
                ${keywordTags(top[0].tradition)}${descriptionHtml(top[0].tradition)}
              </div>
            </article>
            <div class="podium-grid">${podiumCards(top)}</div>
          </div>
          ${traditionDetails()}` : '<div class="empty-result"><p>다른 응답을 선택하면 결과를 볼 수 있습니다.</p></div>'}
      </div>
      ${hasScore ? `<section class="result-block">
        <div class="block-heading"><span>01</span><div><h2>신앙 좌표 지도</h2><p>가운데 절대 0점을 기준으로 내 답과 11개 교파의 위치를 함께 표시합니다.</p></div></div>
        ${mapChart()}
        <div class="block-heading domain-heading-intro"><span>·</span><div><h2>5개 영역별 점수</h2><p>내 답변과 선택한 교파의 방향을 오각형으로 비교합니다. 왼쪽 문장 쪽은 0점, 오른쪽 문장 쪽은 100점입니다.</p></div></div>
        <div class="domain-comparison-control"><label>비교할 교파<select name="comparison-tradition">${data.traditions.map(tradition =>
          `<option value="${tradition.id}" ${tradition.id === selected.tradition.id ? 'selected' : ''}>${escapeHtml(tradition.name)}</option>`
        ).join('')}</select></label></div>
        ${radarChart(selected, vectors)}
        <div class="domain-grid">${domainCards(selected, vectors)}</div>
      </section>
      <section class="result-block">
        <div class="block-heading"><span>02</span><div><h2>교파별 점수 및 답변 비교</h2><p>점수 순위를 보고, 교파별로 내 답변과 닮거나 다른 문항을 살펴봅니다.</p></div></div>
        <div class="ranking-list">${rankingList()}</div>
        <div class="comparison-heading">
          <div><h3>내 답변 살펴보기</h3><p>위에서 선택한 ${escapeHtml(selected.tradition.name)}의 기준과 내 답변 위치를 문항별로 비교합니다.</p></div>
        </div>
        <div class="spectrum-legend">
          <span style="--tradition:${selected.tradition.color}">${escapeHtml(selected.tradition.name)}</span>
          <span class="your-label">내 답변 위치</span>
        </div>
        <div class="spectrum-list">${data.questions.map(question => questionSpectrum(question, selected)).join('')}</div>
      </section>
      <section class="result-block">
        <div class="block-heading"><span>03</span><div><h2>나와 맞닿은 성인·신학자</h2><p>상위 세 교파에서 함께 읽어볼 대표 인물을 골랐습니다.</p></div></div>
        <div class="person-grid">${personCards(top)}</div>
      </section>` : ''}
      <div class="result-actions">
        ${hasScore && !sharedView ? '<button class="button button-primary" data-action="share">결과 링크 공유하기</button><button class="button button-quiet" data-action="review-answers">답변 다시 살펴보기</button><button class="button button-quiet" data-action="restart">처음부터 다시하기</button>' : '<button class="button button-primary" data-action="retake">나도 테스트해보기</button>'}
      </div>
      ${hasScore ? '<p class="share-note">공유 링크에는 31개 응답이 포함됩니다. 링크를 받은 사람은 설문 없이 결과를 볼 수 있습니다.</p>' : ''}
      <p id="live-status" class="live-status" role="status"></p>
    </section>`;
  }

  function clearShareParam() {
    if (!window.history?.replaceState || !window.location?.href) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('r');
    window.history.replaceState(null, '', url);
  }

  async function copyText(value) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    if (!copied) throw new Error('이 브라우저에서 링크를 복사하지 못했습니다.');
  }

  async function shareResult() {
    try {
      const code = shareCodec.encodeAnswers(data.questions, answers);
      const url = new URL(window.location.href);
      url.search = '';
      url.hash = '';
      url.searchParams.set('r', code);
      const title = `당신은 '${leaders()[0].tradition.name}'에 가장 가깝습니다!`;
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title, text: '31개 응답을 바탕으로 한 결과', url: url.toString() });
          announce('결과 링크를 공유했습니다.');
          return;
        } catch (error) {
          if (error.name === 'AbortError') return;
        }
      }
      await copyText(url.toString());
      announce('결과 링크를 복사했습니다.');
    } catch (error) {
      console.error('결과 링크를 공유하지 못했습니다.', error);
      announce(error.message || '결과 링크를 공유하지 못했습니다.');
    }
  }

  function startQuiz() {
    const nicknameInput = view.querySelector('[name="nickname"]');
    const affiliationInput = view.querySelector('[name="affiliation"]');
    profile = {
      nickname: nicknameInput?.value.trim().slice(0, 30) || '',
      affiliation: affiliationInput?.value || ''
    };
    answers = Object.create(null);
    currentSection = 0;
    resultModel = null;
    sharedView = false;
    comparisonId = '';
    page = 'quiz';
    questionView();
  }

  function render() {
    if (page === 'intro') intro();
    else if (page === 'quiz') questionView();
    else if (page === 'invalid-share') {
      view.innerHTML = `<section class="results-view"><div class="empty-result" role="alert">
        <p>결과 링크를 확인할 수 없습니다.</p><button class="button button-primary" data-action="retake">테스트 시작</button>
      </div></section>`;
    } else if (resultModel) renderResults();
    else resultsLoading();
  }

  document.addEventListener('change', event => {
    const target = event.target;
    if (target.matches('input[type="radio"][data-question-id]')) {
      setAnswer(target.dataset.questionId, { value: Number(target.value) });
    } else if (target.matches('select[name="comparison-tradition"]')) {
      comparisonId = target.value;
      renderResults();
    }
  });

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'start') {
      clearShareParam();
      startQuiz();
    } else if (action === 'retake') {
      resultRequestId++;
      clearShareParam();
      profile = { nickname: '', affiliation: '' };
      answers = Object.create(null);
      currentSection = 0;
      resultModel = null;
      sharedView = false;
      comparisonId = '';
      page = 'intro';
      intro();
    } else if (action === 'restart') {
      resultRequestId++;
      clearShareParam();
      answers = Object.create(null);
      currentSection = 0;
      resultModel = null;
      sharedView = false;
      comparisonId = '';
      page = 'intro';
      intro();
    } else if (action === 'answer-nonvalue') {
      setAnswer(button.dataset.questionId, { value: null, reason: button.dataset.reason });
    } else if (action === 'section-page') {
      currentSection = Number(button.dataset.section);
      questionView();
      window.scrollTo?.(0, 0);
    } else if (action === 'next-section' && currentSection < data.sections.length - 1) {
      currentSection++;
      questionView();
      window.scrollTo?.(0, 0);
    } else if (action === 'previous-section' && currentSection > 0) {
      currentSection--;
      questionView();
      window.scrollTo?.(0, 0);
    } else if (action === 'finish') {
      if (answerCount() === data.questions.length) void requestResults();
    } else if (action === 'home') {
      resultRequestId++;
      page = 'intro';
      render();
    } else if (action === 'retry-results') {
      void requestResults();
    } else if (action === 'share' && resultModel) {
      void shareResult();
    } else if (action === 'review-answers') {
      currentSection = 0;
      page = 'quiz';
      questionView();
      window.scrollTo?.(0, 0);
    } else if (action === 'tradition-slide') {
      traditionSlideIndex += Number(button.dataset.direction);
      renderResults();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && page !== 'intro') {
      resultRequestId++;
      page = 'intro';
      render();
    }
  });

  const sharedCode = new URLSearchParams(window.location?.search || '').get('r');
  if (sharedCode) {
    try {
      answers = shareCodec.decodeAnswers(data.questions, sharedCode);
      sharedView = true;
      void requestResults();
    } catch (error) {
      console.error('공유 링크를 열지 못했습니다.', error);
      page = 'invalid-share';
      render();
    }
  } else {
    render();
  }
})();
