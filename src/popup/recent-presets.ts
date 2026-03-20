import type { SizePreset } from '../shared/types';

export const MAX_RECENT_PRESET_ENTRIES = 80;

export function sortPresetsByRecentOrder(
  presets: SizePreset[],
  recentOrder: string[],
): SizePreset[] {
  if (recentOrder.length === 0) {
    return presets;
  }

  const originalIndex = new Map(presets.map((preset, index) => [preset.id, index] as const));
  const rank = (id: string): number => {
    const index = recentOrder.indexOf(id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };

  return [...presets].sort((a, b) => {
    const diff = rank(a.id) - rank(b.id);
    if (diff !== 0) {
      return diff;
    }
    return (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0);
  });
}

export function bumpRecentPresetOrder(recentOrder: string[], presetId: string): string[] {
  const next = [presetId, ...recentOrder.filter((id) => id !== presetId)];
  return next.slice(0, MAX_RECENT_PRESET_ENTRIES);
}
