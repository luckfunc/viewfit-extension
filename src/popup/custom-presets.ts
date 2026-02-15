import type { ResizeInput, SizePreset } from '../shared/types';
import { CUSTOM_PRESET_PREFIX, MIN_VIEWPORT_SIZE_PX } from './constants';

const PRESET_NAME_MAX_LENGTH = 40;
const PRESET_LABEL_MAX_LENGTH = 80;

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function isCustomPresetId(presetId: string): boolean {
  return presetId.startsWith(CUSTOM_PRESET_PREFIX);
}

export function normalizePresetName(rawName: string): string {
  return rawName.trim().replace(/\s+/g, ' ').slice(0, PRESET_NAME_MAX_LENGTH);
}

export function buildCustomPresetLabel(size: ResizeInput, customName: string): string {
  const suffix = customName || 'Custom';
  return `${size.width} x ${size.height} ${suffix}`;
}

export function createCustomPresetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${CUSTOM_PRESET_PREFIX}${crypto.randomUUID()}`;
  }

  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `${CUSTOM_PRESET_PREFIX}${Date.now().toString(36)}-${randomSuffix}`;
}

function isValidCustomPreset(value: unknown): value is SizePreset {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const preset = value as Record<string, unknown>;
  return (
    typeof preset.id === 'string' &&
    isCustomPresetId(preset.id) &&
    typeof preset.label === 'string' &&
    isPositiveNumber(preset.width) &&
    isPositiveNumber(preset.height)
  );
}

export function normalizeCustomPresets(value: unknown): SizePreset[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const knownIds = new Set<string>();
  const normalized: SizePreset[] = [];

  for (const item of value) {
    if (!isValidCustomPreset(item)) {
      continue;
    }

    const normalizedPreset: SizePreset = {
      id: item.id,
      label:
        item.label.trim().slice(0, PRESET_LABEL_MAX_LENGTH) ||
        `${Math.round(item.width)} x ${Math.round(item.height)} Custom`,
      width: Math.max(MIN_VIEWPORT_SIZE_PX, Math.round(item.width)),
      height: Math.max(MIN_VIEWPORT_SIZE_PX, Math.round(item.height)),
    };

    if (knownIds.has(normalizedPreset.id)) {
      continue;
    }

    knownIds.add(normalizedPreset.id);
    normalized.push(normalizedPreset);
  }

  return normalized;
}
