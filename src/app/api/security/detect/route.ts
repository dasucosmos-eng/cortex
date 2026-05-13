import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

interface SensitiveMatch {
  type: string;
  value: string;
  position: number;
}

// Predefined patterns for sensitive data detection
const SENSITIVE_PATTERNS: Array<{
  name: string;
  pattern: RegExp;
}> = [
  {
    name: "OpenAI API Key",
    pattern: /sk-[a-zA-Z0-9]{20,}([a-zA-Z0-9_-]{10,})?/g,
  },
  {
    name: "Google API Key",
    pattern: /AIza[a-zA-Z0-9_\-]{35}/g,
  },
  {
    name: "AWS Access Key ID",
    pattern: /AKIA[0-9A-Z]{16}/g,
  },
  {
    name: "AWS Secret Access Key",
    pattern: /(?<=aws_secret_access_key\s*=\s*|AWS_SECRET_ACCESS_KEY\s*=\s*)[a-zA-Z0-9/+=]{40}/g,
  },
  {
    name: "Bearer Token",
    pattern: /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,
  },
  {
    name: "JWT Token",
    pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
  },
  {
    name: "Private Key",
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    name: "GitHub Token",
    pattern: /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}/g,
  },
  {
    name: "Slack Token",
    pattern: /xox[baprs]-[a-zA-Z0-9-]+/g,
  },
  {
    name: "Stripe API Key",
    pattern: /(?:sk|pk)_(?:test|live)_[a-zA-Z0-9]{24,}/g,
  },
  {
    name: "Heroku API Key",
    pattern: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
  },
  {
    name: "Mailgun API Key",
    pattern: /key-[a-zA-Z0-9]{32}/g,
  },
  {
    name: "Twilio API Key",
    pattern: /SK[0-9a-fA-F]{32}/g,
  },
  {
    name: "SendGrid API Key",
    pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g,
  },
  {
    name: "Generic Secret (env)",
    pattern: /(?:(?:SECRET|PASSWORD|TOKEN|API_KEY|PRIVATE_KEY|ACCESS_KEY)\s*=\s*)([^\s]+)/gi,
  },
];

/**
 * Calculate Shannon entropy of a string.
 * High entropy (> 4.0) typically indicates random/encrypted data.
 */
function shannonEntropy(str: string): number {
  if (!str || str.length === 0) return 0;

  const freq = new Map<string, number>();
  for (const char of str) {
    freq.set(char, (freq.get(char) || 0) + 1);
  }

  let entropy = 0;
  const len = str.length;
  for (const count of freq.values()) {
    const p = count / len;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  return entropy;
}

/**
 * Detect high-entropy strings that may be sensitive even without known patterns.
 */
function detectHighEntropyStrings(
  content: string
): SensitiveMatch[] {
  const matches: SensitiveMatch[] = [];

  // Look for potential base64-encoded strings (longer than 20 chars)
  const base64Pattern = /(?:[A-Za-z0-9+/]{20,}={0,2})/g;
  let match;
  while ((match = base64Pattern.exec(content)) !== null) {
    const value = match[0];
    // Skip common non-sensitive base64 patterns
    if (
      value.startsWith("data:image") ||
      value.startsWith("data:text") ||
      value.startsWith("data:application") ||
      value.includes("AAAA") // Common padding artifacts
    ) {
      continue;
    }
    const entropy = shannonEntropy(value);
    if (entropy > 4.5) {
      matches.push({
        type: "high-entropy-string",
        value: value.substring(0, 20) + "...",
        position: match.index,
      });
    }
  }

  // Look for long hex strings that might be keys/tokens
  const hexPattern = /(?:0x)?[a-fA-F0-9]{32,}/g;
  while ((match = hexPattern.exec(content)) !== null) {
    const value = match[0];
    const entropy = shannonEntropy(value);
    if (entropy > 3.8) {
      matches.push({
        type: "high-entropy-hex",
        value: value.substring(0, 20) + "...",
        position: match.index,
      });
    }
  }

  return matches;
}

// POST /api/security/detect — Detect sensitive data patterns in content
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required and must be a string" },
        { status: 400 }
      );
    }

    const matches: SensitiveMatch[] = [];

    // Run all pattern detectors
    for (const { name, pattern } of SENSITIVE_PATTERNS) {
      // Reset lastIndex for global regex
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        // For generic secret patterns, extract just the value part
        let value = match[1] || match[0];
        // Truncate long values for safety in the response
        if (value.length > 40) {
          value = value.substring(0, 20) + "..." + value.substring(value.length - 10);
        }

        matches.push({
          type: name,
          value,
          position: match.index,
        });
      }
    }

    // Also detect high-entropy strings
    const entropyMatches = detectHighEntropyStrings(content);
    matches.push(...entropyMatches);

    // Deduplicate matches at the same position
    const uniqueMatches = matches.reduce((acc, match) => {
      const existing = acc.find(
        (m) => m.position === match.position && m.type === match.type
      );
      if (!existing) {
        acc.push(match);
      }
      return acc;
    }, [] as SensitiveMatch[]);

    // Sort by position
    uniqueMatches.sort((a, b) => a.position - b.position);

    const isSensitive = uniqueMatches.length > 0;

    return NextResponse.json({
      isSensitive,
      matchCount: uniqueMatches.length,
      matches: uniqueMatches,
    });
  } catch (error) {
    console.error("[POST /api/security/detect] Error:", error);
    return NextResponse.json(
      { error: "Sensitive data detection failed" },
      { status: 500 }
    );
  }
}
