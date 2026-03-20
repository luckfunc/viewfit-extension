import { DEFAULT_PRESET_ID, PRESETS, findPresetById } from '../shared/presets';
import { APPLY_RESIZE_MESSAGE } from '../shared/types';
import type {
  ApplyResizeResponse,
  ResizeInput,
  ResizeResult,
  ResizeTarget,
  SizePreset,
} from '../shared/types';
import { MIN_VIEWPORT_SIZE_PX } from './constants';
import {
  buildCustomPresetLabel,
  createCustomPresetId,
  normalizePresetName,
} from './custom-presets';
import { getPopupElements } from './dom';
import { splitPresetLabel } from './preset-utils';
import { bumpRecentPresetOrder, sortPresetsByRecentOrder } from './recent-presets';
import {
  loadPopupStorage,
  saveCustomPresets,
  savePopupState,
  saveRecentPresetOrder,
} from './storage';

interface PopupState {
  customPresets: SizePreset[];
  recentPresetOrder: string[];
}

const elements = getPopupElements();

const state: PopupState = {
  customPresets: [],
  recentPresetOrder: [],
};

let viewportResizeInFlight = false;

function clearStatus(): void {
  elements.statusElement.textContent = '';
  elements.statusElement.classList.remove('status--success', 'status--error', 'status--info');
  elements.statusElement.classList.add('status--hidden');
  elements.statusElement.setAttribute('aria-hidden', 'true');
}

function setErrorStatus(message: string): void {
  elements.statusElement.classList.remove('status--hidden', 'status--success', 'status--info');
  elements.statusElement.classList.add('status--error');
  elements.statusElement.textContent = message;
  elements.statusElement.removeAttribute('aria-hidden');
}

function parsePositiveInteger(value: string, fallbackValue: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackValue;
  }

  return parsed;
}

function getDefaultPreset(): SizePreset {
  const preset = findPresetById(DEFAULT_PRESET_ID) ?? PRESETS[0];
  if (!preset) {
    throw new Error('No built-in presets configured.');
  }

  return preset;
}

function findAnyPresetById(presetId: string): SizePreset | undefined {
  return findPresetById(presetId) ?? state.customPresets.find((preset) => preset.id === presetId);
}

function pruneRecentPresetOrder(ids: string[]): string[] {
  const valid = new Set([
    ...PRESETS.map((preset) => preset.id),
    ...state.customPresets.map((preset) => preset.id),
  ]);
  return ids.filter((id) => valid.has(id));
}

function getSelectedPresetOrDefault(): SizePreset {
  return findAnyPresetById(elements.presetSelect.value) ?? getDefaultPreset();
}

function getInputSize(): ResizeInput {
  const fallbackPreset = getSelectedPresetOrDefault();
  return {
    width: parsePositiveInteger(elements.widthInput.value, fallbackPreset.width),
    height: parsePositiveInteger(elements.heightInput.value, fallbackPreset.height),
  };
}

function readValidatedCustomPresetSize(): ResizeInput | undefined {
  const hasValidWidth = elements.widthInput.reportValidity();
  const hasValidHeight = elements.heightInput.reportValidity();
  if (!hasValidWidth || !hasValidHeight) {
    return undefined;
  }

  const width = Math.round(elements.widthInput.valueAsNumber);
  const height = Math.round(elements.heightInput.valueAsNumber);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return undefined;
  }

  if (width < MIN_VIEWPORT_SIZE_PX || height < MIN_VIEWPORT_SIZE_PX) {
    return undefined;
  }

  return { width, height };
}

function scrollSelectedPresetIntoView(): void {
  const selected = elements.presetMenu.querySelector<HTMLElement>('.preset-option.is-active');
  selected?.scrollIntoView({ block: 'nearest' });
}

function createPresetMenuGroup(
  label: string | null,
  presets: SizePreset[],
  selectedId: string,
): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'preset-group';

  const list = document.createElement('div');
  list.className = 'preset-group-list';

  for (const preset of presets) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'preset-option';
    option.dataset.presetId = preset.id;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', String(preset.id === selectedId));

    if (preset.id === selectedId) {
      option.classList.add('is-active');
    }

    const parts = splitPresetLabel(preset);

    const size = document.createElement('span');
    size.className = 'preset-option-size mono';
    size.textContent = parts.size;

    const name = document.createElement('span');
    name.className = 'preset-option-name';
    name.textContent = parts.name || 'Preset';

    option.append(size, name);
    list.appendChild(option);
  }

  if (label) {
    const title = document.createElement('div');
    title.className = 'preset-group-title';
    title.textContent = label;
    group.append(title, list);
  } else {
    group.append(list);
  }

  return group;
}

function getAllPresetsSorted(): SizePreset[] {
  return sortPresetsByRecentOrder([...PRESETS, ...state.customPresets], state.recentPresetOrder);
}

function renderPresetList(selectedPresetId: string): void {
  elements.presetMenu.textContent = '';

  elements.presetMenu.appendChild(
    createPresetMenuGroup(null, getAllPresetsSorted(), selectedPresetId),
  );

  scrollSelectedPresetIntoView();
}

function renderPresetOptions(selectedPresetId?: string): void {
  elements.presetSelect.textContent = '';

  for (const preset of getAllPresetsSorted()) {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.label;
    elements.presetSelect.appendChild(option);
  }

  const fallbackPreset = getDefaultPreset();
  const resolvedSelection =
    selectedPresetId && findAnyPresetById(selectedPresetId) ? selectedPresetId : fallbackPreset.id;

  elements.presetSelect.value = resolvedSelection;
  renderPresetList(resolvedSelection);
}

function applyPresetToInputs(preset: SizePreset): void {
  elements.widthInput.value = String(preset.width);
  elements.heightInput.value = String(preset.height);
}

function reportStorageError(error: unknown): void {
  const message = error instanceof Error ? error.message : 'Unexpected storage error.';
  setErrorStatus(`Storage error: ${message}`);
}

function touchRecentPreset(presetId: string): void {
  state.recentPresetOrder = bumpRecentPresetOrder(state.recentPresetOrder, presetId);
  void saveRecentPresetOrder(state.recentPresetOrder).catch(reportStorageError);
}

function persistState(size: ResizeInput): void {
  void savePopupState(elements.presetSelect.value, size).catch(reportStorageError);
}

function renderResult(_result: ResizeResult): void {
  clearStatus();
}

function getRuntimeErrorMessage(): string | undefined {
  return chrome.runtime.lastError?.message;
}

function queryPopupTarget(): Promise<ResizeTarget> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const queryError = getRuntimeErrorMessage();
      if (queryError) {
        reject(new Error(queryError));
        return;
      }

      const activeTab = tabs[0];
      if (activeTab?.windowId !== undefined) {
        resolve({ windowId: activeTab.windowId, tabId: activeTab.id });
        return;
      }

      chrome.windows.getCurrent({}, (windowInfo) => {
        const windowError = getRuntimeErrorMessage();
        if (windowError || windowInfo.id === undefined) {
          reject(new Error(windowError ?? 'Unable to resolve target browser window.'));
          return;
        }

        resolve({ windowId: windowInfo.id });
      });
    });
  });
}

function isApplyResizeResponse(value: unknown): value is ApplyResizeResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const response = value as Record<string, unknown>;
  if (response.ok === true) {
    return typeof response.result === 'object' && response.result !== null;
  }

  if (response.ok === false) {
    return typeof response.error === 'string';
  }

  return false;
}

function requestBackgroundResize(input: ResizeInput, target: ResizeTarget): Promise<ResizeResult> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: APPLY_RESIZE_MESSAGE, payload: { input, target } },
      (response: unknown) => {
        const errorMessage = getRuntimeErrorMessage();
        if (errorMessage) {
          reject(new Error(errorMessage));
          return;
        }

        if (!isApplyResizeResponse(response)) {
          reject(new Error('Unexpected resize response.'));
          return;
        }

        if (response.ok) {
          resolve(response.result);
          return;
        }

        reject(new Error(response.error));
      },
    );
  });
}

async function loadInitialState(): Promise<void> {
  const defaultPreset = getDefaultPreset();

  try {
    const savedValues = await loadPopupStorage();
    state.customPresets = savedValues.customPresets;
    state.recentPresetOrder = pruneRecentPresetOrder(savedValues.recentPresetOrder);

    const savedPresetId = savedValues.presetId ?? defaultPreset.id;
    renderPresetOptions(savedPresetId);

    const selectedPreset = findAnyPresetById(elements.presetSelect.value) ?? defaultPreset;
    const savedWidth = savedValues.customWidth ?? selectedPreset.width;
    const savedHeight = savedValues.customHeight ?? selectedPreset.height;

    elements.widthInput.value = String(savedWidth);
    elements.heightInput.value = String(savedHeight);
  } catch (error) {
    renderPresetOptions(defaultPreset.id);
    applyPresetToInputs(defaultPreset);
    reportStorageError(error);
  }
}

function syncPresetSelection(preset: SizePreset): void {
  touchRecentPreset(preset.id);
  elements.presetSelect.value = preset.id;
  applyPresetToInputs(preset);
  renderPresetList(preset.id);
  persistState({ width: preset.width, height: preset.height });
}

async function handleAddPreset(): Promise<void> {
  const size = readValidatedCustomPresetSize();
  if (!size) {
    setErrorStatus(
      `Width and height must be valid numbers and at least ${MIN_VIEWPORT_SIZE_PX}px.`,
    );
    return;
  }

  elements.addPresetButton.disabled = true;

  try {
    const normalizedName = normalizePresetName(elements.presetNameInput.value);
    const nextLabel = buildCustomPresetLabel(size, normalizedName);

    const duplicate = state.customPresets.find(
      (preset) =>
        preset.width === size.width &&
        preset.height === size.height &&
        preset.label.toLowerCase() === nextLabel.toLowerCase(),
    );

    if (duplicate) {
      touchRecentPreset(duplicate.id);
      renderPresetOptions(duplicate.id);
      applyPresetToInputs(duplicate);
      await savePopupState(duplicate.id, size);
      clearStatus();
      return;
    }

    const customPreset: SizePreset = {
      id: createCustomPresetId(),
      label: nextLabel,
      width: size.width,
      height: size.height,
    };

    const nextCustomPresets = [...state.customPresets, customPreset];
    await saveCustomPresets(nextCustomPresets);
    state.customPresets = nextCustomPresets;
    touchRecentPreset(customPreset.id);
    renderPresetOptions(customPreset.id);
    applyPresetToInputs(customPreset);
    await savePopupState(customPreset.id, size);

    elements.presetNameInput.value = '';
    clearStatus();
  } finally {
    elements.addPresetButton.disabled = false;
  }
}

function handlePresetMenuClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const option = target.closest<HTMLButtonElement>('.preset-option');
  if (!option) {
    return;
  }

  const presetId = option.dataset.presetId;
  if (!presetId) {
    return;
  }

  const preset = findAnyPresetById(presetId);
  if (!preset) {
    return;
  }

  syncPresetSelection(preset);
  void applyViewportResize();
}

function bindPresetListEvents(): void {
  elements.presetMenu.addEventListener('click', handlePresetMenuClick);
}

async function applyViewportResize(): Promise<void> {
  if (viewportResizeInFlight) {
    return;
  }

  const requestedSize = getInputSize();
  elements.widthInput.value = String(requestedSize.width);
  elements.heightInput.value = String(requestedSize.height);

  viewportResizeInFlight = true;

  try {
    const target = await queryPopupTarget();
    const result = await requestBackgroundResize(requestedSize, target);
    await savePopupState(elements.presetSelect.value, requestedSize);
    renderResult(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected resize error.';
    setErrorStatus(message);
  } finally {
    viewportResizeInFlight = false;
  }
}

async function initPopup(): Promise<void> {
  elements.formElement.addEventListener('submit', (event) => {
    event.preventDefault();
  });

  await loadInitialState();
  bindPresetListEvents();

  elements.addPresetButton.addEventListener('click', () => {
    void handleAddPreset().catch((error) => {
      reportStorageError(error);
    });
  });
}

void initPopup().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unexpected popup initialization error.';
  setErrorStatus(message);
});
