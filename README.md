# anttech-expo-webview-bridge

A small, typed bridge for talking between a `react-native-webview` and your Expo / React Native app.

It handles the annoying parts so you don't have to rebuild them in every app:

- ✅ Origin allowlisting (only messages from URLs you trust are processed)
- ✅ A command allowlist with schema checks (`payloadRequired`)
- ✅ Per-command rate limiting
- ✅ Request/response matching (the web page gets a real success/error result back, matched by `requestId`)
- ✅ Hooks for analytics (`onEvent`) and error/blocked logging (`onBlocked`, `onHandlerError`)

It also ships a **web-side client** (`anttech-expo-webview-bridge/web`) and a **standalone example website** (`example/index.html`) so there's a working, copy-pasteable reference for both ends of the bridge, not just the native half.

**What it deliberately does _not_ do:** know anything about your app. There's no built-in QR scanner, no clipboard command, no analytics SDK. Every command is something _you_ register, so the package stays tiny and works for any app.

## Install

```bash
npm install anttech-expo-webview-bridge
# peer deps, if you don't have them already
npm install react-native-webview
```

## 1. Define your commands

Create a config file listing every command your web app is allowed to call, and what native should do for each one.

```ts
// bridge.config.ts
import type { WebViewBridgeConfig } from "anttech-expo-webview-bridge";
import * as Clipboard from "expo-clipboard";
import { Linking } from "react-native";

export function createBridgeConfig(opts: {
  onScanQr: () => void;
  onCall: (phone: string) => void;
}): WebViewBridgeConfig {
  return {
    trustedOrigins: ["https://your-web-app.com", "https://your-web-app.com/*"],
    commands: {
      PING: {
        // handy for an "is the bridge alive" check from the web side
        handler: (payload) => ({
          pong: true,
          receivedAt: Date.now(),
          youSent: payload,
        }),
      },
      SCAN_QR: {
        handler: () => opts.onScanQr(),
      },
      CLIPBOARD: {
        payloadRequired: true,
        handler: async (payload) => {
          await Clipboard.setStringAsync(String(payload));
        },
      },
      CALL_NUMBER: {
        payloadRequired: true,
        rateLimit: 3, // max 3 calls per minute
        handler: async (payload) => {
          opts.onCall(String(payload));
          await Linking.openURL(`tel:${payload}`);
        },
      },
      GET_NATIVE_STORAGE: {
        handler: (_payload, { postMessageToWeb }) => {
          const data = { some: "value" };
          // fire-and-forget push, useful if the web page also listens
          // for unsolicited messages, not just request/response
          postMessageToWeb({ type: "NATIVE_STORAGE", payload: data });
          return data; // also returned as the request/response result
        },
      },
    },
    onEvent: (info) =>
      console.log("[bridge]", info.command, info.durationMs + "ms"),
    onBlocked: (reason) => console.warn("[bridge:blocked]", reason),
    onHandlerError: (command, error) =>
      console.error("[bridge:error]", command, error),
  };
}
```

Any state your handlers need (Zustand/MobX store, `useState`, whatever) can just be closed over — pass setters or store actions in through `opts` like above.

## 2. Wrap your app in the provider

```tsx
// App.tsx
import { WebViewBridgeProvider } from "anttech-expo-webview-bridge";
import { createBridgeConfig } from "./bridge.config";
import { useMemo } from "react";

export default function App() {
  const bridgeConfig = useMemo(
    () =>
      createBridgeConfig({
        onScanQr: () => setIsQrVisible(true),
        onCall: (phone) => console.log("calling", phone),
      }),
    [],
  );

  return (
    <WebViewBridgeProvider config={bridgeConfig}>
      <YourScreen />
    </WebViewBridgeProvider>
  );
}
```

`config` should be memoized (`useMemo`/module-level constant) so the bridge doesn't re-create its rate limiter on every render.

## 3. Wire it into your `<WebView />`

```tsx
// YourScreen.tsx
import WebView from "react-native-webview";
import { useWebViewBridge } from "anttech-expo-webview-bridge";

export function YourScreen() {
  const { webViewRef, handleMessage } = useWebViewBridge();

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: "https://your-web-app.com" }}
      onMessage={handleMessage}
    />
  );
}
```

That's it — `webViewRef` and `handleMessage` are the only two things the WebView needs.

## 4. Call it from the web side

The package ships a small, framework-agnostic client for the web side too — this is your whitelabel entry point, meant to be dropped into any website (React, Vue, Blazor via JS interop, plain HTML) that will run inside the WebView.

```bash
# if your web app is also an npm project
npm install anttech-expo-webview-bridge
```

```ts
import {
  callNative,
  onNativeMessage,
  isInsideBridge,
} from "anttech-expo-webview-bridge/web";

const result = await callNative("CLIPBOARD", "copied text");
if (result.success) {
  console.log("copied!");
} else {
  console.error(result.error);
}

// listen for messages native pushes without being asked
onNativeMessage((payload) => {
  console.log("native pushed:", payload);
});

// handy for showing a "web-only preview" banner when opened in a normal browser tab
if (!isInsideBridge()) {
  console.warn("Not running inside the native app.");
}
```

If your web project doesn't use npm at all (e.g. server-rendered Blazor pages), copy `src/web/bridgeClient.ts` (it has zero dependencies) or the inlined `<script>` block from `example/index.html` straight into your page.

`callNative` never rejects — it always resolves with `{ success, data?, error? }`, and resolves with `success: false` immediately (no hang) if the page isn't running inside the native app, or after a 10s timeout if native never responds. Both are configurable via a third `{ timeoutMs }` argument.

Older web apps that only send `{ type, payload }` (no `command`/`requestId`) still work on the native side — `type` is read as a fallback for `command`, and a `requestId` is generated for them automatically. You just won't get a matched response back unless the web side also sends a `requestId`, which is why the `anttech-expo-webview-bridge/web` client always does.

## Example website

`example/index.html` is a complete, dependency-free demo page — open it directly in a browser, or point your native app's `trustedOrigins`/WebView `source` at wherever you host it. It exercises every command from the config example above (`PING`, `SCAN_QR`, `CLIPBOARD`, `CALL_NUMBER`, `GET_NATIVE_STORAGE`), shows a banner telling you whether it's currently running inside the native app, and logs every request/response (and any unsolicited pushed message) to an on-page console so you can see the full exchange without opening dev tools.

Use it as a starting point: strip out the demo cards, keep the bridge-detection banner and log panel while you're wiring up your real commands, then delete them once you trust the connection.

## Optional injected scripts

Two ready-made scripts are exported for common needs:

```tsx
import {
  BRIDGE_LOG_CAPTURE_SCRIPT,
  BRIDGE_BLOCK_MOTION_SENSORS_SCRIPT,
} from "anttech-expo-webview-bridge";

<WebView
  // ...
  injectedJavaScript={BRIDGE_LOG_CAPTURE_SCRIPT}
  injectedJavaScriptBeforeContentLoaded={BRIDGE_BLOCK_MOTION_SENSORS_SCRIPT}
/>;
```

- `BRIDGE_LOG_CAPTURE_SCRIPT` forwards every `console.log` from the web page to native as a `LOG` command (register a `LOG` command in your config to receive it).
- `BRIDGE_BLOCK_MOTION_SENSORS_SCRIPT` disables motion/orientation sensor APIs before the page loads.

## Publishing this package yourself

```bash
npm run build   # compiles src/ -> dist/
npm login
npm publish --access public
```

## License

MIT
