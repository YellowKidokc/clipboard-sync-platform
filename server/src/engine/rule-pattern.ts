/**
 * Rule patterns are user-supplied and compiled straight into RegExp. Only the
 * authenticated owner of an account can create rules, so a bad pattern is
 * self-inflicted rather than a way for one user to attack another — but an
 * accidental `(a+)+` still hangs clip ingest for every clip that follows,
 * because V8 cannot interrupt a regex once it is running. Capping the input
 * length does not help: `(a+)+$` against 30 characters already takes seconds.
 *
 * So the pattern shapes that backtrack exponentially are rejected at creation
 * time, before anything is stored. This is a structural heuristic, not a
 * proof. A linear-time engine (RE2) or matching inside a worker with a hard
 * timeout is the complete fix, and is what this should become if rule
 * authorship ever stops being single-tenant.
 */

export const MAX_PATTERN_LENGTH = 200;
export const MAX_REGEX_INPUT = 10_000;

/** Index of the `)` closing the `(` at `start`, or -1. */
function findGroupEnd(pattern: string, start: number): number {
  let depth = 0;
  for (let i = start; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === "\\") {
      i += 1;
      continue;
    }
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Splits a group body on top-level `|`, ignoring `|` inside nested groups or classes. */
function splitAlternatives(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (char === "\\") {
      i += 1;
      continue;
    }
    if (char === "[") {
      while (i < body.length && body[i] !== "]") {
        if (body[i] === "\\") i += 1;
        i += 1;
      }
      continue;
    }
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "|" && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  return parts;
}

/**
 * The plain string an alternative matches, or null when it contains anything
 * whose match set cannot be read off literally (a class, a dot, a nested
 * group, a quantifier, an anchor).
 */
function literalOf(alternative: string): string | null {
  let literal = "";
  for (let i = 0; i < alternative.length; i += 1) {
    const char = alternative[i];
    if (char === "\\") {
      const escaped = alternative[i + 1];
      if (escaped === undefined || /[a-zA-Z0-9]/.test(escaped)) return null;
      literal += escaped;
      i += 1;
      continue;
    }
    if ("[](){}*+?|.^$".includes(char)) return null;
    literal += char;
  }
  return literal;
}

/**
 * True when two alternatives can match the same input, so the surrounding
 * quantifier has more than one way to consume it: identical branches, or one a
 * prefix of another (`a|a`, `a|ab`). `GET|POST|PUT` has neither, so repeating
 * it is unambiguous and cheap.
 */
function alternationIsAmbiguous(body: string): boolean {
  const literals = splitAlternatives(body).map(literalOf);
  // A branch that is not a plain string could overlap in ways this cannot see.
  if (literals.some((literal) => literal === null || literal === "")) return true;
  const values = literals as string[];
  for (let i = 0; i < values.length; i += 1) {
    for (let j = 0; j < values.length; j += 1) {
      if (i !== j && values[j].startsWith(values[i])) return true;
    }
  }
  return false;
}

/**
 * True if the group body would make the surrounding quantifier backtrack:
 * either it is itself quantified, or its alternatives can match the same input
 * (`(a|a)+`, `(a|ab)+`). Distinct alternatives like `(foo|bar)+` are fine.
 */
function bodyIsAmbiguous(body: string): boolean {
  let hasTopLevelAlternation = false;
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (char === "\\") {
      i += 1;
      continue;
    }
    if (char === "[") {
      // Character class: quantifiers inside it are literals.
      while (i < body.length && body[i] !== "]") {
        if (body[i] === "\\") i += 1;
        i += 1;
      }
      continue;
    }
    if (char === "*" || char === "+" || char === "{") return true;
    if (char === "|") hasTopLevelAlternation = true;
  }
  if (!hasTopLevelAlternation) return false;

  return alternationIsAmbiguous(body);
}

/**
 * Finds a quantified group whose body is itself quantified or alternated —
 * `(a+)+`, `(a*)*`, `([a-z]+)*`, `(a|a)+`. Returns the offending fragment.
 */
export function findCatastrophicShape(pattern: string): string | null {
  for (let i = 0; i < pattern.length; i += 1) {
    if (pattern[i] === "\\") {
      i += 1;
      continue;
    }
    if (pattern[i] !== "(") continue;
    // Skip lookarounds and named-group prefixes, but keep `(?:` non-capturing
    // groups: they backtrack exactly like capturing ones.
    if (pattern[i + 1] === "?" && pattern[i + 2] !== ":") continue;
    const end = findGroupEnd(pattern, i);
    if (end === -1) continue;
    const quantifier = pattern[end + 1];
    if (quantifier !== "*" && quantifier !== "+" && quantifier !== "{") continue;
    const bodyStart = pattern[i + 1] === "?" ? i + 3 : i + 1;
    if (bodyIsAmbiguous(pattern.slice(bodyStart, end))) {
      return pattern.slice(i, end + 2);
    }
  }
  return null;
}

/** Throws a 400 for a pattern that is too long, uncompilable, or exponential. */
export function compileRulePattern(pattern: string): RegExp {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw Object.assign(
      new Error(`Regex pattern is too long (${pattern.length} characters, limit ${MAX_PATTERN_LENGTH})`),
      { status: 400 }
    );
  }
  const shape = findCatastrophicShape(pattern);
  if (shape) {
    throw Object.assign(
      new Error(
        `Regex pattern "${shape}" nests a quantifier inside a quantified group. That backtracks exponentially and would hang clip processing — rewrite it without the nesting.`
      ),
      { status: 400 }
    );
  }
  try {
    return new RegExp(pattern, "i");
  } catch (error) {
    throw Object.assign(new Error(`Invalid regex pattern: ${(error as Error).message}`), { status: 400 });
  }
}
