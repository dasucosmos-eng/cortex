// ============================================================
// AI Browser Memory Extension — Sensitive Data Detector
// ============================================================
// Comprehensive detection module for API keys, tokens, private
// keys, credentials, and other forms of sensitive data that
// must never be stored in plaintext or sent to AI systems.
// ============================================================

// --------------- Type Definitions ---------------

export interface SensitivePattern {
  type: string;
  patterns: RegExp[];
  description: string;
  severity: "critical" | "high" | "medium";
}

export interface SensitiveMatch {
  type: string;
  value: string;
  position: number;
  length: number;
  severity: "critical" | "high" | "medium";
  line: number;
}

// --------------- Pattern Definitions ---------------

/**
 * Comprehensive library of sensitive data patterns.
 *
 * Each pattern is non-greedy where possible and tested against
 * real-world secret formats. Patterns use word-boundary or
 * lookbehind assertions to avoid false positives on documentation
 * or placeholder text.
 */
export const SENSITIVE_PATTERNS: SensitivePattern[] = [
  // ---- API Keys ----
  {
    type: "openai_api_key",
    patterns: [
      /sk-[a-zA-Z0-9]{20,}(?:[a-zA-Z0-9_-]{4,})?/,
    ],
    description: "OpenAI API key",
    severity: "critical",
  },
  {
    type: "google_api_key",
    patterns: [
      /AIza[a-zA-Z0-9_-]{35}/,
    ],
    description: "Google / Firebase API key",
    severity: "critical",
  },

  // ---- AWS ----
  {
    type: "aws_access_key",
    patterns: [
      /AKIA[0-9A-Z]{16}/,
    ],
    description: "AWS Access Key ID",
    severity: "critical",
  },
  {
    type: "aws_secret_key",
    patterns: [
      /(?<=aws_secret_access_key\s*=\s*|AWS_SECRET_ACCESS_KEY\s*=\s*|aws-secret-access-key:\s*)[A-Za-z0-9/+=]{40}/,
      /(?<=aws_secret_access_key\s*[:=]\s*['"]?)[A-Za-z0-9/+=]{40}/,
    ],
    description: "AWS Secret Access Key",
    severity: "critical",
  },

  // ---- Authentication Tokens ----
  {
    type: "bearer_token",
    patterns: [
      /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/i,
    ],
    description: "Bearer authentication token",
    severity: "high",
  },
  {
    type: "jwt_token",
    patterns: [
      /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+/,
    ],
    description: "JSON Web Token (JWT)",
    severity: "high",
  },
  {
    type: "oauth_secret",
    patterns: [
      /(?<=oauth[_-]?consumer[_-]?secret\s*[:=]\s*['"]?)[a-zA-Z0-9_-]{20,}/i,
      /(?<=client[_-]?secret\s*[:=]\s*['"]?)[a-zA-Z0-9_-]{20,}/i,
    ],
    description: "OAuth consumer/client secret",
    severity: "critical",
  },

  // ---- Private / SSH Keys ----
  {
    type: "private_key",
    patterns: [
      /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
      /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/,
    ],
    description: "RSA / EC / DSA private key or certificate",
    severity: "critical",
  },
  {
    type: "ssh_key",
    patterns: [
      /ssh-(?:rsa|ed25519|ecdsa|dss)\s+[a-zA-Z0-9/+.-]{50,}/,
    ],
    description: "SSH public or private key",
    severity: "critical",
  },

  // ---- Service-Specific Tokens ----
  {
    type: "github_token",
    patterns: [
      /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}/,
    ],
    description: "GitHub personal access / OAuth / app token",
    severity: "critical",
  },
  {
    type: "slack_token",
    patterns: [
      /xox[baprs]-[0-9a-zA-Z-]{10,}/,
    ],
    description: "Slack bot / user / app token",
    severity: "high",
  },
  {
    type: "stripe_key",
    patterns: [
      /(?:sk|pk|rk)_(?:live|test)_[a-zA-Z0-9]{24,}/,
    ],
    description: "Stripe secret / publishable / restricted key",
    severity: "critical",
  },

  // ---- Generic / Env Patterns ----
  {
    type: "generic_api_key",
    patterns: [
      /(?<=api[_-]?key\s*[:=]\s*['"]?)[a-zA-Z0-9_-]{20,}/i,
      /(?<=api[_-]?secret\s*[:=]\s*['"]?)[a-zA-Z0-9_-]{20,}/i,
      /(?<=secret[_-]?key\s*[:=]\s*['"]?)[a-zA-Z0-9_-]{20,}/i,
      /(?<=access[_-]?token\s*[:=]\s*['"]?)[a-zA-Z0-9._-]{20,}/i,
      /(?<=auth[_-]?token\s*[:=]\s*['"]?)[a-zA-Z0-9._-]{20,}/i,
      /(?<=password\s*[:=]\s*['"]?)[^\s'"]{8,}/i,
    ],
    description: "Generic API key, secret, or password assignment",
    severity: "high",
  },
  {
    type: "env_secret",
    patterns: [
      /(?<=SECRET|PASSWORD|TOKEN|API_KEY|PRIVATE_KEY|ACCESS_KEY|AUTH_TOKEN)\s*=\s*\S+/,
    ],
    description: "Environment variable secret value",
    severity: "high",
  },

  // ---- Connection Strings ----
  {
    type: "connection_string",
    patterns: [
      /mongodb(?:\+srv)?:\/\/[^\s"'`]+/i,
      /postgres(?:ql)?:\/\/[^\s"'`]+/i,
      /mysql:\/\/[^\s"'`]+/i,
      /redis:\/\/(?:(?:[^\s@]+)@)?[^\s"'`]+/i,
      /amqps?:\/\/[^\s"'`]+/i,
    ],
    description: "Database or message-broker connection string with credentials",
    severity: "critical",
  },

  // ---- Credit Cards ----
  {
    type: "credit_card",
    patterns: [
      /(?:\d[ -]*?){13,19}/,
    ],
    description: "Potential credit card number (Luhn validation applied at match time)",
    severity: "critical",
  },
];

// --------------- Domains to Ignore ---------------

/**
 * URLs on these domains (and subdomains) are ignored during
 * detection because the user is *intentionally* entering
 * financial / medical credentials on a legitimate site.
 */
const IGNORED_DOMAINS = [
  "banking",
  "bank.",
  "credit",
  "payment",
  "checkout",
  "paypal.com",
  "stripe.com",
  "venmo.com",
  "cash.app",
  "chase.com",
  "wellsfargo.com",
  "bankofamerica.com",
  "citibank.com",
  "capitalone.com",
  "schwab.com",
  "fidelity.com",
  "health",
  "medical",
  "hospital",
  "clinic",
  "insurance",
  "login.",
  "signin.",
  "sso.",
  "auth.",
  "accounts.",
  "secure.",
];

// --------------- Shannon Entropy ---------------

/**
 * Calculate the Shannon entropy of a string in bits per character.
 * High entropy (≥ 4.5) strongly suggests random / generated data
 * such as API keys, tokens, and cryptographic material.
 */
export function calculateEntropy(str: string): number {
  if (!str || str.length === 0) return 0;

  const len = str.length;
  const freq = new Map<string, number>();

  for (const char of str) {
    freq.set(char, (freq.get(char) ?? 0) + 1);
  }

  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / len;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  return entropy;
}

// --------------- Credit Card Luhn Check ---------------

/**
 * Basic Luhn algorithm to verify whether a numeric string is
 * a plausible credit card number.
 */
function passesLuhn(numStr: string): boolean {
  const digits = numStr.replace(/[^\d]/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i]!, 10);
    if (shouldDouble) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

// --------------- High-Entropy Detection ---------------

interface RawEntropyMatch {
  type: string;
  value: string;
  position: number;
  length: number;
}

/**
 * Scan content for long base64 or hex strings whose Shannon entropy
 * exceeds the threshold — these often represent leaked keys or tokens.
 */
function detectHighEntropyStrings(
  content: string,
  threshold: number
): RawEntropyMatch[] {
  const matches: RawEntropyMatch[] = [];

  // Base64-like strings ≥ 24 characters
  const base64Re = /[A-Za-z0-9+/]{24,}={0,2}/g;
  let m: RegExpExecArray | null;
  while ((m = base64Re.exec(content)) !== null) {
    const val = m[0];
    // Skip obvious data-URIs and non-secret base64
    if (
      val.startsWith("data:") ||
      /^A{4,}$/.test(val) ||
      val.length < 24
    ) {
      continue;
    }
    const ent = calculateEntropy(val);
    if (ent >= threshold) {
      matches.push({
        type: "high_entropy_base64",
        value: val,
        position: m.index,
        length: val.length,
      });
    }
  }

  // Hex strings ≥ 32 characters
  const hexRe = /(?:0x)?[a-fA-F0-9]{32,}/g;
  while ((m = hexRe.exec(content)) !== null) {
    const val = m[0];
    const ent = calculateEntropy(val);
    if (ent >= threshold) {
      matches.push({
        type: "high_entropy_hex",
        value: val,
        position: m.index,
        length: val.length,
      });
    }
  }

  return matches;
}

// --------------- Helpers ---------------

/**
 * Convert a character offset in `content` to a 1-based line number.
 */
function offsetToLine(content: string, offset: number): number {
  // Optimised: count newlines up to offset
  let line = 1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

/**
 * Safe preview of a match value — truncates with ellipsis to
 * avoid returning the full secret in responses / logs.
 */
function safePreview(value: string, maxLen = 24): string {
  if (value.length <= maxLen) return value;
  return `${value.substring(0, Math.floor(maxLen / 2))}...${value.substring(value.length - Math.floor(maxLen / 3))}`;
}

// --------------- Main Detection Function ---------------

/**
 * Scan `content` for all known sensitive data patterns plus
 * high-entropy strings. Returns an array of matches sorted by
 * position in the content.
 */
export function detectSensitiveData(
  content: string,
  entropyThreshold = 4.5
): SensitiveMatch[] {
  if (!content || typeof content !== "string") return [];

  const matches: SensitiveMatch[] = [];

  // 1. Pattern-based detection
  for (const patternDef of SENSITIVE_PATTERNS) {
    for (const regex of patternDef.patterns) {
      // Reset lastIndex for safety (regex may be reused)
      regex.lastIndex = 0;

      let m: RegExpExecArray | null;
      while ((m = regex.exec(content)) !== null) {
        // Credit-card matches need Luhn validation
        if (patternDef.type === "credit_card" && !passesLuhn(m[0])) {
          continue;
        }

        // Skip matches that look like documentation placeholders
        const val = m[0];
        if (isPlaceholder(val)) continue;

        matches.push({
          type: patternDef.type,
          value: safePreview(val),
          position: m.index,
          length: val.length,
          severity: patternDef.severity,
          line: offsetToLine(content, m.index),
        });
      }
    }
  }

  // 2. Entropy-based detection
  const entropyMatches = detectHighEntropyStrings(content, entropyThreshold);
  for (const em of entropyMatches) {
    matches.push({
      type: em.type,
      value: safePreview(em.value),
      position: em.position,
      length: em.length,
      severity: "medium",
      line: offsetToLine(content, em.position),
    });
  }

  // 3. Deduplicate overlapping matches (keep the earliest / longest)
  const deduped = deduplicateMatches(matches);

  // 4. Sort by position
  deduped.sort((a, b) => a.position - b.position);

  return deduped;
}

/**
 * Remove overlapping / duplicate matches, preferring the match
 * with the higher severity or longer length.
 */
function deduplicateMatches(matches: SensitiveMatch[]): SensitiveMatch[] {
  // Sort by position, then by severity (critical first)
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2 };
  const sorted = [...matches].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const result: SensitiveMatch[] = [];

  for (const match of sorted) {
    const overlaps = result.some(
      (r) =>
        match.position < r.position + r.length &&
        match.position + match.length > r.position
    );
    if (!overlaps) {
      result.push(match);
    }
  }

  return result;
}

/**
 * Heuristic check for documentation placeholder strings that
 * look like secrets but clearly are not (e.g. "YOUR_API_KEY",
 * "sk-xxxxxxxxxxxx").
 */
function isPlaceholder(val: string): boolean {
  const lower = val.toLowerCase();
  if (/[x]{5,}/.test(lower)) return true;
  if (/^(?:your_|insert_|replace_|example|test|mock|fake|dummy|placeholder)/.test(lower)) return true;
  return false;
}

// --------------- Sanitiser ---------------

/**
 * Replace all detected sensitive data in `content` with
 * `[REDACTED: <type>]` placeholders. The original content is
 * scanned once and replacements are applied in reverse order
 * to preserve character positions.
 */
export function sanitizeContent(content: string): string {
  if (!content || typeof content !== "string") return content;

  const matches = detectSensitiveData(content);
  if (matches.length === 0) return content;

  // Sort in reverse position order so replacements don't shift
  // earlier indices
  const sorted = [...matches].sort((a, b) => b.position - a.position);

  let result = content;
  for (const match of sorted) {
    const replacement = `[REDACTED: ${match.type}]`;
    result =
      result.substring(0, match.position) +
      replacement +
      result.substring(match.position + match.length);
  }

  return result;
}

// --------------- URL Ignore List ---------------

/**
 * Determine whether a URL belongs to a domain where users
 * intentionally enter credentials (banking, payments, medical,
 * authentication). Such pages should be exempt from detection
 * to avoid false-positive noise.
 */
export function shouldIgnoreUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;

  try {
    let hostname = "";
    let pathname = "";

    // Handle full URLs
    if (/^https?:\/\//i.test(url)) {
      const parsed = new URL(url);
      hostname = parsed.hostname.toLowerCase();
      pathname = parsed.pathname.toLowerCase();
    } else {
      // Treat as hostname + optional path
      const firstSlash = url.indexOf("/");
      hostname = (firstSlash >= 0 ? url.substring(0, firstSlash) : url).toLowerCase();
      pathname = firstSlash >= 0 ? url.substring(firstSlash).toLowerCase() : "";
    }

    // Check each ignored domain pattern against hostname and pathname
    for (const pattern of IGNORED_DOMAINS) {
      const p = pattern.toLowerCase();
      if (hostname.includes(p) || pathname.includes(p)) {
        return true;
      }
      // Also check the full URL for the pattern
      if (url.toLowerCase().includes(p)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

// --------------- Convenience: isSensitive ---------------

/**
 * Quick check — returns `true` if *any* sensitive data is
 * detected in the given content.
 */
export function isContentSensitive(content: string): boolean {
  return detectSensitiveData(content).length > 0;
}
