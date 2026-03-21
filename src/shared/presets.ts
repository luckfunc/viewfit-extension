import type { SizePreset } from './types';

export const PRESETS: SizePreset[] = [
  { id: 'mobile-320x568', label: '320 x 568 iPhone SE (1st generation)', width: 320, height: 568 },
  { id: 'mobile-360x640', label: '360 x 640 Small Android phone', width: 360, height: 640 },
  { id: 'mobile-375x667', label: '375 x 667 iPhone SE / 8', width: 375, height: 667 },
  { id: 'mobile-390x844', label: '390 x 844 iPhone 12 / 13 / 14', width: 390, height: 844 },
  { id: 'mobile-393x852', label: '393 x 852 Pixel 7', width: 393, height: 852 },
  { id: 'mobile-412x915', label: '412 x 915 Large Android phone', width: 412, height: 915 },
  { id: 'mobile-414x896', label: '414 x 896 iPhone XR / 11', width: 414, height: 896 },
  { id: 'mobile-430x932', label: '430 x 932 iPhone 14 Pro Max', width: 430, height: 932 },
  { id: 'tablet-600x960', label: '600 x 960 Nexus 7 (2013)', width: 600, height: 960 },
  { id: 'tablet-768x1024', label: '768 x 1024 iPad mini', width: 768, height: 1024 },
  { id: 'tablet-800x1280', label: '800 x 1280 Android tablet', width: 800, height: 1280 },
  { id: 'tablet-820x1180', label: '820 x 1180 iPad Air', width: 820, height: 1180 },
  { id: 'tablet-834x1194', label: '834 x 1194 iPad Pro 11-inch', width: 834, height: 1194 },
  { id: 'tablet-1024x1366', label: '1024 x 1366 iPad Pro 12.9-inch', width: 1024, height: 1366 },
  { id: 'desktop-1024x768', label: '1024 x 768 Small desktop', width: 1024, height: 768 },
  { id: 'desktop-1280x720', label: '1280 x 720 Compact laptop', width: 1280, height: 720 },
  { id: 'desktop-1280x800', label: '1280 x 800 Standard laptop', width: 1280, height: 800 },
  { id: 'desktop-1366x768', label: '1366 x 768 Laptop', width: 1366, height: 768 },
  { id: 'desktop-1440x900', label: '1440 x 900 Wide laptop', width: 1440, height: 900 },
  { id: 'desktop-1536x864', label: '1536 x 864 Scaled desktop', width: 1536, height: 864 },
  { id: 'desktop-1600x900', label: '1600 x 900 Large laptop', width: 1600, height: 900 },
  { id: 'desktop-1680x1050', label: '1680 x 1050 Widescreen desktop', width: 1680, height: 1050 },
  { id: 'desktop-1920x1080', label: '1920 x 1080 Full HD desktop', width: 1920, height: 1080 },
  { id: 'desktop-2560x1440', label: '2560 x 1440 QHD desktop', width: 2560, height: 1440 },
];

export const DEFAULT_PRESET_ID = 'desktop-1366x768';

export function findPresetById(id: string): SizePreset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}
