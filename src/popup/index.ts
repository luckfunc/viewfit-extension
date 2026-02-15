import { DEFAULT_PRESET_ID, PRESETS, findPresetById } from '../shared/presets';
import { APPLY_RESIZE_MESSAGE } from '../shared/types';
import type {
  ApplyResizeResponse,
  PopupStatusVariant,
  ResizeInput,
  ResizeResult,
  ResizeTarget,
  SizePreset,
} from '../shared/types';
import { MIN_VIEWPORT_SIZE_PX } from './constants';
import {
  buildCustomPresetLabel,
  createCustomPresetId,
  isCustomPresetId,
  normalizePresetName,
} from './custom-presets';
import { getPopupElements } from './dom';
import { matchesPresetSearch, normalizePresetSearchQuery, splitPresetLabel } from './preset-utils';
import { loadPopupStorage, saveCustomPresets, savePopupState } from './storage';

interface PopupState {
  customPresets: SizePreset[];
  isPresetMenuOpen: boolean;
  presetSearchQuery: string;
}

const elements = getPopupElements();

const state: PopupState = {
  customPresets: [],
  isPresetMenuOpen: false,
  presetSearchQuery: '',
};

function setSubtitle(text: string): void {
  elements.subtitleElement.textContent = text;
}

function setStatus(variant: PopupStatusVariant, message: string): void {
  elements.statusElement.classList.remove('status--success', 'status--error', 'status--info');
  elements.statusElement.classList.add(`status--${variant}`);
  elements.statusElement.textContent = message;
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

function updateRemovePresetButtonState(selectedPresetId: string): void {
  elements.removePresetButton.disabled = !isCustomPresetId(selectedPresetId);
}

function appendPresetOption(parent: HTMLOptGroupElement, preset: SizePreset): void {
  const option = document.createElement('option');
  option.value = preset.id;
  option.textContent = preset.label;
  parent.appendChild(option);
}

function setPresetTriggerDisplay(preset: SizePreset): void {
  const label = splitPresetLabel(preset);
  elements.presetTriggerSize.textContent = label.size;
  elements.presetTriggerName.textContent = label.name || 'Preset';
}

function getSelectedMenuOption(): HTMLButtonElement | null {
  const options = elements.presetMenu.querySelectorAll<HTMLButtonElement>('.preset-option');
  for (const option of options) {
    if (option.dataset.presetId === elements.presetSelect.value) {
      return option;
    }
  }

  return null;
}

function focusPresetSearchInput(): void {
  const searchInput = elements.presetMenu.querySelector<HTMLInputElement>('.preset-search-input');
  if (!searchInput) {
    return;
  }

  searchInput.focus();
  const cursorPosition = searchInput.value.length;
  searchInput.setSelectionRange(cursorPosition, cursorPosition);
}

function createPresetSearchControl(selectedPresetId: string): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'preset-search';

  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'preset-search-input';
  input.placeholder = 'Search size or name';
  input.value = state.presetSearchQuery;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Search presets');

  input.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement;
    state.presetSearchQuery = target.value;
    renderPresetMenu(selectedPresetId, true);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const firstOption = elements.presetMenu.querySelector<HTMLButtonElement>('.preset-option');
      firstOption?.focus();
      return;
    }

    if (event.key === 'Escape') {
      event.stopPropagation();
      if (!state.presetSearchQuery) {
        setPresetMenuOpen(false);
        elements.presetTrigger.focus();
        return;
      }

      state.presetSearchQuery = '';
      renderPresetMenu(selectedPresetId, true);
    }
  });

  wrapper.appendChild(input);
  return wrapper;
}

function setPresetMenuOpen(open: boolean): void {
  if (state.isPresetMenuOpen === open) {
    return;
  }

  state.isPresetMenuOpen = open;
  elements.presetDropdown.dataset.open = open ? 'true' : 'false';
  elements.presetTrigger.setAttribute('aria-expanded', String(open));

  if (open) {
    focusPresetSearchInput();
    const selectedOption = getSelectedMenuOption();
    selectedOption?.scrollIntoView({ block: 'nearest' });
    return;
  }

  if (!state.presetSearchQuery) {
    return;
  }

  state.presetSearchQuery = '';
  renderPresetMenu(elements.presetSelect.value);
}

function createPresetMenuGroup(
  label: string,
  presets: SizePreset[],
  selectedId: string,
): HTMLDivElement {
  const group = document.createElement('div');
  group.className = 'preset-group';

  const title = document.createElement('div');
  title.className = 'preset-group-title';
  title.textContent = label;

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

  group.append(title, list);
  return group;
}

function renderPresetMenu(selectedPresetId: string, keepSearchFocus = false): void {
  const normalizedQuery = normalizePresetSearchQuery(state.presetSearchQuery);
  const filteredBuiltIns = PRESETS.filter((preset) => matchesPresetSearch(preset, normalizedQuery));
  const filteredCustoms = state.customPresets.filter((preset) =>
    matchesPresetSearch(preset, normalizedQuery),
  );

  elements.presetMenu.textContent = '';
  elements.presetMenu.appendChild(createPresetSearchControl(selectedPresetId));

  if (filteredBuiltIns.length > 0) {
    elements.presetMenu.appendChild(
      createPresetMenuGroup('Built-in', filteredBuiltIns, selectedPresetId),
    );
  }

  if (filteredCustoms.length > 0) {
    elements.presetMenu.appendChild(
      createPresetMenuGroup('Custom', filteredCustoms, selectedPresetId),
    );
  }

  if (filteredBuiltIns.length === 0 && filteredCustoms.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'preset-empty';
    emptyState.textContent = 'No preset matches your search.';
    elements.presetMenu.appendChild(emptyState);
  }

  const selectedPreset = findAnyPresetById(selectedPresetId);
  if (selectedPreset) {
    setPresetTriggerDisplay(selectedPreset);
  }

  if (keepSearchFocus && state.isPresetMenuOpen) {
    focusPresetSearchInput();
  }
}

function renderPresetOptions(selectedPresetId?: string): void {
  elements.presetSelect.textContent = '';

  const builtInGroup = document.createElement('optgroup');
  builtInGroup.label = 'Built-in';
  PRESETS.forEach((preset) => {
    appendPresetOption(builtInGroup, preset);
  });
  elements.presetSelect.appendChild(builtInGroup);

  if (state.customPresets.length > 0) {
    const customGroup = document.createElement('optgroup');
    customGroup.label = 'Custom';
    state.customPresets.forEach((preset) => {
      appendPresetOption(customGroup, preset);
    });
    elements.presetSelect.appendChild(customGroup);
  }

  const fallbackPreset = getDefaultPreset();
  const resolvedSelection =
    selectedPresetId && findAnyPresetById(selectedPresetId) ? selectedPresetId : fallbackPreset.id;

  elements.presetSelect.value = resolvedSelection;
  updateRemovePresetButtonState(resolvedSelection);
  renderPresetMenu(resolvedSelection);
}

function applyPresetToInputs(preset: SizePreset): void {
  elements.widthInput.value = String(preset.width);
  elements.heightInput.value = String(preset.height);
}

function reportStorageError(error: unknown): void {
  const message = error instanceof Error ? error.message : 'Unexpected storage error.';
  setStatus('error', `Storage error: ${message}`);
}

function persistState(size: ResizeInput): void {
  void savePopupState(elements.presetSelect.value, size).catch(reportStorageError);
}

function renderResult(result: ResizeResult): void {
  const variant: PopupStatusVariant = result.mode === 'fallback' ? 'info' : 'success';
  const modeLabel = result.mode === 'fallback' ? 'Mode: fallback' : 'Mode: calibrated';

  setSubtitle(modeLabel);
  setStatus(variant, result.message);
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

function handlePresetChange(): void {
  const selectedPreset = findAnyPresetById(elements.presetSelect.value);
  if (!selectedPreset) {
    return;
  }

  applyPresetToInputs(selectedPreset);
  renderPresetMenu(selectedPreset.id);
  persistState({ width: selectedPreset.width, height: selectedPreset.height });
  updateRemovePresetButtonState(selectedPreset.id);
  setSubtitle(`Preset: ${selectedPreset.label}`);
  setStatus('info', 'Preset loaded. Press Apply to resize window.');
}

async function handleAddPreset(): Promise<void> {
  const size = readValidatedCustomPresetSize();
  if (!size) {
    setSubtitle('Invalid preset size');
    setStatus(
      'error',
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
      renderPresetOptions(duplicate.id);
      applyPresetToInputs(duplicate);
      await savePopupState(duplicate.id, size);
      setSubtitle(`Preset exists: ${duplicate.label}`);
      setStatus('info', 'Same custom preset already exists. Selected it for you.');
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
    renderPresetOptions(customPreset.id);
    applyPresetToInputs(customPreset);
    await savePopupState(customPreset.id, size);

    elements.presetNameInput.value = '';
    setSubtitle(`Preset saved: ${customPreset.label}`);
    setStatus('success', 'Custom preset saved.');
  } finally {
    elements.addPresetButton.disabled = false;
  }
}

async function handleRemoveSelectedPreset(): Promise<void> {
  const selectedId = elements.presetSelect.value;
  if (!isCustomPresetId(selectedId)) {
    setStatus('info', 'Built-in presets cannot be removed.');
    return;
  }

  elements.removePresetButton.disabled = true;

  try {
    const removedPreset = state.customPresets.find((preset) => preset.id === selectedId);
    const nextCustomPresets = state.customPresets.filter((preset) => preset.id !== selectedId);
    await saveCustomPresets(nextCustomPresets);
    state.customPresets = nextCustomPresets;

    const fallbackPreset = getDefaultPreset();
    await savePopupState(fallbackPreset.id, {
      width: fallbackPreset.width,
      height: fallbackPreset.height,
    });
    renderPresetOptions(fallbackPreset.id);
    applyPresetToInputs(fallbackPreset);

    setSubtitle(removedPreset ? `Removed: ${removedPreset.label}` : 'Removed custom preset');
    setStatus('info', 'Custom preset removed.');
  } finally {
    updateRemovePresetButtonState(elements.presetSelect.value);
  }
}

function handlePresetMenuClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const option = target.closest<HTMLButtonElement>('.preset-option');
  if (!option) {
    return;
  }

  const presetId = option.dataset.presetId;
  if (!presetId || elements.presetSelect.value === presetId) {
    setPresetMenuOpen(false);
    return;
  }

  elements.presetSelect.value = presetId;
  handlePresetChange();
  setPresetMenuOpen(false);
}

function bindPresetDropdownEvents(): void {
  elements.presetTrigger.addEventListener('click', () => {
    setPresetMenuOpen(!state.isPresetMenuOpen);
  });

  elements.presetTrigger.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      setPresetMenuOpen(true);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setPresetMenuOpen(false);
    }
  });

  elements.presetMenu.addEventListener('click', handlePresetMenuClick);

  document.addEventListener('click', (event) => {
    const target = event.target as Node | null;
    if (!target || elements.presetDropdown.contains(target)) {
      return;
    }

    setPresetMenuOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.isPresetMenuOpen) {
      setPresetMenuOpen(false);
    }
  });
}

async function handleApply(event: Event): Promise<void> {
  event.preventDefault();

  if (elements.applyButton.disabled) {
    return;
  }

  const requestedSize = getInputSize();
  elements.widthInput.value = String(requestedSize.width);
  elements.heightInput.value = String(requestedSize.height);

  elements.applyButton.disabled = true;
  setSubtitle('Applying viewport target');
  setStatus('info', 'Resizing current window...');

  try {
    const target = await queryPopupTarget();
    const result = await requestBackgroundResize(requestedSize, target);
    await savePopupState(elements.presetSelect.value, requestedSize);
    renderResult(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected resize error.';
    setSubtitle('Mode: failed');
    setStatus('error', message);
  } finally {
    elements.applyButton.disabled = false;
  }
}

async function initPopup(): Promise<void> {
  elements.formElement.addEventListener('submit', (event) => {
    void handleApply(event).catch((error) => {
      const message = error instanceof Error ? error.message : 'Unexpected popup error.';
      setStatus('error', message);
    });
  });

  await loadInitialState();
  bindPresetDropdownEvents();

  elements.addPresetButton.addEventListener('click', () => {
    void handleAddPreset().catch((error) => {
      reportStorageError(error);
    });
  });

  elements.removePresetButton.addEventListener('click', () => {
    void handleRemoveSelectedPreset().catch((error) => {
      reportStorageError(error);
    });
  });

  elements.applyButton.disabled = false;
}

void initPopup().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unexpected popup initialization error.';
  setStatus('error', message);
});
