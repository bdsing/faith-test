(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FaithMapShareV18 = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const answerCount = 31;
  const codePrefix = '1';

  function toBase64Url(bytes) {
    const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function fromBase64Url(value) {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(base64), character => character.charCodeAt(0));
  }

  function encodeAnswers(questions, answers) {
    if (!Array.isArray(questions) || questions.length !== answerCount
      || !answers || typeof answers !== 'object') {
      throw new TypeError('공유할 응답 형식이 올바르지 않습니다.');
    }

    const bytes = new Uint8Array(Math.ceil(answerCount * 3 / 8));
    questions.forEach((question, index) => {
      const answer = answers[question.id];
      let state = 7;
      if (answer && answer.value === null) {
        if (answer.reason === 'unsure') state = 5;
        else if (answer.reason === 'neither') state = 6;
        else throw new TypeError('잘 모르겠음 또는 둘 다 아님 응답을 확인해 주세요.');
      } else if (answer && Number.isFinite(answer.value)
        && [0, .25, .5, .75, 1].includes(answer.value)) {
        state = Math.round(answer.value * 4);
      } else if (answer) {
        throw new TypeError('응답값을 확인해 주세요.');
      }
      for (let bit = 0; bit < 3; bit++) {
        const bitIndex = index * 3 + bit;
        const set = (state >> (2 - bit)) & 1;
        bytes[bitIndex >> 3] |= set << (7 - (bitIndex & 7));
      }
    });
    return codePrefix + toBase64Url(bytes);
  }

  function decodeAnswers(questions, code) {
    if (!Array.isArray(questions) || questions.length !== answerCount
      || typeof code !== 'string' || !/^1[A-Za-z0-9_-]{16}$/.test(code)) {
      throw new TypeError('공유 링크의 응답 코드가 올바르지 않습니다.');
    }
    const bytes = fromBase64Url(code.slice(1));
    if (bytes.length !== 12) throw new TypeError('공유 링크의 응답 코드 길이가 올바르지 않습니다.');

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

  return { encodeAnswers, decodeAnswers };
});
