/**
 * CHBS · random.js
 * -----------------------------------------------------------------------
 * All randomness in CHBS is sourced from window.crypto.getRandomValues().
 * No Math.random() is used anywhere in the generation engine.
 *
 * randomInt(max) uses rejection sampling to avoid modulo bias, so every
 * integer in [0, max) is equally likely regardless of max's relationship
 * to 256/65536.
 * -----------------------------------------------------------------------
 */

const CHBSRandom = (() => {
  'use strict';

  if (!window.crypto || !window.crypto.getRandomValues) {
    throw new Error('CHBS requires a browser with the Web Crypto API (crypto.getRandomValues).');
  }

  /** Cryptographically secure random integer in [0, maxExclusive). Unbiased via rejection sampling. */
  function randomInt(maxExclusive) {
    if (maxExclusive <= 0) throw new RangeError('maxExclusive must be > 0');
    if (maxExclusive === 1) return 0;

    // Choose the smallest byte width that comfortably covers the range.
    let bytesNeeded = 1;
    while (256 ** bytesNeeded < maxExclusive) bytesNeeded++;
    const range = 256 ** bytesNeeded;
    // Largest multiple of maxExclusive that fits in range, for rejection sampling.
    const limit = range - (range % maxExclusive);

    const buf = new Uint8Array(bytesNeeded);
    let value;
    do {
      window.crypto.getRandomValues(buf);
      value = 0;
      for (let i = 0; i < bytesNeeded; i++) {
        value = value * 256 + buf[i];
      }
    } while (value >= limit);

    return value % maxExclusive;
  }

  /** Cryptographically secure random integer in [min, max] inclusive. */
  function randomIntRange(min, max) {
    if (max < min) throw new RangeError('max must be >= min');
    return min + randomInt(max - min + 1);
  }

  /** Returns true/false with the given probability (0..1) of true, CSPRNG-backed. */
  function randomBool(probabilityTrue = 0.5) {
    // Use a 32-bit precision draw for the probability comparison.
    const buf = new Uint32Array(1);
    window.crypto.getRandomValues(buf);
    return buf[0] / 0xFFFFFFFF < probabilityTrue;
  }

  /** Picks one random element from an array. */
  function pick(arr) {
    if (!arr || arr.length === 0) throw new RangeError('pick() requires a non-empty array');
    return arr[randomInt(arr.length)];
  }

  /** Picks `count` distinct random elements from an array (no repeats), order randomized. */
  function pickDistinct(arr, count) {
    if (count > arr.length) throw new RangeError('Cannot pick more distinct items than available');
    const pool = arr.slice();
    const result = [];
    for (let i = 0; i < count; i++) {
      const idx = randomInt(pool.length);
      result.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return result;
  }

  /** Picks `count` random elements from an array, WITH repeats allowed. */
  function pickWithReplacement(arr, count) {
    const result = [];
    for (let i = 0; i < count; i++) result.push(pick(arr));
    return result;
  }

  /** In-place Fisher–Yates shuffle using the CSPRNG. Returns the same array. */
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Generates a random decimal number string with the given digit count (no leading-zero bias handling needed — leading zeros are valid digits). */
  function randomDigits(digitCount) {
    let s = '';
    for (let i = 0; i < digitCount; i++) s += String(randomInt(10));
    return s;
  }

  return { randomInt, randomIntRange, randomBool, pick, pickDistinct, pickWithReplacement, shuffle, randomDigits };
})();
