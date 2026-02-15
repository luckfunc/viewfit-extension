import {
  MEASURE_VIEWPORT_MESSAGE,
  type ResizeInput,
  type ResizeTarget,
  type ResizeResult,
  type ViewportMetrics,
} from './types';

const ERROR_TOLERANCE_PX = 2;
const MAX_CALIBRATION_PASSES = 6;
const MIN_WINDOW_SIZE_PX = 200;
const MAX_REASONABLE_RESERVED_WIDTH_PX = 220;
const MAX_REASONABLE_RESERVED_HEIGHT_PX = 260;
const WINDOW_STATE_SETTLE_TIMEOUT_MS = 1600;
const WINDOW_STATE_POLL_INTERVAL_MS = 80;
const VIEWPORT_SETTLE_DELAY_MS = 70;
const MAX_VIEWPORT_MEASURE_ATTEMPTS = 4;

function getRuntimeError(): string | undefined {
  return chrome.runtime.lastError?.message;
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
): Promise<ResizeResult> {
  const fallbackWindow = await updateWindow(windowId, {
    width: requested.width,
    height: requested.height,
  });

  return createFallbackResult(requested, extractWindowSize(fallbackWindow, requested), reason);
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
  let currentWindowSize = extractWindowSize(normalizedWindow, requested);
  await delay(VIEWPORT_SETTLE_DELAY_MS);
  const firstMetrics = await requestStableViewportMetrics(target.tabId);

  if (!firstMetrics) {
    return applyFallbackWindowResize(
      windowId,
      requested,
      'viewport metrics unavailable on this page',
    );
  }

  const reservedWidth = Math.max(0, currentWindowSize.width - firstMetrics.innerWidth);
  const reservedHeight = Math.max(0, currentWindowSize.height - firstMetrics.innerHeight);

  if (
    reservedWidth > MAX_REASONABLE_RESERVED_WIDTH_PX ||
    reservedHeight > MAX_REASONABLE_RESERVED_HEIGHT_PX
  ) {
    return applyFallbackWindowResize(
      windowId,
      requested,
      'detected large docked panel/DevTools offset; close docked panels for precise viewport sizing',
    );
  }

  let measuredViewport = firstMetrics;
  let lastMeasuredViewport: ResizeInput = {
    width: measuredViewport.innerWidth,
    height: measuredViewport.innerHeight,
  };

  for (let pass = 0; pass < MAX_CALIBRATION_PASSES; pass += 1) {
    const deltaWidth = requested.width - measuredViewport.innerWidth;
    const deltaHeight = requested.height - measuredViewport.innerHeight;

    if (Math.abs(deltaWidth) <= ERROR_TOLERANCE_PX && Math.abs(deltaHeight) <= ERROR_TOLERANCE_PX) {
      break;
    }

    const targetWindowSize: ResizeInput = {
      width: clampSize(currentWindowSize.width + deltaWidth),
      height: clampSize(currentWindowSize.height + deltaHeight),
    };

    if (
      targetWindowSize.width === currentWindowSize.width &&
      targetWindowSize.height === currentWindowSize.height
    ) {
      break;
    }

    const updatedWindow = await updateWindow(windowId, targetWindowSize);
    currentWindowSize = extractWindowSize(updatedWindow, targetWindowSize);

    const nextMetrics = await requestStableViewportMetrics(target.tabId);
    if (!nextMetrics) {
      return createFallbackResult(
        requested,
        currentWindowSize,
        'viewport metrics unavailable after resize',
      );
    }

    measuredViewport = nextMetrics;
    const currentMeasuredViewport: ResizeInput = {
      width: measuredViewport.innerWidth,
      height: measuredViewport.innerHeight,
    };

    if (
      currentMeasuredViewport.width === lastMeasuredViewport.width &&
      currentMeasuredViewport.height === lastMeasuredViewport.height
    ) {
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
