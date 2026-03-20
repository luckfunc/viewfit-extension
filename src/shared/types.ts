export const MEASURE_VIEWPORT_MESSAGE = 'MEASURE_VIEWPORT';
export const APPLY_RESIZE_MESSAGE = 'APPLY_RESIZE';
/** Page console: calibration steps from resize (content script prints). */
export const VIEWPORT_DEBUG_LOG_MESSAGE = 'VIEWPORT_RESIZER_DEBUG_LOG';

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

export interface ResizeTarget {
  windowId: number;
  tabId?: number;
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

export interface ApplyResizePayload {
  input: ResizeInput;
  target?: ResizeTarget;
}

export interface ApplyResizeSuccessResponse {
  ok: true;
  result: ResizeResult;
}

export interface ApplyResizeErrorResponse {
  ok: false;
  error: string;
}

export type ApplyResizeResponse = ApplyResizeSuccessResponse | ApplyResizeErrorResponse;
