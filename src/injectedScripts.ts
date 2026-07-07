/**
 * Forwards every `console.log` on the web page to native as a "LOG" command.
 * Pass this to <WebView injectedJavaScript={...} />. Register a "LOG" command
 * in your bridge config to actually do something with it (write to your
 * crash/analytics tool, filter for known error strings, etc).
 */
export const BRIDGE_LOG_CAPTURE_SCRIPT = `
(function () {
  const originalLog = console.log;
  console.log = function (...args) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: "LOG", payload: args }));
    originalLog.apply(console, args);
  };
  true;
})();
`;

/**
 * Disables motion/orientation sensor APIs before the page loads, so the web
 * app can't prompt for (or silently read) accelerometer/gyroscope data.
 * Pass this to <WebView injectedJavaScriptBeforeContentLoaded={...} />.
 */
export const BRIDGE_BLOCK_MOTION_SENSORS_SCRIPT = `
(function () {
  window.DeviceMotionEvent = undefined;
  window.DeviceOrientationEvent = undefined;
  if (typeof DeviceMotionEvent !== "undefined") {
    DeviceMotionEvent.requestPermission = undefined;
  }
  if (typeof DeviceOrientationEvent !== "undefined") {
    DeviceOrientationEvent.requestPermission = undefined;
  }
  if (navigator.permissions) {
    const originalQuery = navigator.permissions.query;
    navigator.permissions.query = function (permissionDesc) {
      const blocked = ["accelerometer", "gyroscope", "magnetometer", "motion", "orientation"];
      if (blocked.includes(permissionDesc.name)) {
        return Promise.resolve({ state: "denied" });
      }
      return originalQuery.call(this, permissionDesc);
    };
  }
  true;
})();
`;
