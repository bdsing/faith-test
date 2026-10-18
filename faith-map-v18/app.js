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
  let completionTracked = false;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  function announce(message) {
    const status = view.querySelector('#live-status');
    if (status) status.textContent = message;
  }

  // Sends only a fixed event name; never answers, nickname, affiliation, or results.
  function trackEvent(name, title) {
    try {
      const counter = window.goatcounter;
      if (counter && typeof counter.count === 'function') counter.count({ path: name, title, event: true });
    } catch (error) {
      // Counting is optional and must not affect the test.
    }
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
      <p class="profile-note">닉네임과 현재 소속은 이 브라우저 안에서만 사용합니다. 소속 교파 선택은 점수에 영향을 주지 않습니다.</p>
      <p class="start-notice"><strong>배운 내용을 테스트하는 것이 아닙니다. 본인의 주관대로 테스트해 주세요.</strong></p>
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
    if (!comparisonId) comparisonId = top[0].tradition.id;
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

  function staticRankingList() {
    return resultModel.scored.map(entry => `<div class="rank-detail rank-static" style="--tradition:${entry.tradition.color}">
        <div class="rank-row">
          <span class="rank-index">${entry.rank ? `${entry.rank}위` : '—'}</span>
          <span class="rank-row-name">${escapeHtml(entry.tradition.name)}</span>
          <span class="rank-meter"><i style="width:${entry.score ?? 0}%"></i></span>
          <b>${entry.score === null ? '—' : `${entry.score.toFixed(1)}점`}</b>
          <span aria-hidden="true"></span>
        </div>
      </div>`).join('');
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

  const mapAxisInfo = {
    x: { title: 'X축 · 구원과 영성', low: '구원의 확신', high: '성화의 여정' },
    y: { title: 'Y축 · 예배의 태도', low: '말씀·회중 예배', high: '전례적 예배' },
    z: { title: 'Z축 · 공적·사회적 태도', low: '규범 준수·내부 안정', high: '사회적 실천·열린 연대' }
  };
  const mapModes = [['3d', '3D 입체뷰'], ['xy', 'X·Y 평면'], ['xz', 'X·Z 평면'], ['yz', 'Y·Z 평면']];
  const mapView = { mode: '3d', yaw: 26, pitch: 26 };
  let mapDrag = null;

  // 0~100 coordinates on each axis: weighted average of assigned answers (user) or reference-range midpoints (traditions).
  function mapCoordinateModel() {
    const axes = ['x', 'y', 'z'];
    const empty = () => ({ x: 0, y: 0, z: 0 });
    const sums = { user: empty(), tradition: Object.fromEntries(data.traditions.map(tradition => [tradition.id, empty()])) };
    const weights = { user: empty(), tradition: empty() };
    for (const question of data.questions) {
      const assigned = data.mapAxes[question.id];
      const references = resultModel.questionRanges?.[question.id];
      if (!assigned || !references) continue;
      const answer = answers[question.id]?.value;
      for (const axis of axes) {
        const direction = assigned[axis];
        if (!direction) continue;
        if (Number.isFinite(answer)) {
          sums.user[axis] += question.weight * (direction > 0 ? answer : 1 - answer);
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
    const point = (sum, weight) => Object.fromEntries(axes.map(axis => [axis, (weight[axis] ? sum[axis] / weight[axis] : .5) * 100]));
    return {
      user: point(sums.user, weights.user),
      traditions: data.traditions.map(tradition => ({ tradition, ...point(sums.tradition[tradition.id], weights.tradition) }))
    };
  }

  function mapPoints() {
    const model = mapCoordinateModel();
    return model.traditions.map(({ tradition, x, y, z }) => ({
      name: escapeHtml(tradition.name), color: tradition.color, x, y, z
    })).concat({ name: '★ 나', color: '#1f6b52', isMe: true, ...model.user });
  }

  // Larger SVG text on narrow screens, where the 760-wide chart is scaled down.
  function mapFontScale() {
    const width = (typeof window !== 'undefined' && window.innerWidth) || 1024;
    return width <= 520 ? 1.5 : width <= 760 ? 1.2 : 1;
  }

  function mapTextWidth(text, size, weight = 650) {
    if (mapTextWidth.context === undefined) {
      try {
        mapTextWidth.context = typeof document !== 'undefined' && document.createElement
          ? document.createElement('canvas').getContext('2d') : null;
      } catch (error) {
        mapTextWidth.context = null;
      }
    }
    const context = mapTextWidth.context;
    if (context) {
      context.font = `${weight} ${size}px "Malgun Gothic", sans-serif`;
      return context.measureText(text).width;
    }
    return [...text].reduce((sum, character) =>
      sum + size * (/[\u3131-\uD79D]/.test(character) ? .95 : character === ' ' ? .3 : .6), 0);
  }

  // Keep each end label on its own projected axis end, inside the axis when there is room.
  function mapAxisLabels(p0, p1, center, info, k = 1) {
    const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    let angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    if (angle > Math.PI / 2) angle -= Math.PI;
    if (angle < -Math.PI / 2) angle += Math.PI;
    const ux = Math.cos(angle), uy = Math.sin(angle);
    const u0 = (p0.x - mid.x) * ux + (p0.y - mid.y) * uy;
    const half = Math.abs(u0);
    const side = ((mid.x - center.x) * -uy + (mid.y - center.y) * ux) >= 0 ? 1 : -1;
    const ends = [{ u: u0, text: info.low }, { u: -u0, text: info.high }].map(end => {
      const left = end.u < 0;
      return { ...end, left, label: left ? '← ' + end.text : end.text + ' →' };
    });
    const widths = ends.map(end => mapTextWidth(end.label, 10.5 * k));
    const gap = 12;
    const room = half * 2 - widths[0] - widths[1] - gap;
    const inset = Math.max(0, Math.min(12, room / 2));
    const scale = room >= 0 ? 1 : Math.max(.8, (half * 2 - gap) / (widths[0] + widths[1]));
    const inside = (widths[0] + widths[1]) * scale + gap <= half * 2;
    const fontAttr = scale < 1 ? ' style="font-size:' + (10.5 * k * scale).toFixed(1) + 'px"' : '';
    const endY = ((side > 0 ? 15 : -8) * k).toFixed(1);
    const titleY = ((side > 0 ? 36 : -28) * k).toFixed(1);
    let out = '<g transform="translate(' + mid.x.toFixed(1) + ', ' + mid.y.toFixed(1) + ') rotate(' + (angle * 180 / Math.PI).toFixed(1) + ')">';
    out += '<text class="map-axis-title" x="0" y="' + titleY + '" text-anchor="middle">' + info.title + '</text>';
    if (half > 24) {
      for (const end of ends) {
        const x = inside ? end.u + (end.left ? inset : -inset) : end.u + (end.left ? -6 : 6);
        const anchor = inside ? (end.left ? 'start' : 'end') : (end.left ? 'end' : 'start');
        out += '<text class="map-axis-end" x="' + x.toFixed(1) + '" y="' + endY + '" text-anchor="' + anchor + '"' + fontAttr + '>' + end.label + '</text>';
      }
    }
    return out + '</g>';
  }

  // Greedy label placement: "나" first, then front to back; each label takes the first spot that hits no label or dot.
  function resolveMapLabelOverlaps(items, k = 1) {
    const placed = [];
    const dots = items.map(item => ({ item, x: item.sx, y: item.sy, r: item.isMe ? 10 : 7.5 }));
    const order = items.filter(item => item.isMe).concat(items.filter(item => !item.isMe).reverse());
    for (const item of order) {
      const size = (item.isMe ? 13.5 : 12) * k;
      const width = mapTextWidth(item.name, size, item.isMe ? 800 : 700);
      const above = (item.isMe ? -15 : -11) * k;
      const candidates = [
        [0, above, 'middle'], [0, 20 * k, 'middle'], [11 * k, 4 * k, 'start'], [-11 * k, 4 * k, 'end'],
        [0, above - 13 * k, 'middle'], [0, 33 * k, 'middle'], [14 * k, -9 * k, 'start'], [-14 * k, -9 * k, 'end'],
        [14 * k, 17 * k, 'start'], [-14 * k, 17 * k, 'end']
      ];
      let best = null;
      for (const [dx, dy, anchor] of candidates) {
        const x0 = item.sx + dx - (anchor === 'middle' ? width / 2 : anchor === 'end' ? width : 0);
        const box = { x0, x1: x0 + width, y0: item.sy + dy - size * .85, y1: item.sy + dy + size * .25 };
        let cost = 0;
        for (const other of placed) {
          cost += Math.max(0, Math.min(box.x1, other.x1) - Math.max(box.x0, other.x0) + 3) *
            Math.max(0, Math.min(box.y1, other.y1) - Math.max(box.y0, other.y0) + 2);
        }
        for (const dot of dots) {
          if (dot.item === item) continue;
          const nx = Math.min(Math.max(dot.x, box.x0), box.x1), ny = Math.min(Math.max(dot.y, box.y0), box.y1);
          if (Math.hypot(nx - dot.x, ny - dot.y) < dot.r) cost += 40;
        }
        if (!best || cost < best.cost) best = { cost, dx, dy, anchor, box };
        if (cost === 0) break;
      }
      Object.assign(item, { labelX: best.dx, labelY: best.dy, labelAnchor: best.anchor, labelBox: best.box });
      placed.push(best.box);
    }
  }

  function mapMarker(point, x, y, solid) {
    const label = `<text class="${point.isMe ? 'map-me-label' : 'map-label'}" x="${point.labelX.toFixed(1)}" y="${point.labelY.toFixed(1)}" text-anchor="${point.labelAnchor}">${point.name}</text>`;
    const shine = solid ? '' : `<circle cx="${point.isMe ? -2.5 : -2}" cy="${point.isMe ? -2.5 : -2}" r="${point.isMe ? 2.2 : 1.8}" fill="#ffffff" opacity="${point.isMe ? .65 : .55}"></circle>`;
    const body = point.isMe
      ? `<circle r="${solid ? 16 : 15}" fill="#1f6b52" opacity=".18"></circle><circle r="8" fill="#1f6b52" stroke="#ffffff" stroke-width="2.5"></circle>`
      : `<circle r="${solid ? 6.8 : 6.5}" fill="${point.color}" stroke="#ffffff" stroke-width="${solid ? 2 : 1.8}"></circle>`;
    return `<g class="map-point${point.isMe ? ' map-point-me' : ''}" transform="translate(${x.toFixed(1)}, ${y.toFixed(1)})">${body}${shine}${label}</g>`;
  }

  function mapPlaneSvg(points, mode, k) {
    const size = 400, left = 195, top = 55, right = left + size, bottom = top + size;
    const [hAxis, vAxis] = mode === 'xy' ? ['x', 'y'] : mode === 'xz' ? ['x', 'z'] : ['y', 'z'];
    const fill = { xy: '#f3f6f1', xz: '#fafbf9', yz: '#eff3ed' }[mode];
    const h = mapAxisInfo[hAxis], v = mapAxisInfo[vAxis];
    let out = `<rect x="${left}" y="${top}" width="${size}" height="${size}" rx="6" fill="${fill}" stroke="#bcc8bc" stroke-width="1.6"></rect>`;
    for (let t = 25; t <= 75; t += 25) {
      const stroke = t === 50 ? '#b8c6b8' : '#dfe6de', width = t === 50 ? 1.5 : 1;
      const gx = left + t / 100 * size, gy = bottom - t / 100 * size;
      out += `<line x1="${gx}" y1="${top}" x2="${gx}" y2="${bottom}" stroke="${stroke}" stroke-width="${width}"></line>`;
      out += `<line x1="${left}" y1="${gy}" x2="${right}" y2="${gy}" stroke="${stroke}" stroke-width="${width}"></line>`;
    }
    out += `<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="#4e6358" stroke-width="2.2"></line>`;
    out += `<line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" stroke="#4e6358" stroke-width="2.2"></line>`;
    out += `<text class="map-axis-title" x="${left + size / 2}" y="${bottom + 42 * k}" text-anchor="middle">${h.title}</text>`;
    out += `<text class="map-axis-end" x="${left}" y="${bottom + 22 * k}" text-anchor="start">← ${h.low}</text>`;
    out += `<text class="map-axis-end" x="${right}" y="${bottom + 22 * k}" text-anchor="end">${h.high} →</text>`;
    out += `<text class="map-axis-title" x="${left - 16}" y="${top - 18 * k}" text-anchor="start">${v.title}</text>`;
    out += `<text class="map-axis-end" x="${left - 12}" y="${top + 10}" text-anchor="end">↑ ${v.high}</text>`;
    out += `<text class="map-axis-end" x="${left - 12}" y="${bottom - 4}" text-anchor="end">↓ ${v.low}</text>`;
    const mapped = points.map(point => ({ ...point, sx: left + point[hAxis] / 100 * size, sy: bottom - point[vAxis] / 100 * size }));
    resolveMapLabelOverlaps(mapped, k);
    return out + mapped.map(point => mapMarker(point, point.sx, point.sy, true)).join('');
  }

  function mapProject(x, y, z) {
    const nx = (x - 50) / 50, ny = (y - 50) / 50, nz = (z - 50) / 50;
    const yaw = mapView.yaw * Math.PI / 180, pitch = mapView.pitch * Math.PI / 180;
    const rx = nx * Math.cos(yaw) + ny * Math.sin(yaw);
    const ry = -nx * Math.sin(yaw) + ny * Math.cos(yaw);
    return {
      x: 385 + rx * 152,
      y: 270 + (-ry * Math.sin(pitch) - nz * Math.cos(pitch)) * 152,
      depth: ry * Math.cos(pitch) - nz * Math.sin(pitch)
    };
  }

  function mapCubeSvg(points, k) {
    const path = corners => corners.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ') + ' Z';
    const line = (p, q, stroke, width) => `<line x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${q.x.toFixed(1)}" y2="${q.y.toFixed(1)}" stroke="${stroke}" stroke-width="${width}"></line>`;
    const P = mapProject;
    const yaw = mapView.yaw * Math.PI / 180;
    const backY = Math.cos(yaw) >= 0 ? 100 : 0;
    const sideX = Math.sin(yaw) >= 0 ? 0 : 100;
    let out = `<path d="${path([P(0, 0, 0), P(100, 0, 0), P(100, 100, 0), P(0, 100, 0)])}" fill="#f2f5f0" stroke="#bcc8bc" stroke-width="1.4"></path>`;
    out += `<path d="${path([P(0, backY, 0), P(100, backY, 0), P(100, backY, 100), P(0, backY, 100)])}" fill="#fafbf9" stroke="#bcc8bc" stroke-width="1.4"></path>`;
    out += `<path d="${path([P(sideX, 0, 0), P(sideX, 100, 0), P(sideX, 100, 100), P(sideX, 0, 100)])}" fill="#e9eee7" stroke="#bcc8bc" stroke-width="1.4"></path>`;
    for (let t = 25; t <= 75; t += 25) {
      const stroke = t === 50 ? '#c2cec2' : '#dfe6de', width = t === 50 ? 1.3 : .9;
      out += line(P(t, 0, 0), P(t, 100, 0), stroke, width) + line(P(t, backY, 0), P(t, backY, 100), stroke, width);
      out += line(P(0, t, 0), P(100, t, 0), stroke, width) + line(P(sideX, t, 0), P(sideX, t, 100), stroke, width);
      out += line(P(sideX, 0, t), P(sideX, 100, t), stroke, width) + line(P(0, backY, t), P(100, backY, t), stroke, width);
    }
    const frontY = 100 - backY, frontX = 100 - sideX;
    out += line(P(0, frontY, 0), P(100, frontY, 0), '#5b7065', 2);
    out += line(P(frontX, 0, 0), P(frontX, 100, 0), '#5b7065', 2);
    out += line(P(sideX, frontY, 0), P(sideX, frontY, 100), '#5b7065', 2);
    const center = P(50, 50, 50);
    out += mapAxisLabels(P(0, frontY, 0), P(100, frontY, 0), center, mapAxisInfo.x, k);
    out += mapAxisLabels(P(frontX, 0, 0), P(frontX, 100, 0), center, mapAxisInfo.y, k);
    const zTop = P(sideX, frontY, 105), zLow = P(sideX, frontY, 8), zHigh = P(sideX, frontY, 94);
    const zAnchor = sideX === 0 ? 'end' : 'start', zOffset = sideX === 0 ? -12 : 12;
    const projected = points.map(point => {
      const p3 = P(point.x, point.y, point.z);
      return { ...point, p3, floor: P(point.x, point.y, 0), sx: p3.x, sy: p3.y };
    }).sort((a, b) => b.p3.depth - a.p3.depth);
    resolveMapLabelOverlaps(projected, k);
    // Lift the Z title above any point label it would cover.
    const zTitleHalf = mapTextWidth(mapAxisInfo.z.title, 12 * k, 750) / 2;
    let zTitleY = zTop.y - 10;
    for (const { labelBox: box } of [...projected].sort((a, b) => b.labelBox.y0 - a.labelBox.y0)) {
      const overlapsX = box.x1 > zTop.x - zTitleHalf - 4 && box.x0 < zTop.x + zTitleHalf + 4;
      if (overlapsX && box.y0 < zTitleY + 3 * k && box.y1 > zTitleY - 12 * k) zTitleY = box.y0 - 4 * k;
    }
    out += `<text class="map-axis-title" x="${zTop.x.toFixed(1)}" y="${zTitleY.toFixed(1)}" text-anchor="middle">${mapAxisInfo.z.title}</text>`;
    out += `<text class="map-axis-end" x="${(zHigh.x + zOffset).toFixed(1)}" y="${zHigh.y.toFixed(1)}" text-anchor="${zAnchor}">↑ ${mapAxisInfo.z.high}</text>`;
    out += `<text class="map-axis-end" x="${(zLow.x + zOffset).toFixed(1)}" y="${zLow.y.toFixed(1)}" text-anchor="${zAnchor}">↓ ${mapAxisInfo.z.low}</text>`;
    for (const point of projected) {
      const color = point.isMe ? '#1f6b52' : point.color;
      out += `<ellipse cx="${point.floor.x.toFixed(1)}" cy="${point.floor.y.toFixed(1)}" rx="${point.isMe ? 6 : 4.2}" ry="${point.isMe ? 3 : 2.2}" fill="${color}" opacity=".32"></ellipse>`;
      out += `<line x1="${point.floor.x.toFixed(1)}" y1="${point.floor.y.toFixed(1)}" x2="${point.p3.x.toFixed(1)}" y2="${point.p3.y.toFixed(1)}" stroke="${color}" stroke-width="${point.isMe ? 1.8 : 1.2}" stroke-dasharray="${point.isMe ? 'none' : '3,3'}" opacity="${point.isMe ? .65 : .45}"></line>`;
    }
    return out + projected.map(point => mapMarker(point, point.p3.x, point.p3.y, false)).join('');
  }

  function mapSvgContent(points) {
    const k = mapFontScale();
    return mapView.mode === '3d' ? mapCubeSvg(points, k) : mapPlaneSvg(points, mapView.mode, k);
  }

  function mapChart() {
    const points = mapPoints();
    const me = points[points.length - 1];
    const summary = ['x', 'y', 'z'].map(axis => `${mapAxisInfo[axis].title.split(' · ')[1]} ${Math.round(me[axis])}`).join(', ');
    return `<div class="faith-map-wrap">
      <div class="map-view-buttons" role="group" aria-label="좌표 보기 방식">${mapModes.map(([mode, label]) =>
        `<button type="button" class="map-view-button${mapView.mode === mode ? ' is-active' : ''}" data-action="map-view" data-mode="${mode}" aria-pressed="${mapView.mode === mode}">${label}</button>`
      ).join('')}</div>
      <div class="faith-map-stage">
        <svg class="faith-map-chart" viewBox="0 0 760 540" style="--map-font:${mapFontScale()}" role="img" aria-label="나의 신앙 좌표(0~100): ${summary}. 11개 교파의 위치를 함께 표시합니다.">${mapSvgContent(points)}</svg>
      </div>
    </div>`;
  }

  function redrawMap() {
    const svg = view.querySelector('.faith-map-chart');
    if (!svg || !resultModel) return;
    svg.style.setProperty('--map-font', String(mapFontScale()));
    svg.innerHTML = mapSvgContent(mapPoints());
    view.querySelectorAll('.map-view-button').forEach(button => {
      const active = button.dataset.mode === mapView.mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function traditionDetails() {
    const index = ((traditionSlideIndex % data.traditions.length) + data.traditions.length) % data.traditions.length;
    const tradition = data.traditions[index];
    const buttons = data.traditions.map((item, itemIndex) =>
      `<button type="button" class="tradition-choice${itemIndex === index ? ' is-active' : ''}" style="--tradition:${item.color}" data-action="tradition-select" data-index="${itemIndex}" aria-pressed="${itemIndex === index}">${escapeHtml(item.name)}</button>`
    ).join('');
    return `<section class="tradition-explanations" aria-labelledby="tradition-explanations-title">
      <div class="tradition-slide-heading"><h2 id="tradition-explanations-title">교파별 설명</h2></div>
      <div class="tradition-panel">
      <div class="tradition-choices" role="group" aria-label="교파 선택">${buttons}</div>
      <article class="tradition-detail" style="--tradition:${tradition.color}" aria-live="polite">
        <h2>${escapeHtml(tradition.name)}</h2>${keywordTags(tradition)}${descriptionHtml(tradition)}
      </article>
      </div>
    </section>`;
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

  function sharedResultModel(entries) {
    const scored = entries.map(entry => ({
      tradition: data.traditions.find(item => item.id === entry.traditionId),
      score: entry.score,
      rank: entry.rank
    }));
    if (scored.some(entry => !entry.tradition) || !scored.some(entry => entry.score !== null)) {
      throw new Error('공유 결과 형식이 올바르지 않습니다.');
    }
    return { totalWeight: 1, scored, domains: [], questionRanges: {} };
  }

  function showSharedResult(code) {
    answers = Object.create(null);
    sharedView = true;
    page = 'results';
    resultModel = sharedResultModel(shareCodec.decodeResult(data.traditions, code));
    renderResults();
  }

  function replaceShareParam(code) {
    if (!window.history?.replaceState || !window.location?.href) return;
    const url = new URL(window.location.href);
    url.searchParams.set('r', code);
    window.history.replaceState(null, '', url);
  }

  async function requestResults() {
    const requestId = ++resultRequestId;
    page = 'results';
    resultModel = null;
    comparisonId = '';
    resultsLoading();
    window.scrollTo?.(0, 0);
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
      if (!completionTracked) {
        completionTracked = true;
        trackEvent('test-complete', '테스트 완료');
      }
      const firstPlaceIndex = data.traditions.findIndex(item => item.id === leaders()[0]?.tradition.id);
      if (firstPlaceIndex >= 0) traditionSlideIndex = firstPlaceIndex;
      renderResults();
      window.scrollTo?.(0, 0);
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
    const selected = hasScore && !sharedView ? selectedComparison() : null;
    const vectors = hasScore && !sharedView ? domainVectors(selected) : [];
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
          ${sharedView ? '' : traditionDetails()}` : '<div class="empty-result"><p>다른 응답을 선택하면 결과를 볼 수 있습니다.</p></div>'}
      </div>
      ${hasScore && sharedView ? `<section class="result-block shared-ranking">
        <div class="block-heading"><div><h2>교파별 점수</h2></div></div>
        <div class="ranking-list">${staticRankingList()}</div>
      </section>` : ''}
      ${hasScore && !sharedView ? `<section class="result-block">
        <div class="block-heading"><div><h2>나의 신앙 좌표</h2><p>드래그 하여 움직일 수 있습니다.</p></div></div>
        ${mapChart()}
        <div class="block-heading domain-heading-intro"><div><h2>5개 영역별 점수</h2><p>내 답변과 선택한 교파를 영역별로 비교합니다.</p></div></div>
        <div class="domain-comparison-control"><label>비교할 교파<select name="comparison-tradition">${data.traditions.map(tradition =>
          `<option value="${tradition.id}" ${tradition.id === selected.tradition.id ? 'selected' : ''}>${escapeHtml(tradition.name)}</option>`
        ).join('')}</select></label></div>
        ${radarChart(selected, vectors)}
        <div class="domain-grid">${domainCards(selected, vectors)}</div>
      </section>
      <section class="result-block">
        <div class="block-heading"><div><h2>교파별 점수 및 답변 비교</h2><p>점수 순위를 보고, 교파별로 내 답변과 닮거나 다른 문항을 살펴봅니다.</p></div></div>
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
        <div class="block-heading"><div><h2>나와 맞닿은 성인·신학자</h2><p>당신과 닮아있는 대표 인물을 소개합니다.</p></div></div>
        <div class="person-grid">${personCards(top)}</div>
      </section>` : ''}
      <div class="result-actions">
        ${hasScore && !sharedView ? '<button class="button button-primary" data-action="share">결과 링크 공유하기</button><button class="button button-quiet" data-action="review-answers">답변 다시 살펴보기</button><button class="button button-quiet" data-action="restart">처음부터 다시하기</button>' : '<button class="button button-primary" data-action="retake">나도 테스트해보기</button>'}
      </div>
      ${hasScore && !sharedView ? '<p class="share-note">공유 링크에는 교파 순위와 점수만 담기며, 내 응답은 포함되지 않습니다.</p>' : ''}
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
      const code = shareCodec.encodeResult(data.traditions, resultModel.scored.map(entry => ({
        traditionId: entry.tradition.id,
        score: entry.score
      })));
      const url = new URL(window.location.href);
      url.search = '';
      url.hash = '';
      url.searchParams.set('r', code);
      const title = `당신은 '${leaders()[0].tradition.name}'에 가장 가깝습니다!`;
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title, text: '교파별 점수 결과', url: url.toString() });
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
    completionTracked = false;
    page = 'quiz';
    trackEvent('test-start', '테스트 시작');
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
    } else if (action === 'map-view') {
      mapView.mode = button.dataset.mode;
      if (mapView.mode === '3d') { mapView.yaw = 26; mapView.pitch = 26; }
      redrawMap();
    } else if (action === 'tradition-select') {
      traditionSlideIndex = Number(button.dataset.index);
      const section = button.closest('.tradition-explanations');
      if (section) {
        section.outerHTML = traditionDetails();
        document.querySelector(`.tradition-choice[data-index="${traditionSlideIndex}"]`)?.focus();
      } else {
        renderResults();
      }
    }
  });

  document.addEventListener('pointerdown', event => {
    const stage = event.target.closest?.('.faith-map-stage');
    if (!stage || event.button > 0) return;
    mapDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  });

  document.addEventListener('pointermove', event => {
    if (!mapDrag || event.pointerId !== mapDrag.id) return;
    const dx = event.clientX - mapDrag.x, dy = event.clientY - mapDrag.y;
    if (!mapDrag.moved && Math.hypot(dx, dy) < 4) return;
    mapDrag.moved = true;
    mapDrag.x = event.clientX;
    mapDrag.y = event.clientY;
    mapView.mode = '3d';
    mapView.yaw = (mapView.yaw - dx * .55) % 360;
    mapView.pitch = Math.max(-15, Math.min(85, mapView.pitch + dy * .45));
    redrawMap();
  });

  for (const type of ['pointerup', 'pointercancel']) {
    document.addEventListener(type, () => { mapDrag = null; });
  }

  let mapFontOnScreen = mapFontScale();
  window.addEventListener?.('resize', () => {
    if (mapFontScale() === mapFontOnScreen) return;
    mapFontOnScreen = mapFontScale();
    redrawMap();
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
      let resultCode = sharedCode;
      if (sharedCode.startsWith('1')) {
        const legacy = FaithMapScoreV18.calculate(data, shareCodec.decodeLegacyAnswers(data.questions, sharedCode));
        resultCode = shareCodec.encodeResult(data.traditions, legacy.scored.map(entry => ({
          traditionId: entry.tradition.id,
          score: entry.score
        })));
        replaceShareParam(resultCode);
      }
      showSharedResult(resultCode);
    } catch (error) {
      console.error('공유 링크를 열지 못했습니다.', error);
      page = 'invalid-share';
      render();
    }
  } else {
    render();
  }
})();
