(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FaithMapScoreV18 = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const EPSILON = 1e-9;

  function distance(answer, reference) {
    const [low, high] = reference;
    return answer >= low && answer <= high
      ? .05 * (high - low)
      : Math.min(Math.abs(answer - low), Math.abs(answer - high));
  }

  function proximity(answer, reference) {
    return 1 - Math.pow(distance(answer, reference), 1.35);
  }

  function calculate(data, answers) {
    const answered = data.questions.filter(question => Number.isFinite(answers[question.id]?.value));
    const totalWeight = answered.reduce((total, question) => total + question.weight, 0);
    const questionScores = new Map(answered.map(question => {
      const answer = answers[question.id].value;
      const values = data.traditions.map(tradition => proximity(answer, question.refs[tradition.id]));
      const attainable = Math.max(...values);
      return [question.id, new Map(data.traditions.map((tradition, index) => [
        tradition.id, values[index] / attainable
      ]))];
    }));
    const scoreFor = (traditionId, questions, denominator) => denominator > 0
      ? 100 * questions.reduce((sum, question) => sum
        + question.weight * questionScores.get(question.id).get(traditionId), 0) / denominator
      : null;

    const scored = data.traditions.map(tradition => ({
      tradition,
      score: scoreFor(tradition.id, answered, totalWeight)
    }));
    scored.sort((a, b) => (b.score ?? -1) - (a.score ?? -1)
      || data.traditions.indexOf(a.tradition) - data.traditions.indexOf(b.tradition));
    for (const entry of scored) {
      entry.rank = entry.score === null ? null
        : 1 + scored.filter(other => other.score > entry.score + EPSILON).length;
    }

    const domains = data.sections.map(section => {
      const questions = answered.filter(question => question.domain === section.id);
      const answeredWeight = questions.reduce((sum, question) => sum + question.weight, 0);
      const totalDomainWeight = data.questions
        .filter(question => question.domain === section.id)
        .reduce((sum, question) => sum + question.weight, 0);
      const traditionsByScore = data.traditions.map(tradition => ({
        tradition,
        score: scoreFor(tradition.id, questions, answeredWeight)
      })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1)
        || data.traditions.indexOf(a.tradition) - data.traditions.indexOf(b.tradition));
      return { section, answeredWeight, totalDomainWeight, traditions: traditionsByScore };
    });

    return { scored, domains, answered, totalWeight, questionScores };
  }

  return { calculate, distance, proximity };
});
