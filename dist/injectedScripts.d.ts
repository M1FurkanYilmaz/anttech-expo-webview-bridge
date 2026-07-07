/**
 * Forwards every `console.log` on the web page to native as a "LOG" command.
 * Pass this to <WebView injectedJavaScript={...} />. Register a "LOG" command
 * in your bridge config to actually do something with it (write to your
 * crash/analytics tool, filter for known error strings, etc).
 */
export declare const BRIDGE_LOG_CAPTURE_SCRIPT = "\n(function () {\n  const originalLog = console.log;\n  console.log = function (...args) {\n    window.ReactNativeWebView.postMessage(JSON.stringify({ type: \"LOG\", payload: args }));\n    originalLog.apply(console, args);\n  };\n  true;\n})();\n";
/**
 * Disables motion/orientation sensor APIs before the page loads, so the web
 * app can't prompt for (or silently read) accelerometer/gyroscope data.
 * Pass this to <WebView injectedJavaScriptBeforeContentLoaded={...} />.
 */
export declare const BRIDGE_BLOCK_MOTION_SENSORS_SCRIPT = "\n(function () {\n  window.DeviceMotionEvent = undefined;\n  window.DeviceOrientationEvent = undefined;\n  if (typeof DeviceMotionEvent !== \"undefined\") {\n    DeviceMotionEvent.requestPermission = undefined;\n  }\n  if (typeof DeviceOrientationEvent !== \"undefined\") {\n    DeviceOrientationEvent.requestPermission = undefined;\n  }\n  if (navigator.permissions) {\n    const originalQuery = navigator.permissions.query;\n    navigator.permissions.query = function (permissionDesc) {\n      const blocked = [\"accelerometer\", \"gyroscope\", \"magnetometer\", \"motion\", \"orientation\"];\n      if (blocked.includes(permissionDesc.name)) {\n        return Promise.resolve({ state: \"denied\" });\n      }\n      return originalQuery.call(this, permissionDesc);\n    };\n  }\n  true;\n})();\n";
