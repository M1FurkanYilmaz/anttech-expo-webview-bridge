/**
 * A minimal in-memory rolling-window rate limiter, keyed by command name.
 * Lives for as long as the provider instance does — no persistence, no deps.
 */
export declare function createRateLimiter(windowMs?: number): {
    /** Returns false and records nothing if the limit for this command is already hit. */
    isAllowed(command: string, limit?: number): boolean;
    reset(command?: string): void;
};
