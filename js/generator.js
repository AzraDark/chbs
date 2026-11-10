/**
 * CHBS · generator.js
 * -----------------------------------------------------------------------
 * The generation engine. Every random decision made while building a
 * password is logged to an entropy tracker at the moment it's made, so
 * the entropy figure shown to the user is never an estimate — it's a
 * receipt of exactly what the CSPRNG was asked to decide for that
 * specific password.
 *
 * IMPORTANT PRINCIPLE: a setting only contributes entropy when CHBS
 * itself randomized it *for this generation*. If the user pins an exact
 * value (e.g. "always use the dash-chain template"), an attacker who
 * knows your settings also knows that value — so it contributes 0 bits.
 * Only genuinely-randomized decisions (word content, character choices,
 * and anything rolled by "Randomize Everything" / "Random ..." modes)
 * count toward the total.
 * -----------------------------------------------------------------------
 */

const CHBSGenerator = (() => {
  'use strict';

  const R = CHBSRandom;
  const E = CHBSEntropy;
  const CAP_STYLES = ['none', 'first-upper', 'all-caps', 'random'];
  const NUMBER_MODES = ['random', 'sequential', 'none'];
  const MIN_WORDS = 3;
  const MAX_WORDS = 7;
  const MAX_ATTEMPTS = 60;

  function filterDictionary(list, minLen, maxLen) {
    return list.filter(w => w.length >= minLen && w.length <= maxLen);
  }

  /** Exact entropy (bits) of drawing `count` distinct items, in order, from a pool of size `n`. */
  function permutationBits(n, count) {
    let bits = 0;
    for (let i = 0; i < count; i++) bits += E.log2(n - i);
    return bits;
  }

  function applyCapitalization(word, style) {
    switch (style) {
      case 'first-upper': return word.charAt(0).toUpperCase() + word.slice(1);
      case 'all-caps': return word.toUpperCase();
      case 'none': return word;
      default: return word;
    }
  }

  const RANDOM_WORD_CASE_OPTIONS = ['lower', 'title', 'upper'];
  function applyRandomWordCase(word) {
    const choice = R.pick(RANDOM_WORD_CASE_OPTIONS);
    if (choice === 'upper') return word.toUpperCase();
    if (choice === 'title') return word.charAt(0).toUpperCase() + word.slice(1);
    return word;
  }

  /**
   * Resolves the effective settings for one generation, rolling any
   * settings that are set to a "random" / "Randomize Everything" mode.
   * Returns { resolved, rolled } where `rolled` flags which fields were
   * just randomly decided (and therefore earn entropy credit).
   */
  function resolveSettings(settings, tracker) {
    const resolved = Object.assign({}, settings);
    const rolled = {};

    if (settings.randomizeEverything) {
      resolved.wordCount = R.randomIntRange(MIN_WORDS, MAX_WORDS);
      rolled.wordCount = true;

      resolved.templateId = 'random';
      rolled.template = true;

      resolved.capitalization = R.pick(CAP_STYLES);
      rolled.capitalization = true;

      resolved.numbersMode = R.pick(NUMBER_MODES);
      rolled.numbersMode = true;

      resolved.separatorsEnabled = R.randomBool();
      rolled.separators = true;

      resolved.symbolsEnabled = R.randomBool();
      rolled.symbols = true;

      resolved.shuffleWordOrder = R.randomBool();
    } else {
      if (settings.randomWordCount) {
        resolved.wordCount = R.randomIntRange(MIN_WORDS, MAX_WORDS);
        rolled.wordCount = true;
      }
      if (settings.templateId === 'random') rolled.template = true;
      if (settings.capitalization === 'random-style') rolled.capitalization = true;
      // numbersMode / separatorsEnabled / symbolsEnabled / template(if pinned) are
      // user-fixed choices here — no entropy credit for the choice itself.
    }

    return { resolved, rolled };
  }

  function renderNumberBlock(mode, sequentialState, tracker) {
    if (mode === 'sequential') {
      if (!sequentialState.started) {
        sequentialState.value = R.randomIntRange(0, 99);
        sequentialState.started = true;
        tracker.add('Sequential number start value', E.log2(100), 'One random start value (0–99); every later number in this password is fully predictable from it.');
      } else {
        sequentialState.value += 1;
      }
      return String(sequentialState.value);
    }
    // random mode
    const digits = R.pick(E.NUMBER_DIGIT_CHOICES);
    const value = R.randomDigits(digits);
    const bits = E.log2(E.NUMBER_DIGIT_CHOICES.length) + digits * E.log2(10);
    tracker.add('Random number block', bits, `${digits}-digit block ("${value}")`);
    return value;
  }

  /**
   * Runs one full generation attempt. Returns { password, trace, tracker }
   * where `trace` is an ordered list of { type, value } describing exactly
   * what was placed at each template slot (used to render the structure
   * preview and to recompute lengths).
   */
  function attemptGeneration(settings, dictionary) {
    const tracker = E.createTracker();
    const { resolved, rolled } = resolveSettings(settings, tracker);

    if (rolled.wordCount) {
      tracker.add('Word count choice', E.log2(MAX_WORDS - MIN_WORDS + 1), `${resolved.wordCount} words chosen from a 3–7 range`);
    }

    // --- Template selection -------------------------------------------------
    let template;
    if (resolved.templateId === 'random' || !resolved.templateId) {
      template = R.pick(CHBS_TEMPLATES.all);
      if (rolled.template) {
        tracker.add('Template / structure choice', E.log2(CHBS_TEMPLATES.all.length), template.name);
      }
    } else {
      template = CHBS_TEMPLATES.byId(resolved.templateId) || R.pick(CHBS_TEMPLATES.all);
    }

    const wordCount = resolved.wordCount || 5;
    let tokens = template.build(wordCount);

    // Strip disabled token types entirely so the template gracefully
    // degrades (e.g. numbers off -> a dash-chain still renders cleanly).
    tokens = tokens.filter(t => {
      if (t === 'N') return resolved.numbersMode !== 'none';
      if (t === 'S') return resolved.separatorsEnabled;
      if (t === 'Y') return resolved.symbolsEnabled;
      return true;
    });

    // --- Word selection -------------------------------------------------------
    let dict = dictionary;
    let words;
    if (settings.customWordlist && settings.customWordlist.length >= wordCount) {
      dict = settings.customWordlist;
      words = R.pickDistinct(dict, wordCount);
    } else {
      words = R.pickDistinct(dict, wordCount);
    }
    tracker.add('Word selection', permutationBits(dict.length, wordCount),
      `${wordCount} distinct words drawn from a ${dict.length}-word dictionary`);

    if (resolved.shuffleWordOrder) {
      R.shuffle(words); // Presentation only — positions were already independently random, so no additional entropy is claimed here.
    }

    // --- Capitalization ---------------------------------------------------
    let capStyle = resolved.capitalization || 'first-upper';
    if (capStyle === 'random-style') {
      capStyle = R.pick(CAP_STYLES);
      tracker.add('Capitalization style choice', E.log2(CAP_STYLES.length), `Style rolled: "${capStyle}"`);
    }
    if (capStyle === 'random') {
      words = words.map(applyRandomWordCase);
      tracker.add('Per-word random capitalization', wordCount * E.log2(RANDOM_WORD_CASE_OPTIONS.length),
        `${wordCount} words, each independently lower/Title/UPPER`);
    } else {
      words = words.map(w => applyCapitalization(w, capStyle));
    }

    // --- Render token stream ------------------------------------------------
    const trace = [];
    let wIdx = 0;
    const sequentialState = { started: false, value: 0 };

    for (const tok of tokens) {
      if (tok === 'W') {
        trace.push({ type: 'W', value: words[wIdx++] });
      } else if (tok === 'N') {
        trace.push({ type: 'N', value: renderNumberBlock(resolved.numbersMode, sequentialState, tracker) });
      } else if (tok === 'S') {
        const sep = R.pick(E.SEPARATORS);
        tracker.add('Separator character', E.log2(E.SEPARATORS.length), `"${sep}"`);
        trace.push({ type: 'S', value: sep });
      } else if (tok === 'Y') {
        const sym = R.pick(E.SYMBOLS);
        tracker.add('Symbol character', E.log2(E.SYMBOLS.length), `"${sym}"`);
        trace.push({ type: 'Y', value: sym });
      }
    }

    const password = trace.map(t => t.value).join('');

    return { password, trace, tracker, template, resolved, wordCount };
  }

  /**
   * Public entry point. Attempts generation, backing off word count if the
   * result exceeds maxLength, and returns a complete result object.
   */
  function generate(settings) {
    const minLen = settings.wordLengthMin || 4;
    const maxLen = settings.wordLengthMax || 8;
    const dictionary = filterDictionary(CHBS_WORDLIST, minLen, maxLen);
    const maxLength = settings.maxLength || 64;

    let best = null;
    let attempts = 0;
    let workingSettings = Object.assign({}, settings);

    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      const result = attemptGeneration(workingSettings, dictionary);
      if (!best || result.password.length < best.password.length) best = result;

      if (result.password.length <= maxLength) {
        best = result;
        break;
      }

      // Too long: back off word count for the next attempt (never below MIN_WORDS).
      const currentWords = result.wordCount;
      if (currentWords > MIN_WORDS) {
        workingSettings = Object.assign({}, settings, {
          randomizeEverything: false,
          randomWordCount: false,
          wordCount: currentWords - 1,
          templateId: settings.randomizeEverything ? 'random' : settings.templateId,
          capitalization: settings.randomizeEverything ? 'random-style' : settings.capitalization,
          numbersMode: settings.randomizeEverything ? R.pick(NUMBER_MODES) : settings.numbersMode,
          separatorsEnabled: settings.randomizeEverything ? settings.separatorsEnabled : settings.separatorsEnabled,
          symbolsEnabled: settings.randomizeEverything ? settings.symbolsEnabled : settings.symbolsEnabled
        });
      }
    }

    const truncated = best.password.length > maxLength;
    let finalPassword = best.password;
    let entropyBits = best.tracker.total();
    if (truncated) {
      finalPassword = best.password.slice(0, maxLength);
      // Honesty adjustment: the tracked entropy belongs to the FULL
      // pre-truncation string. Scale it down proportionally rather than
      // reporting bits that were literally cut off the end — CHBS never
      // claims randomness it didn't keep.
      entropyBits = entropyBits * (finalPassword.length / best.password.length);
    }

    const rating = E.rate(entropyBits);

    return {
      password: finalPassword,
      length: finalPassword.length,
      trace: best.trace,
      template: best.template,
      entropyBits,
      entropyItems: best.tracker.items(),
      rating,
      truncated,
      attempts,
      settingsUsed: best.resolved
    };
  }

  return { generate, MIN_WORDS, MAX_WORDS, CAP_STYLES, NUMBER_MODES };
})();
