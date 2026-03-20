import {
  MEASURE_VIEWPORT_MESSAGE,
  VIEWPORT_DEBUG_LOG_MESSAGE,
  type ResizeInput,
  type ResizeTarget,
  type ResizeResult,
  type ViewportMetrics,
} from './types';
import { VIEWPORT_RESIZE_DEBUG } from './viewport-resize-debug';

const ERROR_TOLERANCE_PX = 2;
const MAX_CALIBRATION_PASSES = 6;
const MIN_WINDOW_SIZE_PX = 200;
/** Chrome vertical tabs / wide side UI can exceed ~300px; too low → false fallback and wrong viewport. */
const MAX_REASONABLE_RESERVED_WIDTH_PX = 520;
/**
 * Vertical chrome: tabs row + URL + bookmarks + vertical-tab top band can push
 * outerHeight − innerHeight well over 400px (real log: 474). Too low → false fallback.
 * Extremely large values (dock devtools) still calibrate better than raw window resize.
 */
const MAX_REASONABLE_RESERVED_HEIGHT_PX = 720;
const WINDOW_STATE_SETTLE_TIMEOUT_MS = 1600;
const WINDOW_STATE_POLL_INTERVAL_MS = 80;
const VIEWPORT_SETTLE_DELAY_MS = 70;
const MAX_VIEWPORT_MEASURE_ATTEMPTS = 4;

function getRuntimeError(): string | undefined {
  return chrome.runtime.lastError?.message;
}

function sendDebugLog(
  tabId: number | undefined,
  label: string,
  data: Record<string, unknown>,
): void {
  if (!VIEWPORT_RESIZE_DEBUG || tabId === undefined) {
    return;
  }

  chrome.tabs.sendMessage(
    tabId,
    {
      type: VIEWPORT_DEBUG_LOG_MESSAGE,
      payload: { label, ...data },
    },
    () => {
      void chrome.runtime.lastError;
    },
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function clampSize(value: number): number {
  return Math.max(MIN_WINDOW_SIZE_PX, Math.round(value));
}

function isViewportMetrics(value: unknown): value is ViewportMetrics {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const metrics = value as Record<string, unknown>;
  return (
    typeof metrics.innerWidth === 'number' &&
    typeof metrics.innerHeight === 'number' &&
    typeof metrics.outerWidth === 'number' &&
    typeof metrics.outerHeight === 'number' &&
    typeof metrics.devicePixelRatio === 'number'
  );
}

function formatSize(size: ResizeInput): string {
  return `${size.width} x ${size.height}`;
}

function extractWindowSize(
  windowInfo: chrome.windows.Window,
  fallbackSize: ResizeInput,
): ResizeInput {
  return {
    width: windowInfo.width ?? fallbackSize.width,
    height: windowInfo.height ?? fallbackSize.height,
  };
}

function getWindowById(windowId: number): Promise<chrome.windows.Window> {
  return new Promise((resolve, reject) => {
    chrome.windows.get(windowId, {}, (windowInfo) => {
      const errorMessage = getRuntimeError();
      if (errorMessage || !windowInfo) {
        reject(new Error(errorMessage ?? 'Unable to read target browser window.'));
        return;
      }
      resolve(windowInfo);
    });
  });
}

function getLastFocusedWindow(): Promise<chrome.windows.Window> {
  return new Promise((resolve, reject) => {
    chrome.windows.getLastFocused({}, (windowInfo) => {
      const errorMessage = getRuntimeError();
      if (errorMessage || !windowInfo) {
        reject(new Error(errorMessage ?? 'Unable to read last focused browser window.'));
        return;
      }
      resolve(windowInfo);
    });
  });
}

function updateWindow(
  windowId: number,
  updateInfo: chrome.windows.UpdateInfo,
): Promise<chrome.windows.Window> {
  return new Promise((resolve, reject) => {
    chrome.windows.update(windowId, updateInfo, (windowInfo) => {
      const errorMessage = getRuntimeError();
      if (errorMessage || !windowInfo) {
        reject(new Error(errorMessage ?? 'Unable to update window size.'));
        return;
      }
      resolve(windowInfo);
    });
  });
}

function queryActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const errorMessage = getRuntimeError();
      if (errorMessage) {
        reject(new Error(errorMessage));
        return;
      }
      resolve(tabs[0]);
    });
  });
}

function requestViewportMetrics(tabId: number | undefined): Promise<ViewportMetrics | undefined> {
  if (tabId === undefined) {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: MEASURE_VIEWPORT_MESSAGE }, (response: unknown) => {
      if (getRuntimeError()) {
        resolve(undefined);
        return;
      }

      resolve(isViewportMetrics(response) ? response : undefined);
    });
  });
}

function hasSameViewportSize(left: ViewportMetrics, right: ViewportMetrics): boolean {
  return left.innerWidth === right.innerWidth && left.innerHeight === right.innerHeight;
}

async function requestStableViewportMetrics(
  tabId: number | undefined,
): Promise<ViewportMetrics | undefined> {
  if (tabId === undefined) {
    return undefined;
  }

  let lastMetrics: ViewportMetrics | undefined;

  for (let attempt = 0; attempt < MAX_VIEWPORT_MEASURE_ATTEMPTS; attempt += 1) {
    const metrics = await requestViewportMetrics(tabId);
    if (!metrics) {
      if (attempt < MAX_VIEWPORT_MEASURE_ATTEMPTS - 1) {
        await delay(VIEWPORT_SETTLE_DELAY_MS);
      }
      continue;
    }

    if (lastMetrics && hasSameViewportSize(lastMetrics, metrics)) {
      return metrics;
    }

    lastMetrics = metrics;

    if (attempt < MAX_VIEWPORT_MEASURE_ATTEMPTS - 1) {
      await delay(VIEWPORT_SETTLE_DELAY_MS);
    }
  }

  return lastMetrics;
}

async function resolveResizeTarget(
  preferredTarget?: ResizeTarget,
): Promise<{ window: chrome.windows.Window; tabId?: number }> {
  if (preferredTarget) {
    try {
      const preferredWindow = await getWindowById(preferredTarget.windowId);
      return { window: preferredWindow, tabId: preferredTarget.tabId };
    } catch {
      throw new Error('Original target window is no longer available. Reopen popup and retry.');
    }
  }

  const activeTab = await queryActiveTab();

  if (activeTab?.windowId !== undefined) {
    const targetWindow = await getWindowById(activeTab.windowId);
    return { window: targetWindow, tabId: activeTab.id };
  }

  return { window: await getLastFocusedWindow() };
}

async function ensureNormalWindow(
  windowInfo: chrome.windows.Window,
): Promise<chrome.windows.Window> {
  if (windowInfo.id === undefined) {
    throw new Error('Current window ID is unavailable.');
  }

  if (!windowInfo.state || windowInfo.state === 'normal') {
    return windowInfo;
  }

  await updateWindow(windowInfo.id, { state: 'normal' });

  const deadline = Date.now() + WINDOW_STATE_SETTLE_TIMEOUT_MS;
  let latestWindowInfo = await getWindowById(windowInfo.id);

  while (latestWindowInfo.state && latestWindowInfo.state !== 'normal' && Date.now() < deadline) {
    await delay(WINDOW_STATE_POLL_INTERVAL_MS);
    latestWindowInfo = await getWindowById(windowInfo.id);
  }

  if (latestWindowInfo.state && latestWindowInfo.state !== 'normal') {
    throw new Error(
      'Unable to exit fullscreen/maximized state automatically. Please exit it and retry.',
    );
  }

  return latestWindowInfo;
}

function createFallbackResult(
  requested: ResizeInput,
  appliedWindow: ResizeInput,
  reason: string,
): ResizeResult {
  return {
    ok: true,
    requested,
    appliedWindow,
    mode: 'fallback',
    message: `Resize applied in fallback mode: ${reason}.`,
  };
}

async function applyFallbackWindowResize(
  windowId: number,
  requested: ResizeInput,
  reason: string,
  debugTabId?: number,
): Promise<ResizeResult> {
  sendDebugLog(debugTabId, 'fallback:before-api', { requested, reason });
  const fallbackWindow = await updateWindow(windowId, {
    width: requested.width,
    height: requested.height,
  });

  const applied = extractWindowSize(fallbackWindow, requested);
  sendDebugLog(debugTabId, 'fallback:after-api', { appliedWindowFromChromeApi: applied });
  return createFallbackResult(requested, applied, reason);
}

export async function applyViewportResize(
  rawInput: ResizeInput,
  preferredTarget?: ResizeTarget,
): Promise<ResizeResult> {
  const requested: ResizeInput = {
    width: clampSize(rawInput.width),
    height: clampSize(rawInput.height),
  };

  const target = await resolveResizeTarget(preferredTarget);
  const normalizedWindow = await ensureNormalWindow(target.window);

  if (normalizedWindow.id === undefined) {
    throw new Error('Current window ID is unavailable.');
  }

  const windowId = normalizedWindow.id;
  const debugTabId = target.tabId;
  let currentWindowSize = extractWindowSize(normalizedWindow, requested);
  sendDebugLog(debugTabId, 'resize:start', {
    requested,
    windowId,
    chromeWindowFromApi: currentWindowSize,
    tabId: debugTabId ?? null,
  });

  await delay(VIEWPORT_SETTLE_DELAY_MS);
  const firstMetrics = await requestStableViewportMetrics(target.tabId);

  if (!firstMetrics) {
    sendDebugLog(debugTabId, 'resize:no-metrics', { requested });
    return applyFallbackWindowResize(
      windowId,
      requested,
      'viewport metrics unavailable on this page',
      debugTabId,
    );
  }

  // Use page-reported outer* (same coordinate system as inner*). With vertical tabs,
  // chrome.windows width/height can disagree with window.outerWidth/outerHeight, which
  // breaks "API outer + delta" calibration while top tabs often look close enough.
  const reservedWidth = Math.max(0, firstMetrics.outerWidth - firstMetrics.innerWidth);
  const reservedHeight = Math.max(0, firstMetrics.outerHeight - firstMetrics.innerHeight);

  sendDebugLog(debugTabId, 'resize:first-metrics', {
    requested,
    chromeWindowFromApi: currentWindowSize,
    pageInner: { w: firstMetrics.innerWidth, h: firstMetrics.innerHeight },
    pageOuter: { w: firstMetrics.outerWidth, h: firstMetrics.outerHeight },
    apiVsOuterW: currentWindowSize.width - firstMetrics.outerWidth,
    apiVsOuterH: currentWindowSize.height - firstMetrics.outerHeight,
    reservedWidth,
    reservedHeight,
    reservedMax: {
      w: MAX_REASONABLE_RESERVED_WIDTH_PX,
      h: MAX_REASONABLE_RESERVED_HEIGHT_PX,
    },
  });

  if (
    reservedWidth > MAX_REASONABLE_RESERVED_WIDTH_PX ||
    reservedHeight > MAX_REASONABLE_RESERVED_HEIGHT_PX
  ) {
    sendDebugLog(debugTabId, 'resize:reserved-too-large', {
      reservedWidth,
      reservedHeight,
    });
    return applyFallbackWindowResize(
      windowId,
      requested,
      'browser chrome is extremely wide or tall (e.g. docked DevTools, huge side panel); close or undock them for precise viewport sizing',
      debugTabId,
    );
  }

  let outerFromPage: ResizeInput = {
    width: firstMetrics.outerWidth,
    height: firstMetrics.outerHeight,
  };
  let measuredViewport = firstMetrics;
  let lastMeasuredViewport: ResizeInput = {
    width: measuredViewport.innerWidth,
    height: measuredViewport.innerHeight,
  };

  for (let pass = 0; pass < MAX_CALIBRATION_PASSES; pass += 1) {
    const deltaWidth = requested.width - measuredViewport.innerWidth;
    const deltaHeight = requested.height - measuredViewport.innerHeight;

    if (Math.abs(deltaWidth) <= ERROR_TOLERANCE_PX && Math.abs(deltaHeight) <= ERROR_TOLERANCE_PX) {
      sendDebugLog(debugTabId, 'calibrate:within-tolerance', { pass, deltaWidth, deltaHeight });
      break;
    }

    const targetWindowSize: ResizeInput = {
      width: clampSize(outerFromPage.width + deltaWidth),
      height: clampSize(outerFromPage.height + deltaHeight),
    };

    sendDebugLog(debugTabId, 'calibrate:pass', {
      pass,
      deltaWidth,
      deltaHeight,
      outerFromPage,
      targetWindowForChromeApi: targetWindowSize,
    });

    if (
      targetWindowSize.width === outerFromPage.width &&
      targetWindowSize.height === outerFromPage.height
    ) {
      sendDebugLog(debugTabId, 'calibrate:no-api-change', {
        pass,
        targetWindowSize,
        outerFromPage,
      });
      break;
    }

    const updatedWindow = await updateWindow(windowId, targetWindowSize);
    currentWindowSize = extractWindowSize(updatedWindow, targetWindowSize);

    await delay(VIEWPORT_SETTLE_DELAY_MS);

    const nextMetrics = await requestStableViewportMetrics(target.tabId);
    if (!nextMetrics) {
      sendDebugLog(debugTabId, 'calibrate:lost-metrics-after-update', {
        pass,
        apiWindow: currentWindowSize,
      });
      return createFallbackResult(
        requested,
        currentWindowSize,
        'viewport metrics unavailable after resize',
      );
    }

    sendDebugLog(debugTabId, 'calibrate:after-update', {
      pass,
      apiWindowFromChrome: currentWindowSize,
      pageInner: { w: nextMetrics.innerWidth, h: nextMetrics.innerHeight },
      pageOuter: { w: nextMetrics.outerWidth, h: nextMetrics.outerHeight },
    });

    measuredViewport = nextMetrics;
    outerFromPage = {
      width: nextMetrics.outerWidth,
      height: nextMetrics.outerHeight,
    };
    const currentMeasuredViewport: ResizeInput = {
      width: measuredViewport.innerWidth,
      height: measuredViewport.innerHeight,
    };

    if (
      currentMeasuredViewport.width === lastMeasuredViewport.width &&
      currentMeasuredViewport.height === lastMeasuredViewport.height
    ) {
      sendDebugLog(debugTabId, 'calibrate:stuck-same-inner', {
        pass,
        inner: currentMeasuredViewport,
      });
      break;
    }

    lastMeasuredViewport = currentMeasuredViewport;
  }

  const finalViewport: ResizeInput = {
    width: measuredViewport.innerWidth,
    height: measuredViewport.innerHeight,
  };

  const widthDiff = Math.abs(requested.width - finalViewport.width);
  const heightDiff = Math.abs(requested.height - finalViewport.height);
  const withinTolerance = widthDiff <= ERROR_TOLERANCE_PX && heightDiff <= ERROR_TOLERANCE_PX;

  sendDebugLog(debugTabId, 'resize:done-calibrated', {
    requested,
    finalViewport,
    widthDiff,
    heightDiff,
    withinTolerance,
    apiAppliedWindow: currentWindowSize,
    pageOuterFinal: { w: measuredViewport.outerWidth, h: measuredViewport.outerHeight },
  });

  return {
    ok: true,
    requested,
    appliedWindow: currentWindowSize,
    measuredViewport: finalViewport,
    mode: 'calibrated',
    message: withinTolerance
      ? 'Resize success.'
      : `Resize completed with limits. Actual viewport: ${formatSize(finalViewport)}.`,
  };
}
