import type { ResizeInput, SizePreset } from '../shared/types';
import { STORAGE_KEYS } from './constants';
import { normalizeCustomPresets } from './custom-presets';

const STORAGE_KEY_LIST = [
  STORAGE_KEYS.presetId,
  STORAGE_KEYS.customWidth,
  STORAGE_KEYS.customHeight,
  STORAGE_KEYS.customPresets,
] as const;

export interface PopupStorageSnapshot {
  presetId?: string;
  customWidth?: number;
  customHeight?: number;
  customPresets: SizePreset[];
}

function readLocalStorageValue(key: string): unknown {
  if (typeof localStorage === 'undefined') {
    return undefined;
  }

  let rawValue: string | null = null;
  try {
    rawValue = localStorage.getItem(key);
  } catch {
    return undefined;
  }

  if (rawValue === null) {
    return undefined;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return rawValue;
  }
}

function writeToLocalStorage(values: Record<string, unknown>): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) {
        localStorage.removeItem(key);
        continue;
      }

      if (typeof value === 'string') {
        localStorage.setItem(key, value);
        continue;
      }

      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    // localStorage is only a best-effort mirror; chrome.storage remains the source of truth.
  }
}

function getRuntimeErrorMessage(): string | undefined {
  return chrome.runtime.lastError?.message;
}

function readFromStorage(keys: readonly string[]): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (values) => {
      const errorMessage = getRuntimeErrorMessage();
      if (errorMessage) {
        reject(new Error(errorMessage));
        return;
      }

      resolve(values as Record<string, unknown>);
    });
  });
}

function writeToStorage(values: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      const errorMessage = getRuntimeErrorMessage();
      if (errorMessage) {
        reject(new Error(errorMessage));
        return;
      }

      resolve();
    });
  });
}

function readStoredString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function readStoredDimension(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return Math.round(value);
}

export async function loadPopupStorage(): Promise<PopupStorageSnapshot> {
  const localValues: Record<string, unknown> = {
    [STORAGE_KEYS.presetId]: readLocalStorageValue(STORAGE_KEYS.presetId),
    [STORAGE_KEYS.customWidth]: readLocalStorageValue(STORAGE_KEYS.customWidth),
    [STORAGE_KEYS.customHeight]: readLocalStorageValue(STORAGE_KEYS.customHeight),
    [STORAGE_KEYS.customPresets]: readLocalStorageValue(STORAGE_KEYS.customPresets),
  };

  const savedValues = await readFromStorage(STORAGE_KEY_LIST);
  const chromeCustomPresets = normalizeCustomPresets(savedValues[STORAGE_KEYS.customPresets]);
  const localCustomPresets = normalizeCustomPresets(localValues[STORAGE_KEYS.customPresets]);

  return {
    presetId:
      readStoredString(savedValues[STORAGE_KEYS.presetId]) ??
      readStoredString(localValues[STORAGE_KEYS.presetId]),
    customWidth:
      readStoredDimension(savedValues[STORAGE_KEYS.customWidth]) ??
      readStoredDimension(localValues[STORAGE_KEYS.customWidth]),
    customHeight:
      readStoredDimension(savedValues[STORAGE_KEYS.customHeight]) ??
      readStoredDimension(localValues[STORAGE_KEYS.customHeight]),
    customPresets: chromeCustomPresets.length > 0 ? chromeCustomPresets : localCustomPresets,
  };
}

export function savePopupState(presetId: string, size: ResizeInput): Promise<void> {
  const values: Record<string, unknown> = {
    [STORAGE_KEYS.presetId]: presetId,
    [STORAGE_KEYS.customWidth]: size.width,
    [STORAGE_KEYS.customHeight]: size.height,
  };

  writeToLocalStorage(values);
  return writeToStorage(values);
}

export function saveCustomPresets(customPresets: SizePreset[]): Promise<void> {
  const values: Record<string, unknown> = {
    [STORAGE_KEYS.customPresets]: customPresets,
  };

  writeToLocalStorage(values);
  return writeToStorage(values);
}
