/**
 * CHBS · templates.js
 * -----------------------------------------------------------------------
 * CHBS does not just randomize which words are used — it randomizes the
 * SHAPE of the password. A template describes how word tokens (W) are
 * interleaved with number tokens (N), separator tokens (S) and symbol
 * tokens (Y).
 *
 * Adding a new template requires nothing more than pushing a new entry
 * onto CHBS_TEMPLATES below. The renderer (generator.js) only ever deals
 * in the abstract token stream, never in template-specific logic.
 *
 * Token vocabulary:
 *   'W'  a dictionary word
 *   'N'  a number block
 *   'S'  a separator character
 *   'Y'  a symbol character
 * -----------------------------------------------------------------------
 */

const CHBS_TEMPLATES = (() => {
  'use strict';

  /**
   * Builds a token array for a template given the number of words requested.
   * Templates describe themselves declaratively; buildTokens() below turns
   * a declaration into a concrete token stream for a specific word count.
   */
  function buildTokens(def, wordCount) {
    let tokens = [];

    if (def.prefix) tokens.push(...def.prefix);

    if (def.groupSize) {
      // Words are chunked into groups of `groupSize`, each group followed
      // by `groupSuffix` tokens (e.g. two words concatenated, then a number).
      let placed = 0;
      while (placed < wordCount) {
        const take = Math.min(def.groupSize, wordCount - placed);
        for (let i = 0; i < take; i++) tokens.push('W');
        placed += take;
        if (def.groupSuffix && placed < wordCount) tokens.push(...def.groupSuffix);
        else if (def.groupSuffix && def.trailingGroupSuffix) tokens.push(...def.groupSuffix);
      }
    } else if (def.unitCycle) {
      // Alternates between different connector styles between each word.
      for (let i = 0; i < wordCount; i++) {
        tokens.push('W');
        if (i < wordCount - 1) {
          const cycle = def.unitCycle[i % def.unitCycle.length];
          tokens.push(...cycle);
        }
      }
    } else if (def.unit) {
      // Repeats a fixed unit (which contains exactly one 'W') per word.
      for (let i = 0; i < wordCount; i++) tokens.push(...def.unit);
      if (def.trimTrailingConnector) {
        // Strip any trailing non-word tokens so chains don't dangle
        // ("Word-Word-Word-" -> "Word-Word-Word").
        while (tokens.length && tokens[tokens.length - 1] !== 'W') tokens.pop();
      }
    }

    if (def.suffix) tokens.push(...def.suffix);

    return tokens;
  }

  const definitions = [
    {
      id: 'number-prefixed-chain',
      name: 'Number-Prefixed Chain',
      description: 'A number precedes every word, plus one trailing number.',
      unit: ['N', 'W'],
      suffix: ['N'],
      example: '1Anginous2Shudder3Irritate4Oaks5'
    },
    {
      id: 'number-suffixed-words',
      name: 'Number-Suffixed Words',
      description: 'Every word is immediately followed by a number block.',
      unit: ['W', 'N'],
      example: 'Word12Word98Word34Word56'
    },
    {
      id: 'dash-chain',
      name: 'Dash-Separated Chain',
      description: 'Classic diceware-style chain joined by separators.',
      unit: ['W', 'S'],
      trimTrailingConnector: true,
      example: 'Word-Word-Word-Word'
    },
    {
      id: 'symbol-chain',
      name: 'Symbol-Punctuated Chain',
      description: 'Words joined by punctuation symbols instead of plain separators.',
      unit: ['W', 'Y'],
      trimTrailingConnector: true,
      example: 'Word#Word$Word@Word'
    },
    {
      id: 'separator-number-mix',
      name: 'Separator + Number Mix',
      description: 'Alternates a separator and a number block between words.',
      unit: ['W', 'S', 'N'],
      trimTrailingConnector: true,
      example: 'Chap-72-Irritate-941-Oaks'
    },
    {
      id: 'concatenated-plain',
      name: 'Concatenated Words',
      description: 'Words are fused together with no connective tissue at all — length carries the entropy.',
      unit: ['W'],
      example: 'WordWordWordWord'
    },
    {
      id: 'chunked-pairs-number',
      name: 'Chunked Pairs + Number',
      description: 'Words are fused in pairs, with a number block breaking up each pair.',
      groupSize: 2,
      groupSuffix: ['N'],
      trailingGroupSuffix: true,
      example: 'WordWord241WordWord35'
    },
    {
      id: 'number-sandwich',
      name: 'Number Sandwich',
      description: 'A single number block bookends a concatenated run of words.',
      prefix: ['N'],
      unit: ['W'],
      suffix: ['N'],
      example: '47WordWordWord92'
    },
    {
      id: 'prefixed-descending',
      name: 'Prefix-Interleaved Chain',
      description: 'Numbers and words interleave from the very start of the string.',
      unitCycle: [['N']],
      // built manually below via unit, kept here for clarity of intent
      unit: ['N', 'W'],
      example: '2Word4Word1Word3Word5'
    },
    {
      id: 'symbol-wrapped',
      name: 'Symbol-Wrapped Block',
      description: 'A concatenated word block, bracketed by symbols on both ends.',
      prefix: ['Y'],
      unit: ['W'],
      suffix: ['Y'],
      example: '#WordWordWordWord@'
    },
    {
      id: 'alternating-connector',
      name: 'Alternating Separator/Symbol',
      description: 'Connectors alternate between a separator and a symbol between each word.',
      unitCycle: [['S'], ['Y']],
      example: 'Word-Word#Word_Word$Word'
    },
    {
      id: 'all-caps-number-block',
      name: 'Caps + Trailing Number Block',
      description: 'A run of words followed by a single larger number block.',
      unit: ['W'],
      suffix: ['N'],
      example: 'WordWordWordWord241'
    }
  ];

  // Pre-attach a token builder to each definition.
  definitions.forEach(def => {
    def.build = (wordCount) => buildTokens(def, wordCount);
  });

  return {
    all: definitions,
    byId(id) {
      return definitions.find(d => d.id === id);
    },
    buildTokens
  };
})();
