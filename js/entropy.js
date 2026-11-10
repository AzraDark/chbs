/**
 * CHBS · entropy.js
 * -----------------------------------------------------------------------
 * CHBS deliberately does NOT display "it would take N years to crack"
 * marketing claims. Instead it reports the Shannon entropy of the exact
 * randomness that was actually spent generating the password in front of
 * you, under the standard assumption (Kerckhoffs's principle) that an
 * attacker knows the full CHBS algorithm and your settings — the only
 * thing they don't know is the output of the CSPRNG.
 *
 * Entropy is computed as the sum of independent log2() contributions from
 * every random decision the generator made for THIS password: which
 * words, which capitalization was applied to each word, which digits
 * were chosen for each number block, which separator/symbol characters
 * were drawn, and (when applicable) which template/style was picked.
 * -----------------------------------------------------------------------
 */

const CHBSEntropy = (() => {
  'use strict';

  const SEPARATORS = ['-', '_', '.', '~', '='];
  const SYMBOLS = ['!', '@', '#', '$', '%', '&', '*', '?', '^', '+'];
  const NUMBER_DIGIT_CHOICES = [1, 2, 3]; // possible digit-lengths for a random number block

  const log2 = (n) => Math.log(n) / Math.LN2;

  /**
   * Breakdown accumulator. Every generator.js decision point calls one of
   * these `add*` methods so the final entropy always matches exactly what
   * was randomized — nothing is estimated after the fact.
   */
  function createTracker() {
    const items = [];
    let bits = 0;
    return {
      add(label, contributedBits, detail) {
        bits += contributedBits;
        items.push({ label, bits: contributedBits, detail });
      },
      total() { return bits; },
      items() { return items; }
    };
  }

  const RATINGS = [
    { max: 40, key: 'weak', label: 'Weak', color: '--rating-weak',
      suitableFor: ['Casual, low-value accounts', 'Not recommended for reuse'] },
    { max: 60, key: 'fair', label: 'Fair', color: '--rating-fair',
      suitableFor: ['Everyday online accounts', 'Forums, streaming, low-risk sites'] },
    { max: 80, key: 'strong', label: 'Strong', color: '--rating-strong',
      suitableFor: ['Email accounts', 'Social media', 'Most everyday logins'] },
    { max: 100, key: 'very-strong', label: 'Very Strong', color: '--rating-very-strong',
      suitableFor: ['Banking & financial accounts', 'Work / VPN credentials', 'Cloud storage'] },
    { max: Infinity, key: 'excellent', label: 'Excellent', color: '--rating-excellent',
      suitableFor: ['Password manager master password', 'Encryption keys & vaults', 'Long-term, high-value secrets'] }
  ];

  function rate(bits) {
    return RATINGS.find(r => bits < r.max) || RATINGS[RATINGS.length - 1];
  }

  /** Formats 2^bits as a readable "password space" string. */
  function formatSpace(bits) {
    return `2^${Math.round(bits * 10) / 10}`;
  }

  /** A rough, labeled magnitude so non-technical users have an anchor (not a "years to crack" claim). */
  function magnitudeLabel(bits) {
    const space = Math.pow(2, bits);
    if (space < 1e6) return `~${Math.round(space).toLocaleString()} combinations`;
    const exponent = Math.floor(bits * Math.LN2 / Math.LN10);
    return `on the order of 10^${exponent} combinations`;
  }

  return { SEPARATORS, SYMBOLS, NUMBER_DIGIT_CHOICES, log2, createTracker, rate, RATINGS, formatSpace, magnitudeLabel };
})();
