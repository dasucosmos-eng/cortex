// ============================================================
// AI Browser Memory Extension — Security Barrel Export
// ============================================================

// ---- Detector ----
export {
  detectSensitiveData,
  sanitizeContent,
  shouldIgnoreUrl,
  isContentSensitive,
  calculateEntropy,
  SENSITIVE_PATTERNS,
} from "./detector";

export type {
  SensitivePattern,
  SensitiveMatch,
} from "./detector";

// ---- Vault ----
export {
  encrypt,
  decrypt,
  generateKey,
  getEncryptionKey,
  setEncryptionKey,
  isValidPayload,
} from "./vault";

export type {
  EncryptedPayload,
} from "./vault";
