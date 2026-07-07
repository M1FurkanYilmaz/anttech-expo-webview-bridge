import React from "react";
import type WebView from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview";
import type { WebViewBridgeConfig } from "./types";
interface WebViewBridgeContextValue {
    /** Pass this to <WebView ref={webViewRef} />. */
    webViewRef: React.RefObject<WebView | null>;
    /** Pass this to <WebView onMessage={handleMessage} />. */
    handleMessage: (event: WebViewMessageEvent) => Promise<void>;
    /** Push a message into the web page outside of the request/response flow. */
    postMessageToWeb: (payload: unknown) => void;
}
/** Hook to consume the bridge from any component under <WebViewBridgeProvider>. */
export declare function useWebViewBridge(): WebViewBridgeContextValue;
export declare function WebViewBridgeProvider({ config, children, }: {
    /** The allowlist of origins + commands this bridge accepts. Memoize this in your app. */
    config: WebViewBridgeConfig;
    children: React.ReactNode;
}): React.JSX.Element;
export {};
