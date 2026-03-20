/**
 * Content scripts must not use `import` — Chrome injects them as classic scripts.
 * Keep message strings in sync with `src/shared/types.ts` and
 * `VIEWPORT_RESIZE_DEBUG` with `src/shared/viewport-resize-debug.ts`.
 */
const MEASURE_VIEWPORT_MESSAGE = 'MEASURE_VIEWPORT';
const VIEWPORT_DEBUG_LOG_MESSAGE = 'VIEWPORT_RESIZER_DEBUG_LOG';
const VIEWPORT_RESIZE_DEBUG = true;

function snapshotViewportForLog(): Record<string, unknown> {
  const vv = window.visualViewport;
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight,
    devicePixelRatio: window.devicePixelRatio,
    documentElementClientWidth: document.documentElement?.clientWidth,
    documentElementClientHeight: document.documentElement?.clientHeight,
    visualViewport: vv
      ? {
          width: vv.width,
          height: vv.height,
          scale: vv.scale,
          offsetLeft: vv.offsetLeft,
          offsetTop: vv.offsetTop,
        }
      : null,
    url: window.location.href.split(/[?#]/)[0],
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) {
    return false;
  }

  if (message.type === VIEWPORT_DEBUG_LOG_MESSAGE) {
    if (VIEWPORT_RESIZE_DEBUG) {
      console.info('[ViewFit]', message.payload);
    }
    return false;
  }

  if (message.type !== MEASURE_VIEWPORT_MESSAGE) {
    return false;
  }

  const metrics = {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight,
    devicePixelRatio: window.devicePixelRatio,
  };

  if (VIEWPORT_RESIZE_DEBUG) {
    console.info('[ViewFit] measure', snapshotViewportForLog());
  }

  sendResponse(metrics);

  return false;
});
