// ── Lexicon state ────────────────────────────────────────────────────────────
let LEXICON = [];        // common words (commonness=1 in lexicon.txt)
let LEXICON_SET = new Set();
let FULL_LEXICON = [];   // all words in lexicon.txt
let FULL_LEXICON_SET = new Set();
let CONUNDRUMS = [];     // words where conundrum difficulty > 0
let CONUNDRUM_DIFFICULTY = new Map(); // word -> difficulty value (1-4)

export async function loadLexicons(lexiconPath, onProgress) {
  onProgress('Loading lexicon...');
  const text = await fetch(lexiconPath).then(r => r.text());
  for (const line of text.split('\n')) {
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const word = parts[0].trim().toUpperCase();
    if (!word || !/^[A-Z]+$/.test(word)) continue;
    const common = parts[1].trim() === '1';
    const difficulty = parseInt(parts[2].trim()) || 0;
    FULL_LEXICON.push(word);
    FULL_LEXICON_SET.add(word);
    if (common) { LEXICON.push(word); LEXICON_SET.add(word); }
    if (difficulty > 0) {
      CONUNDRUMS.push(word);
      CONUNDRUM_DIFFICULTY.set(word, difficulty);
    }
  }
  onProgress(null);
}

export function isConundrum(word) {
  return CONUNDRUM_DIFFICULTY.has(word.toUpperCase());
}

export function conundrumDifficulty(word) {
  return CONUNDRUM_DIFFICULTY.get(word.toUpperCase()) || 0;
}

// ── Counter helpers ───────────────────────────────────────────────────────────
function counter(str) {
  const c = {};
  for (const ch of str) c[ch] = (c[ch] || 0) + 1;
  return c;
}

function counterSubtract(a, b) {
  // Returns a - b (only positive values kept)
  const result = { ...a };
  for (const [k, v] of Object.entries(b)) {
    result[k] = (result[k] || 0) - v;
    if (result[k] <= 0) delete result[k];
  }
  return result;
}

function counterIsSubset(sub, sup) {
  // Returns true if sub's letters are all covered by sup
  for (const [k, v] of Object.entries(sub)) {
    if ((sup[k] || 0) < v) return false;
  }
  return true;
}

function counterEquals(a, b) {
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  return keysA.every(k => a[k] === b[k]);
}

function counterSum(c) {
  return Object.values(c).reduce((s, v) => s + v, 0);
}

function counterElements(c) {
  const els = [];
  for (const [k, v] of Object.entries(c)) {
    for (let i = 0; i < v; i++) els.push(k);
  }
  return els;
}

// ── Restrictions ─────────────────────────────────────────────────────────────
function hasCommonSubstring(a, b, length = 4) {
  for (let i = 0; i <= a.length - length; i++) {
    if (b.includes(a.slice(i, i + length))) return true;
  }
  return false;
}

function lcsLength(a, b) {
  const m = a.length, n = b.length;
  const dp = new Array(n + 1).fill(0);
  for (let i = 0; i < m; i++) {
    let prev = 0;
    for (let j = 0; j < n; j++) {
      const temp = dp[j + 1];
      dp[j + 1] = a[i] === b[j] ? prev + 1 : Math.max(dp[j + 1], dp[j]);
      prev = temp;
    }
  }
  return dp[n];
}

export function applyRestrictions(scrambles, word, restrictions) {
  let result = scrambles;
  if (restrictions.includes('start_end_same_position')) {
    result = result.filter(s =>
      s.slice(0, 3) !== word.slice(0, 3) && s.slice(-3) !== word.slice(-3)
    );
  }
  if (restrictions.includes('no_four_consecutive')) {
    result = result.filter(s => !hasCommonSubstring(s, word));
  }
  if (restrictions.includes('no_five_same_order')) {
    result = result.filter(s => lcsLength(s, word) < 5);
  }
  if (restrictions.includes('no_four_same_position')) {
    result = result.filter(s => {
      let count = 0;
      for (let i = 0; i < s.length; i++) if (s[i] === word[i]) count++;
      return count < 4;
    });
  }
  return result;
}

// ── Permutations ──────────────────────────────────────────────────────────────
function* permutations(arr) {
  if (arr.length <= 1) { yield arr; return; }
  const seen = new Set();
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) {
      const candidate = [arr[i], ...perm].join('');
      if (!seen.has(candidate)) {
        seen.add(candidate);
        yield [arr[i], ...perm];
      }
    }
  }
}

function comboToStrings(combo) {
  const results = new Set();
  for (const perm of permutations(combo)) results.add(perm.join(''));
  return [...results].sort();
}

// ── Styles ────────────────────────────────────────────────────────────────────
export function findPairs(word, lexicon) {
  const target = counter(word);
  const n = word.length;
  const candidates = lexicon.filter(w =>
    w.length >= 2 && w.length < n && counterIsSubset(counter(w), target)
  );
  const wordCounters = Object.fromEntries(candidates.map(w => [w, counter(w)]));

  const results = [];
  const seen = new Set();

  for (const w1 of candidates) {
    const remaining = counterSubtract(target, wordCounters[w1]);
    if (counterSum(remaining) !== n - w1.length) continue;
    for (const w2 of candidates) {
      if (w1.length + w2.length === n && counterEquals(wordCounters[w2], remaining)) {
        const pair = [w1, w2].sort().join('|');
        if (!seen.has(pair)) {
          seen.add(pair);
          results.push([w1, w2].sort());
        }
      }
    }
  }
  return results;
}

const THREE_WORD_PARTITIONS = [[2, 3, 4], [3, 3, 3]];

export function findTriples(word, lexicon) {
  const target = counter(word);
  const n = word.length;

  const byLen = {};
  for (const w of lexicon) {
    if (w.length >= 2 && w.length <= n - 4 && counterIsSubset(counter(w), target)) {
      if (!byLen[w.length]) byLen[w.length] = [];
      byLen[w.length].push(w);
    }
  }
  const wordCounters = {};
  for (const wlist of Object.values(byLen))
    for (const w of wlist) wordCounters[w] = counter(w);

  const results = [];
  const seen = new Set();

  for (const partition of THREE_WORD_PARTITIONS) {
    const [la, lb, lc] = [...partition].sort((a, b) => a - b);
    const listA = byLen[la] || [], listB = byLen[lb] || [], listC = byLen[lc] || [];

    for (const w1 of listA) {
      const rem1 = counterSubtract(target, wordCounters[w1]);
      if (counterSum(rem1) !== n - la) continue;
      for (const w2 of listB) {
        if (!counterIsSubset(wordCounters[w2], rem1)) continue;
        const rem2 = counterSubtract(rem1, wordCounters[w2]);
        if (counterSum(rem2) !== lc) continue;
        for (const w3 of listC) {
          if (counterEquals(wordCounters[w3], rem2)) {
            const triple = [w1, w2, w3].sort().join('|');
            if (!seen.has(triple)) {
              seen.add(triple);
              results.push([w1, w2, w3].sort());
            }
          }
        }
      }
    }
  }
  return results;
}

export function findStem(word, lexicon) {
  const target = counter(word);
  const n = word.length;
  const results = [];
  const seen = new Set();

  for (const w of lexicon) {
    if (w.length !== n - 1) continue;
    const wc = counter(w);
    if (!counterIsSubset(wc, target)) continue;
    const leftoverC = counterSubtract(target, wc);
    const leftover = Object.keys(leftoverC)[0];
    const result = w + leftover;
    if (!seen.has(result)) {
      seen.add(result);
      results.push({ scramble: result, stem: w, extra: leftover });
    }
  }
  return results.sort((a, b) => a.scramble.localeCompare(b.scramble));
}

export function findDoubleStem(word, lexicon) {
  const target = counter(word);
  const n = word.length;
  const results = [];
  const seen = new Set();

  for (const w of lexicon) {
    if (w.length !== n - 2) continue;
    const wc = counter(w);
    if (!counterIsSubset(wc, target)) continue;
    const leftoverC = counterSubtract(target, wc);
    const leftoverLetters = counterElements(leftoverC);
    for (const perm of permutations(leftoverLetters)) {
      const result = w + perm.join('');
      if (!seen.has(result)) {
        seen.add(result);
        results.push({ scramble: result, stem: w, extra: perm.join('') });
      }
    }
  }
  return results.sort((a, b) => a.scramble.localeCompare(b.scramble));
}

const VOWELS = new Set('AEIOU');
function sameClass(a, b) {
  return VOWELS.has(a) === VOWELS.has(b);
}

export function findSubstituteLetter(word, lexicon) {
  const target = counter(word);
  const n = word.length;
  const results = [];
  const seen = new Set();

  for (const w of lexicon) {
    if (w.length !== n) continue;
    const wc = counter(w);
    const excess = counterSubtract(wc, target);
    const deficit = counterSubtract(target, wc);
    if (counterSum(excess) !== 1 || counterSum(deficit) !== 1) continue;
    const oldLetter = Object.keys(excess)[0];
    const newLetter = Object.keys(deficit)[0];
    if (!sameClass(oldLetter, newLetter)) continue;
    const result = w.replace(oldLetter, newLetter);
    const key = result + '|' + w;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ scramble: result, source: w, from: oldLetter, to: newLetter });
    }
  }
  return results.sort((a, b) => a.scramble.localeCompare(b.scramble));
}

// ── Solution mode: run all active styles ──────────────────────────────────────
export function runSolutionMode(word, styles, restrictions) {
  word = word.toUpperCase();
  const lexicon = restrictions.includes('no_obscure_subwords') ? LEXICON : FULL_LEXICON;
  const sections = [];

  if (styles.includes('two_words')) {
    const pairs = findPairs(word, lexicon);
    let strings = pairs.flatMap(combo => comboToStrings(combo));
    strings = applyRestrictions([...new Set(strings)].sort(), word, restrictions);
    sections.push({ title: 'Two-word combinations', rows: strings.map(s => ({ scramble: s })) });
  }

  if (styles.includes('three_words')) {
    const triples = findTriples(word, lexicon);
    let strings = triples.flatMap(combo => comboToStrings(combo));
    strings = applyRestrictions([...new Set(strings)].sort(), word, restrictions);
    sections.push({ title: 'Three-word combinations', rows: strings.map(s => ({ scramble: s })) });
  }

  if (styles.includes('substitute_letter')) {
    let subs = findSubstituteLetter(word, lexicon);
    subs = subs.filter(r => applyRestrictions([r.scramble], word, restrictions).length > 0);
    sections.push({
      title: 'Substitute-letter',
      rows: subs.map(r => ({ scramble: r.scramble, detail: `from ${r.source}, ${r.from}→${r.to}` }))
    });
  }

  if (styles.includes('stem')) {
    let stems = findStem(word, lexicon);
    stems = stems.filter(r => applyRestrictions([r.scramble], word, restrictions).length > 0);
    sections.push({
      title: 'Stem',
      rows: stems.map(r => ({ scramble: r.scramble, detail: `stem: ${r.stem}, +${r.extra}` }))
    });
  }

  if (styles.includes('double_stem')) {
    let ds = findDoubleStem(word, lexicon);
    ds = ds.filter(r => applyRestrictions([r.scramble], word, restrictions).length > 0);
    sections.push({
      title: 'Double stem',
      rows: ds.map(r => ({ scramble: r.scramble, detail: `stem: ${r.stem}, +${r.extra}` }))
    });
  }

  return sections;
}

// ── Jumbledness ───────────────────────────────────────────────────────────────
// Returns a string like "70%" — 100% minus 10% per shared adjacency pair.
// Adjacencies include virtual ^ (word-start) and $ (word-end) characters.
export function jumbledness(scramble, solution) {
  const adjSet = word => {
    const s = '^' + word + '$';
    const pairs = new Set();
    for (let i = 0; i < s.length - 1; i++) pairs.add(s[i] + s[i + 1]);
    return pairs;
  };
  const solAdj = adjSet(solution);
  const scrAdj = adjSet(scramble);
  let shared = 0;
  for (const p of scrAdj) { if (solAdj.has(p)) shared++; }
  return (100 - shared * 10) + '%';
}

// ── Subword mode ──────────────────────────────────────────────────────────────
export function runSubwordMode(subword, restrictions) {
  subword = subword.toUpperCase();
  const subCounter = counter(subword);
  const lexSet = restrictions.includes('no_obscure_subwords') ? LEXICON_SET : FULL_LEXICON_SET;
  const hits = [];
  const seen = new Set();

  for (const w of CONUNDRUMS) {
    const wc = counter(w);
    if (!counterIsSubset(subCounter, wc)) continue;
    const remaining = counterSubtract(wc, subCounter);
    const remainingLetters = counterElements(remaining);

    for (const perm of permutations(remainingLetters)) {
      const candidate = perm.join('');
      if (lexSet.has(candidate)) {
        for (const scramble of [subword + candidate, candidate + subword]) {
          if (applyRestrictions([scramble], w, restrictions).length > 0) {
            const key = scramble + '|' + w;
            if (!seen.has(key)) {
              seen.add(key);
              hits.push({ scramble, solution: w, difficulty: CONUNDRUM_DIFFICULTY.get(w) || 0 });
            }
          }
        }
      }
    }
  }

  hits.sort((a, b) => a.scramble.localeCompare(b.scramble));
  return hits;
}
