/**
 * The web-side half of the bridge. Framework-agnostic — no React, no
 * react-native-webview. Import this in whatever runs inside the WebView
 * (a React web app, a Blazor page via JS interop, plain HTML/JS, etc).
 *
 * It talks to the native side using the exact same message shape the
 * <WebViewBridgeProvider> on the native side expects:
 *   -> native : { command, payload, requestId }
 *   <- native : { requestId, success, data?, error? }
 */
const pendingRequests = {};
let resolverInstalled = false;
/** Installs the single global callback native calls back into. Idempotent. */
function ensureResolverInstalled() {
    if (resolverInstalled)
        return;
    resolverInstalled = true;
    window.__bridgeResolve = (response) => {
        const entry = pendingRequests[response.requestId];
        if (!entry)
            return; // already timed out, or not ours
        clearTimeout(entry.timeout);
        delete pendingRequests[response.requestId];
        entry.resolve(response);
    };
}
/** True when running inside the native app's WebView, false in a normal browser tab. */
export function isInsideBridge() {
    return typeof window !== "undefined" && !!window.ReactNativeWebView;
}
/**
 * Calls a native command and resolves with its response.
 * Resolves (never rejects) so callers can always check `.success` — this
 * matches how the native side reports handler errors, instead of throwing.
 *
 * If called outside the native app (e.g. testing the site in a normal
 * browser tab), resolves immediately with a `success: false` response
 * instead of hanging forever.
 */
export function callNative(command, payload, options) {
    var _a;
    ensureResolverInstalled();
    const timeoutMs = (_a = options === null || options === void 0 ? void 0 : options.timeoutMs) !== null && _a !== void 0 ? _a : 10000;
    return new Promise((resolve) => {
        if (!isInsideBridge()) {
            resolve({
                requestId: "no-bridge",
                success: false,
                error: "Not running inside the native app — window.ReactNativeWebView is unavailable.",
            });
            return;
        }
        const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const timeout = setTimeout(() => {
            delete pendingRequests[requestId];
            resolve({
                requestId,
                success: false,
                error: `Command "${command}" timed out after ${timeoutMs}ms.`,
            });
        }, timeoutMs);
        pendingRequests[requestId] = { resolve, timeout };
        window.ReactNativeWebView.postMessage(JSON.stringify({ command, payload, requestId }));
    });
}
/**
 * Subscribes to messages native sends *without* being asked (pushed via
 * `postMessageToWeb` from a handler). Returns an unsubscribe function.
 * Only one listener is supported at a time, matching the single global
 * hook native writes to (`window.onNativeMessageReceived`) — call the
 * returned cleanup function before subscribing again.
 */
export function onNativeMessage(callback) {
    window.onNativeMessageReceived = callback;
    return () => {
        if (window.onNativeMessageReceived === callback) {
            delete window.onNativeMessageReceived;
        }
    };
}
