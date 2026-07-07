/**
 * Checks a URL against a list of trusted origins.
 *
 * Supports exact prefixes ("https://example.com") and wildcard suffixes
 * ("https://example.com/*", "https://*.example.com" — the "*" is only
 * meaningful at the end of the pattern, matched as a simple prefix check).
 */
export declare function isTrustedOrigin(url: string, trustedOrigins: string[]): boolean;
