/**
 * parse.ts — Runs the Nearley grammar and returns a flat AstNode array.
 *
 * Usage:
 *   import { parseFilterQuery } from "./grammar/parse";
 *   const nodes = parseFilterQuery("cost between 1 and 10 and state = Done");
 */

import { createRequire } from "module";
import nearley from "nearley";
import { preprocess } from "./synonyms";

// nearley's compiled output is CommonJS; use createRequire so this module
// works under both CJS and ESM runtimes.
const _require = createRequire(import.meta.url);
const grammarDef = _require("./filter.cjs") as nearley.CompiledRules;

// ---------------------------------------------------------------------------
// AST node types
// ---------------------------------------------------------------------------

export type AstRawValue =
  | { kind: "word";   raw: string }
  | { kind: "number"; raw: string }
  | { kind: "date";   raw: string };

export type AstValueExpr = {
  type: "value";
  field: string | null;
  op: string | null;
  value: AstRawValue;
};

export type AstRangeExpr = {
  type: "range";
  field: string | null;
  from: AstRawValue;
  to: AstRawValue;
};

export type AstListExpr = {
  type: "list";
  field: string | null;
  op: "in" | "!";
  values: AstRawValue[];
};

export type AstGroupExpr = {
  type: "group";
  clauses: AstNode[];
};

export type AstConnector = { type: "AND" | "OR" };

export type AstNode =
  | AstValueExpr
  | AstRangeExpr
  | AstListExpr
  | AstGroupExpr
  | AstConnector;

// ---------------------------------------------------------------------------
// Parser factory (parsers are stateful — create a fresh one per call)
// ---------------------------------------------------------------------------

function createParser(): nearley.Parser {
  const grammar = nearley.Grammar.fromCompiled(grammarDef);
  return new nearley.Parser(grammar);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a natural-language filter query string into an AstNode array.
 *
 * The array contains clause nodes (value / range / list / group) interleaved
 * with connector nodes ({ type: "AND" } / { type: "OR" }), mirroring the
 * FilterPill[] shape used by ai-filter.
 *
 * @throws SyntaxError on unrecognised / ambiguous input.
 */
export function parseFilterQuery(input: string): AstNode[] {
  if (!input.trim()) return [];

  const processed = preprocess(input);
  const parser = createParser();

  try {
    parser.feed(processed);
    parser.finish();
  } catch (err) {
    const syntaxError = new SyntaxError(
      `Filter parse error: ${err instanceof Error ? err.message : String(err)}\n  Input: "${input}"`,
    );
    if (err instanceof Error) {
      // Keep causal chain without relying on ErrorOptions.cause typing.
      (syntaxError as SyntaxError & { cause?: unknown }).cause = err;
    }
    throw syntaxError;
  }

  const results: AstNode[][] = parser.results;
  if (results.length === 0) {
    throw new SyntaxError(`Filter parse error: no valid parse found\n  Input: "${input}"`);
  }

  // Earley parsers may return multiple valid parses for ambiguous grammars.
  // The first result corresponds to the highest-priority rule ordering.
  return results[0];
}

