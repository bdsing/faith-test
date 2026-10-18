(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FaithMapShareV18 = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  // Result links carry only denomination order and rounded scores, never answers.
  const resultPrefix = '2';
  const legacyAnswerCount = 31;
  const unscored = 36 * 36 - 1;

  function encodeResult(traditions, scored) {
    if (!Array.isArray(traditions) || !Array.isArray(scored) || scored.length !== traditions.length) {
      throw new TypeError('공유할 결과 형식이 올바르지 않습니다.');
    }
    const seen = new Set();
    const body = scored.map(entry => {
      const index = traditions.findIndex(tradition => tradition.id === entry.traditionId);
      if (index < 0 || index > 35 || seen.has(index)) throw new TypeError('공유할 교파 순위가 올바르지 않습니다.');
      seen.add(index);
      const value = entry.score === null ? unscored : Math.round(entry.score * 10);
      if (!Number.isInteger(value) || value < 0 || (value > 1000 && value !== unscored)) {
        throw new TypeError('공유할 점수가 올바르지 않습니다.');
      }
      return index.toString(36) + value.toString(36).padStart(2, '0');
    }).join('');
    return resultPrefix + body;
  }

  function decodeResult(traditions, code) {
    const count = Array.isArray(traditions) ? traditions.length : 0;
    if (!count || typeof code !== 'string' || !new RegExp(`^2[0-9a-z]{${count * 3}}$`).test(code)) {
      throw new TypeError('공유 링크의 결과 코드가 올바르지 않습니다.');
    }
    const seen = new Set();
    const entries = [];
    for (let offset = 1; offset < code.length; offset += 3) {
      const index = parseInt(code[offset], 36);
      const value = parseInt(code.slice(offset + 1, offset + 3), 36);
      if (index >= count || seen.has(index) || (value > 1000 && value !== unscored)) {
        throw new TypeError('공유 링크의 결과 코드가 올바르지 않습니다.');
      }
      seen.add(index);
      entries.push({ traditionId: traditions[index].id, score: value === unscored ? null : value / 10 });
    }
    return entries.map(entry => ({
      ...entry,
      rank: entry.score === null ? null
        : 1 + entries.filter(other => other.score !== null && other.score > entry.score).length
    }));
  }

  // Read-only support for links created before answers were removed from share URLs.
  function decodeLegacyAnswers(questions, code) {
    if (!Array.isArray(questions) || questions.length !== legacyAnswerCount
      || typeof code !== 'string' || !/^1[A-Za-z0-9_-]{16}$/.test(code)) {
      throw new TypeError('공유 링크의 결과 코드가 올바르지 않습니다.');
    }
    const base64 = code.slice(1).replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
    if (bytes.length !== 12) throw new TypeError('공유 링크의 결과 코드가 올바르지 않습니다.');
    const answers = Object.create(null);
    questions.forEach((question, index) => {
      let state = 0;
      for (let bit = 0; bit < 3; bit++) {
        const bitIndex = index * 3 + bit;
        state = (state << 1) | ((bytes[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1);
      }
      if (state <= 4) answers[question.id] = { value: state / 4 };
      else if (state === 5) answers[question.id] = { value: null, reason: 'unsure' };
      else if (state === 6) answers[question.id] = { value: null, reason: 'neither' };
    });
    return answers;
  }

  return { encodeResult, decodeResult, decodeLegacyAnswers };
});
