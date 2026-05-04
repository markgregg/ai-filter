/**
 * tokens.ts — Moo lexer definition for the filter grammar.
 *
 * Operates on pre-processed input (synonyms.ts has already collapsed
 * multi-word phrases to __token__ words).
 *
 * IMPORTANT: moo.keywords() promotes certain WORD matches to keyword types;
 * the keyword names (AND, OR, etc.) must match the %TYPE references in filter.ne.
 */

import moo from "moo";

export const lexer = moo.compile({
  WS: { match: /[ \t\r\n]+/, lineBreaks: true },

  // Symbol operators — longer patterns first to avoid prefix clashes
  GTE_SYM:  ">=",
  LTE_SYM:  "<=",
  NEQ_SYM:  "!=",
  BANGSTAR: "!*",
  LTSTAR:   "<*",
  GTSTAR:   ">*",
  GT_SYM:   ">",
  LT_SYM:   "<",
  EQ_SYM:   "=",
  STAR:     "*",
  BANG:     "!",

  COMMA:  ",",
  LPAREN: "(",
  RPAREN: ")",

  // ISO date (yyyy-MM-dd) must come BEFORE NUMBER so it is not split
  ISODATE: /\d{4}-\d{2}-\d{2}/,
  NUMBER:  /\d+(?:\.\d+)?/,

  // All word-like tokens including __tokens__.  moo.keywords() promotes
  // specific lowercased values to their own token types.
  WORD: {
    match: /[A-Za-z_][A-Za-z0-9_]*/,
    type: moo.keywords({
      AND:     "and",
      OR:      "or",
      FROM:    "from",
      TO:      "to",
      BETWEEN: "between",
      IN_KW:   "in",
      NOT_KW:  "not",
    }),
  },
});
