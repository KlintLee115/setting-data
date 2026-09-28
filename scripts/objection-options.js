const OBJECTION_OPTIONS = [
  ['objectionPartner', 'Partner'],
  ['objectionHadToGo', 'Had to go'],
  ['objectionNotInterested', 'Not interested'],
  ['objectionJustCurious', 'Just curious'],
  ['objectionSellMe', 'Are u trying to sell me']
];

if (typeof globalThis !== 'undefined') {
  globalThis.OBJECTION_OPTIONS = OBJECTION_OPTIONS;
}

if (typeof module !== 'undefined') {
  module.exports = { OBJECTION_OPTIONS };
}
