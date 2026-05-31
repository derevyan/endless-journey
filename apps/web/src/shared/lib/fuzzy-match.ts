/**
 * Fuzzy Match Utility
 *
 * Provides fuzzy/CamelCase matching for variable autocomplete.
 * Supports VS Code-style matching patterns:
 * - Substring: "resp" → "lastResponse"
 * - CamelCase: "lRes" → "lastResponse"
 * - Acronym: "uFN" → "user.firstName"
 *
 * @module lib/fuzzy-match
 */

export interface FuzzyMatchResult {
  /** Match score 0-100 (higher = better match) */
  score: number;
  /** Indices of matched characters in the text */
  matches: number[];
}

/**
 * Fuzzy match a query against text
 * Returns null if no match found
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatchResult | null {
  if (!query) return { score: 100, matches: [] };
  if (!text) return null;

  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();

  // Try exact prefix match first (highest score)
  if (textLower.startsWith(queryLower)) {
    return {
      score: 100,
      matches: Array.from({ length: query.length }, (_, i) => i),
    };
  }

  // Try exact substring match
  const substringIndex = textLower.indexOf(queryLower);
  if (substringIndex !== -1) {
    return {
      score: 90 - substringIndex * 0.5, // Penalize matches further into string
      matches: Array.from({ length: query.length }, (_, i) => substringIndex + i),
    };
  }

  // Try CamelCase/boundary matching
  const boundaryResult = matchWordBoundaries(query, text);
  if (boundaryResult) {
    return boundaryResult;
  }

  // Try character-by-character fuzzy match
  const fuzzyResult = matchFuzzy(queryLower, textLower);
  if (fuzzyResult) {
    return fuzzyResult;
  }

  return null;
}

/**
 * Match against word boundaries (CamelCase, dots, underscores)
 * e.g., "lRes" → "lastResponse", "uFN" → "user.firstName"
 */
function matchWordBoundaries(query: string, text: string): FuzzyMatchResult | null {
  const queryLower = query.toLowerCase();
  const matches: number[] = [];
  let queryIndex = 0;
  let score = 80;

  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    const char = text[i];
    const charLower = char.toLowerCase();
    const queryChar = queryLower[queryIndex];

    // Check if this is a word boundary
    const isWordBoundary =
      i === 0 || // Start of string
      char === char.toUpperCase() || // Capital letter
      text[i - 1] === "." || // After dot
      text[i - 1] === "_" || // After underscore
      text[i - 1] === "-"; // After hyphen

    if (charLower === queryChar) {
      matches.push(i);
      queryIndex++;

      // Bonus for boundary matches
      if (isWordBoundary) {
        score += 2;
      } else if (matches.length > 0 && matches[matches.length - 2] === i - 1) {
        // Consecutive match
        score += 1;
      }
    }
  }

  // All query characters must be matched
  if (queryIndex !== query.length) {
    return null;
  }

  // Penalize spread-out matches
  const spread = matches[matches.length - 1] - matches[0];
  score -= spread * 0.3;

  return {
    score: Math.max(40, Math.min(85, score)),
    matches,
  };
}

/**
 * Character-by-character fuzzy matching
 * All query chars must appear in order
 */
function matchFuzzy(queryLower: string, textLower: string): FuzzyMatchResult | null {
  const matches: number[] = [];
  let queryIndex = 0;

  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      matches.push(i);
      queryIndex++;
    }
  }

  if (queryIndex !== queryLower.length) {
    return null;
  }

  // Calculate score based on:
  // - Number of gaps between matches
  // - Position of first match
  const gaps = matches.reduce((count, pos, i) => {
    if (i === 0) return 0;
    return count + (pos - matches[i - 1] - 1);
  }, 0);

  const score = Math.max(20, 60 - gaps * 2 - matches[0] * 0.5);

  return { score, matches };
}

/**
 * Filter and sort items by fuzzy match score
 */
export function fuzzyFilter<T>(
  query: string,
  items: T[],
  accessor: (item: T) => string
): Array<T & { matchResult: FuzzyMatchResult }> {
  if (!query) {
    return items.map((item) => ({ ...item, matchResult: { score: 100, matches: [] } }));
  }

  const results: Array<T & { matchResult: FuzzyMatchResult }> = [];

  for (const item of items) {
    const text = accessor(item);
    const matchResult = fuzzyMatch(query, text);

    if (matchResult) {
      results.push({ ...item, matchResult });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.matchResult.score - a.matchResult.score);

  return results;
}
