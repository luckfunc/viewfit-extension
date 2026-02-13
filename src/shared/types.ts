export const MEASURE_VIEWPORT_MESSAGE = 'MEASURE_VIEWPORT';

export type CalibrationMode = 'calibrated' | 'fallback';
export type PopupStatusVariant = 'success' | 'error' | 'info';

export interface SizePreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export interface ResizeInput {
  width: number;
  height: number;
}

export interface ViewportMetrics {
  innerWidth: number;
  innerHeight: number;
  outerWidth: number;
  outerHeight: number;
  devicePixelRatio: number;
}

export interface ResizeResult {
  ok: boolean;
  requested: ResizeInput;
  appliedWindow?: ResizeInput;
  measuredViewport?: ResizeInput;
  mode: CalibrationMode;
  message: string;
}
