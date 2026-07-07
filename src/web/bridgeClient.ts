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

interface PendingEntry {
  resolve: (response: BridgeResponse) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const pendingRequests: Record<string, PendingEntry> = {};
let resolverInstalled = false;

/** Installs the single global callback native calls back into. Idempotent. */
function ensureResolverInstalled() {
  if (resolverInstalled) return;
  resolverInstalled = true;

  (window as any).__bridgeResolve = (response: BridgeResponse) => {
    const entry = pendingRequests[response.requestId];
    if (!entry) return; // already timed out, or not ours
    clearTimeout(entry.timeout);
    delete pendingRequests[response.requestId];
    entry.resolve(response);
  };
}

/** True when running inside the native app's WebView, false in a normal browser tab. */
export function isInsideBridge(): boolean {
  return typeof window !== "undefined" && !!(window as any).ReactNativeWebView;
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
export function callNative<T = any>(
  command: string,
  payload?: any,
  options?: { timeoutMs?: number },
): Promise<BridgeResponse<T>> {
  ensureResolverInstalled();
  const timeoutMs = options?.timeoutMs ?? 10_000;

  return new Promise((resolve) => {
    if (!isInsideBridge()) {
      resolve({
        requestId: "no-bridge",
        success: false,
        error:
          "Not running inside the native app — window.ReactNativeWebView is unavailable.",
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

    (window as any).ReactNativeWebView.postMessage(
      JSON.stringify({ command, payload, requestId }),
    );
  });
}

/**
 * Subscribes to messages native sends *without* being asked (pushed via
 * `postMessageToWeb` from a handler). Returns an unsubscribe function.
 * Only one listener is supported at a time, matching the single global
 * hook native writes to (`window.onNativeMessageReceived`) — call the
 * returned cleanup function before subscribing again.
 */
export function onNativeMessage(callback: (payload: any) => void): () => void {
  (window as any).onNativeMessageReceived = callback;
  return () => {
    if ((window as any).onNativeMessageReceived === callback) {
      delete (window as any).onNativeMessageReceived;
    }
  };
}
