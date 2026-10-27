import crypto from "crypto";

/**
 * Platform commission on a storefront sale, in basis points (500 = 5%).
 *
 * Declared as a constant rather than an env var so the number the creator sees in the
 * payout preview and the number the platform reports can never come from two different
 * places. A future plan-dependent rate belongs here as a lookup, not at the call sites.
 */
export const PLATFORM_FEE_BASIS_POINTS = 500;

/** Smallest charge the fee applies to, so a cheap product is not free to host. */
export const MIN_FEE_IDR = 1000;

/** Basis points are 1/100th of a percent, so 10000 = 100%. */
export const BASIS_POINTS_DENOMINATOR = 10_000;

/**
 * Splits a charge into the platform's fee and the creator's net, in whole IDR.
 *
 * The fee is rounded down and the creator receives the remainder, so the two halves
 * always sum to the original amount — a rounding that favoured the platform would make
 * the payout report disagree with the orders it is built from.
 */
export function calculatePayout(
  amount: number,
  feeBasisPoints = PLATFORM_FEE_BASIS_POINTS
): { gross: number; fee: number; net: number } {
  const gross = Math.max(0, Math.trunc(amount));
  if (gross === 0) {
    return { gross: 0, fee: 0, net: 0 };
  }
  const rawFee = Math.floor((gross * feeBasisPoints) / BASIS_POINTS_DENOMINATOR);
  const fee = Math.min(gross, Math.max(rawFee, MIN_FEE_IDR));
  return { gross, fee, net: gross - fee };
}

const LICENSE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Mints a licence key for a code-delivered product.
 *
 * The alphabet omits `I`, `O`, `0` and `1`, which are the characters buyers mistype when
 * copying a key by hand. 20 characters from a 32-symbol alphabet is ~100 bits, so a key
 * is not guessable and `crypto.randomInt` keeps the draw unbiased.
 */
export function generateLicenseKey(prefix = "OPENLYNK"): string {
  const cleanPrefix = (prefix || "OPENLYNK").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  const groups: string[] = [];
  for (let group = 0; group < 4; group++) {
    let chunk = "";
    for (let i = 0; i < 5; i++) {
      chunk += LICENSE_ALPHABET[crypto.randomInt(LICENSE_ALPHABET.length)];
    }
    groups.push(chunk);
  }
  return `${cleanPrefix}-${groups.join("-")}`;
}

/** A URL-safe token that authorises the download page for one purchase. */
export function generateDownloadToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/**
 * Whether two download tokens match, compared in constant time.
 *
 * The token is a bearer credential for a paid file, so a length-independent comparison
 * removes timing as a way to recover one. Lengths are compared first because
 * `timingSafeEqual` throws on a mismatch.
 */
export function downloadTokensMatch(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (providedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

/** `OL-<epoch>-<hex>` — unique, sortable by creation time, and readable in a log. */
export function generateStoreOrderId(): string {
  return `OL-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

/** A buyer-facing purchase id. */
export function generatePurchaseId(): string {
  return `pur_${crypto.randomBytes(12).toString("hex")}`;
}
