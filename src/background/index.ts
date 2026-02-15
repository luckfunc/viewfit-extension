import { applyViewportResize } from '../shared/resize';
import { APPLY_RESIZE_MESSAGE } from '../shared/types';
import type { ApplyResizePayload, ResizeInput, ResizeTarget } from '../shared/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isResizeInput(value: unknown): value is ResizeInput {
  if (!isRecord(value)) {
    return false;
  }

  return isFinitePositiveNumber(value.width) && isFinitePositiveNumber(value.height);
}

function isWindowId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isTabId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isResizeTarget(value: unknown): value is ResizeTarget {
  if (!isRecord(value)) {
    return false;
  }

  if (!isWindowId(value.windowId)) {
    return false;
  }

  if (value.tabId !== undefined && !isTabId(value.tabId)) {
    return false;
  }

  return true;
}

function isApplyResizePayload(value: unknown): value is ApplyResizePayload {
  if (!isRecord(value) || !isResizeInput(value.input)) {
    return false;
  }

  if (value.target !== undefined && !isResizeTarget(value.target)) {
    return false;
  }

  return true;
}

chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    if (!isRecord(message) || message.type !== APPLY_RESIZE_MESSAGE) {
      return false;
    }

    if (!isApplyResizePayload(message.payload)) {
      sendResponse({ ok: false, error: 'Invalid resize request payload.' });
      return false;
    }

    const { input, target } = message.payload;

    applyViewportResize(input, target)
      .then((result) => {
        sendResponse({ ok: true, result });
      })
      .catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown resize error';
        sendResponse({ ok: false, error: errorMessage });
      });

    return true;
  },
);
