import type { SizePreset } from '../shared/types';

export interface PresetLabelParts {
  size: string;
  name: string;
}

export function splitPresetLabel(preset: SizePreset): PresetLabelParts {
  const size = `${preset.width} x ${preset.height}`;
  const prefix = `${size} `;
  if (preset.label.startsWith(prefix)) {
    return { size, name: preset.label.slice(prefix.length) };
  }

  return { size, name: preset.label };
}

export function normalizePresetSearchQuery(value: string): string {
  return value.trim().toLowerCase();
}

export function matchesPresetSearch(preset: SizePreset, query: string): boolean {
  if (!query) {
    return true;
  }

  const parts = splitPresetLabel(preset);
  const searchableText = `${parts.size} ${parts.name} ${preset.label}`.toLowerCase();
  return searchableText.includes(query);
}
