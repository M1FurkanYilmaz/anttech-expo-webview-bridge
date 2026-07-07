import type { RefObject } from "react";
import type WebView from "react-native-webview";

/**
 * Everything a command handler gets access to when it runs.
 */
export interface BridgeHandlerContext {
  /** Ref to the underlying WebView, in case a handler needs to inject JS itself. */
  webViewRef: RefObject<WebView | null>;
  /** The requestId sent by the web page, echoed back in the response. */
  requestId: string;
  /** The URL the message came from (already verified against trustedOrigins). */
  originUrl: string;
  /** Fire-and-forget a message to the web page (no response expected). */
  postMessageToWeb: (payload: unknown) => void;
}

/**
 * A handler can return data synchronously, return a Promise, or return nothing.
 * Throw an Error (or reject) to send a failure response back to the web page.
 */
export type CommandHandler = (
  payload: any,
  ctx: BridgeHandlerContext,
) => any | Promise<any>;

export interface CommandDefinition {
  /** Reject the call before it reaches your handler if no payload was sent. Default: false. */
  payloadRequired?: boolean;
  /** Max calls allowed per rolling 60s window for this command. Omit for unlimited. */
  rateLimit?: number;
  /** The function that performs the native action. */
  handler: CommandHandler;
}

export interface BridgeResponse {
  requestId: string;
  success: boolean;
  data?: any;
  error?: string;
}

export interface BridgeEventInfo {
  command: string;
  durationMs: number;
  success: boolean;
  origin: string;
  requestId: string;
}

export interface WebViewBridgeConfig {
  /**
   * Origins allowed to send messages to native. Supports exact matches
   * ("https://example.com") and simple wildcard prefixes ("https://example.com/*",
   * "https://*.example.com").
   */
  trustedOrigins: string[];
  /** The full allowlist of commands the web page is permitted to call, keyed by command name. */
  commands: Record<string, CommandDefinition>;
  /** Called after a command finishes successfully. Good spot for analytics. */
  onEvent?: (info: BridgeEventInfo) => void;
  /** Called whenever a message is rejected: untrusted origin, unknown command, missing payload, or rate limited. */
  onBlocked?: (reason: string) => void;
  /** Called when a handler throws. */
  onHandlerError?: (command: string, error: unknown) => void;
}
