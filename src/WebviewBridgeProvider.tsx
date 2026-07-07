import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";
import type WebView from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import { isTrustedOrigin } from "./utils/originMatcher";
import { createRateLimiter } from "./utils/rateLimiter";
import type { BridgeResponse, WebViewBridgeConfig } from "./types";

interface WebViewBridgeContextValue {
  /** Pass this to <WebView ref={webViewRef} />. */
  webViewRef: React.RefObject<WebView | null>;
  /** Pass this to <WebView onMessage={handleMessage} />. */
  handleMessage: (event: WebViewMessageEvent) => Promise<void>;
  /** Push a message into the web page outside of the request/response flow. */
  postMessageToWeb: (payload: unknown) => void;
}

const WebViewBridgeContext = createContext<WebViewBridgeContextValue | null>(
  null,
);

/** Hook to consume the bridge from any component under <WebViewBridgeProvider>. */
export function useWebViewBridge(): WebViewBridgeContextValue {
  const ctx = useContext(WebViewBridgeContext);
  if (!ctx) {
    throw new Error(
      "useWebViewBridge() must be called inside a <WebViewBridgeProvider>.",
    );
  }
  return ctx;
}

export function WebViewBridgeProvider({
  config,
  children,
}: {
  /** The allowlist of origins + commands this bridge accepts. Memoize this in your app. */
  config: WebViewBridgeConfig;
  children: React.ReactNode;
}) {
  const webViewRef = useRef<WebView | null>(null);
  const rateLimiter = useMemo(() => createRateLimiter(), []);

  const sendResponse = useCallback((response: BridgeResponse) => {
    webViewRef.current?.injectJavaScript(`
      if (window.__bridgeResolve) {
        window.__bridgeResolve(${JSON.stringify(response)});
      }
      true;
    `);
  }, []);

  const postMessageToWeb = useCallback((payload: unknown) => {
    const serialized = JSON.stringify(payload);
    webViewRef.current?.injectJavaScript(`
      if (window.onNativeMessageReceived) {
        window.onNativeMessageReceived(${serialized});
      } else if (window.postMessage) {
        window.postMessage(${serialized}, "*");
      }
      true;
    `);
  }, []);

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      const originUrl = event.nativeEvent.url;

      // 1. Only accept messages from origins you explicitly trust.
      if (!isTrustedOrigin(originUrl, config.trustedOrigins)) {
        config.onBlocked?.(
          `Blocked message from untrusted origin: ${originUrl}`,
        );
        return;
      }

      // 2. Parse the payload. We accept either a plain object or a
      // JSON-stringified object, since some WebView setups double-encode.
      let parsed: any;
      try {
        const raw =
          typeof event.nativeEvent.data === "string"
            ? JSON.parse(event.nativeEvent.data)
            : event.nativeEvent.data;
        parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        config.onBlocked?.(
          "Received a message that could not be parsed as JSON.",
        );
        return;
      }

      // `command` is the current field name; `type` is accepted too so you
      // can migrate an older web app without changing it on day one.
      const command: string | undefined = parsed.command ?? parsed.type;
      const payload = parsed.payload;
      const requestId: string = parsed.requestId ?? `req_${Date.now()}`;

      if (!command) {
        config.onBlocked?.("Received a message with no command/type field.");
        return;
      }

      // 3. The command must be explicitly registered — this is the allowlist.
      const definition = config.commands[command];
      if (!definition) {
        config.onBlocked?.(`Rejected unknown command: ${command}`);
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
        config.onBlocked?.(`Rate limit exceeded for command: ${command}`);
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

        config.onEvent?.({
          command,
          durationMs: Date.now() - startedAt,
          success: true,
          origin: originUrl,
          requestId,
        });
        sendResponse({ requestId, success: true, data: data ?? null });
      } catch (err) {
        config.onHandlerError?.(command, err);
        sendResponse({
          requestId,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [config, rateLimiter, postMessageToWeb, sendResponse],
  );

  const value = useMemo<WebViewBridgeContextValue>(
    () => ({ webViewRef, handleMessage, postMessageToWeb }),
    [handleMessage, postMessageToWeb],
  );

  return (
    <WebViewBridgeContext.Provider value={value}>
      {children}
    </WebViewBridgeContext.Provider>
  );
}
