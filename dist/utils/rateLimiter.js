/**
 * A minimal in-memory rolling-window rate limiter, keyed by command name.
 * Lives for as long as the provider instance does — no persistence, no deps.
 */
export function createRateLimiter(windowMs = 60000) {
    const callHistory = {};
    return {
        /** Returns false and records nothing if the limit for this command is already hit. */
        isAllowed(command, limit) {
            if (!limit)
                return true; // no limit configured for this command
            const now = Date.now();
            const cutoff = now - windowMs;
            const recentCalls = (callHistory[command] || []).filter((t) => t > cutoff);
            if (recentCalls.length >= limit) {
                callHistory[command] = recentCalls;
                return false;
            }
            recentCalls.push(now);
            callHistory[command] = recentCalls;
            return true;
        },
        reset(command) {
            if (command)
                delete callHistory[command];
            else
                Object.keys(callHistory).forEach((key) => delete callHistory[key]);
        },
    };
}
