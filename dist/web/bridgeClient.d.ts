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
export interface BridgeResponse<T = any> {
    requestId: string;
    success: boolean;
    data?: T;
    error?: string;
}
/** True when running inside the native app's WebView, false in a normal browser tab. */
export declare function isInsideBridge(): boolean;
/**
 * Calls a native command and resolves with its response.
 * Resolves (never rejects) so callers can always check `.success` — this
 * matches how the native side reports handler errors, instead of throwing.
 *
 * If called outside the native app (e.g. testing the site in a normal
 * browser tab), resolves immediately with a `success: false` response
 * instead of hanging forever.
 */
export declare function callNative<T = any>(command: string, payload?: any, options?: {
    timeoutMs?: number;
}): Promise<BridgeResponse<T>>;
/**
 * Subscribes to messages native sends *without* being asked (pushed via
 * `postMessageToWeb` from a handler). Returns an unsubscribe function.
 * Only one listener is supported at a time, matching the single global
 * hook native writes to (`window.onNativeMessageReceived`) — call the
 * returned cleanup function before subscribing again.
 */
export declare function onNativeMessage(callback: (payload: any) => void): () => void;
