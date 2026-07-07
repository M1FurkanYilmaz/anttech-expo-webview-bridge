import React, { createContext, useCallback, useContext, useMemo, useRef, } from "react";
import { isTrustedOrigin } from "./utils/originMatcher";
import { createRateLimiter } from "./utils/rateLimiter";
const WebViewBridgeContext = createContext(null);
/** Hook to consume the bridge from any component under <WebViewBridgeProvider>. */
export function useWebViewBridge() {
    const ctx = useContext(WebViewBridgeContext);
    if (!ctx) {
        throw new Error("useWebViewBridge() must be called inside a <WebViewBridgeProvider>.");
    }
    return ctx;
}
export function WebViewBridgeProvider({ config, children, }) {
    const webViewRef = useRef(null);
    const rateLimiter = useMemo(() => createRateLimiter(), []);
    const sendResponse = useCallback((response) => {
        var _a;
        (_a = webViewRef.current) === null || _a === void 0 ? void 0 : _a.injectJavaScript(`
      if (window.__bridgeResolve) {
        window.__bridgeResolve(${JSON.stringify(response)});
      }
      true;
    `);
    }, []);
    const postMessageToWeb = useCallback((payload) => {
        var _a;
        const serialized = JSON.stringify(payload);
        (_a = webViewRef.current) === null || _a === void 0 ? void 0 : _a.injectJavaScript(`
      if (window.onNativeMessageReceived) {
        window.onNativeMessageReceived(${serialized});
      } else if (window.postMessage) {
        window.postMessage(${serialized}, "*");
      }
      true;
    `);
    }, []);
    const handleMessage = useCallback(async (event) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const originUrl = event.nativeEvent.url;
        // 1. Only accept messages from origins you explicitly trust.
        if (!isTrustedOrigin(originUrl, config.trustedOrigins)) {
            (_a = config.onBlocked) === null || _a === void 0 ? void 0 : _a.call(config, `Blocked message from untrusted origin: ${originUrl}`);
            return;
        }
        // 2. Parse the payload. We accept either a plain object or a
        // JSON-stringified object, since some WebView setups double-encode.
        let parsed;
        try {
            const raw = typeof event.nativeEvent.data === "string"
                ? JSON.parse(event.nativeEvent.data)
                : event.nativeEvent.data;
            parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        }
        catch {
            (_b = config.onBlocked) === null || _b === void 0 ? void 0 : _b.call(config, "Received a message that could not be parsed as JSON.");
            return;
        }
        // `command` is the current field name; `type` is accepted too so you
        // can migrate an older web app without changing it on day one.
        const command = (_c = parsed.command) !== null && _c !== void 0 ? _c : parsed.type;
        const payload = parsed.payload;
        const requestId = (_d = parsed.requestId) !== null && _d !== void 0 ? _d : `req_${Date.now()}`;
        if (!command) {
            (_e = config.onBlocked) === null || _e === void 0 ? void 0 : _e.call(config, "Received a message with no command/type field.");
            return;
        }
        // 3. The command must be explicitly registered — this is the allowlist.
        const definition = config.commands[command];
        if (!definition) {
            (_f = config.onBlocked) === null || _f === void 0 ? void 0 : _f.call(config, `Rejected unknown command: ${command}`);
            sendResponse({
                requestId,
                success: false,
                error: `Unknown command: ${command}`,
            });
            return;
        }
        if (definition.payloadRequired && payload === undefined) {
            sendResponse({
                requestId,
                success: false,
                error: `Command "${command}" requires a payload.`,
            });
            return;
        }
        // 4. Rate limiting, if configured for this command.
        if (!rateLimiter.isAllowed(command, definition.rateLimit)) {
            (_g = config.onBlocked) === null || _g === void 0 ? void 0 : _g.call(config, `Rate limit exceeded for command: ${command}`);
            sendResponse({
                requestId,
                success: false,
                error: "Too many requests. Please slow down.",
            });
            return;
        }
        // 5. Run the handler and report back.
        const startedAt = Date.now();
        try {
            const data = await definition.handler(payload, {
                webViewRef,
                requestId,
                originUrl,
                postMessageToWeb,
            });
            (_h = config.onEvent) === null || _h === void 0 ? void 0 : _h.call(config, {
                command,
                durationMs: Date.now() - startedAt,
                success: true,
                origin: originUrl,
                requestId,
            });
            sendResponse({ requestId, success: true, data: data !== null && data !== void 0 ? data : null });
        }
        catch (err) {
            (_j = config.onHandlerError) === null || _j === void 0 ? void 0 : _j.call(config, command, err);
            sendResponse({
                requestId,
                success: false,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }, [config, rateLimiter, postMessageToWeb, sendResponse]);
    const value = useMemo(() => ({ webViewRef, handleMessage, postMessageToWeb }), [handleMessage, postMessageToWeb]);
    return (<WebViewBridgeContext.Provider value={value}>
      {children}
    </WebViewBridgeContext.Provider>);
}
