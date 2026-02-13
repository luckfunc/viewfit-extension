import { DEFAULT_PRESET_ID, PRESETS, findPresetById } from '../shared/presets';
import { applyViewportResize } from '../shared/resize';
import type { PopupStatusVariant, ResizeInput, ResizeResult, SizePreset } from '../shared/types';

const CUSTOM_PRESET_PREFIX = 'custom-';

const STORAGE_KEYS = {
  presetId: 'lastPresetId',
  customWidth: 'lastCustomWidth',
  customHeight: 'lastCustomHeight',
  customPresets: 'customPresets',
} as const;

const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
const presetDropdown = document.getElementById('preset-dropdown') as HTMLDivElement;
const presetTrigger = document.getElementById('preset-trigger') as HTMLButtonElement;
const presetTriggerSize = document.getElementById('preset-trigger-size') as HTMLSpanElement;
const presetTriggerName = document.getElementById('preset-trigger-name') as HTMLSpanElement;
const presetMenu = document.getElementById('preset-menu') as HTMLDivElement;
const presetNameInput = document.getElementById('preset-name-input') as HTMLInputElement;
const widthInput = document.getElementById('width-input') as HTMLInputElement;
const heightInput = document.getElementById('height-input') as HTMLInputElement;
const addPresetButton = document.getElementById('add-preset-button') as HTMLButtonElement;
const removePresetButton = document.getElementById('remove-preset-button') as HTMLButtonElement;
const applyButton = document.getElementById('apply-button') as HTMLButtonElement;
const statusElement = document.getElementById('status') as HTMLDivElement;
const subtitleElement = document.getElementById('popup-subtitle') as HTMLParagraphElement;
const formElement = document.getElementById('resizer-form') as HTMLFormElement;

let customPresets: SizePreset[] = [];
let isPresetMenuOpen = false;
let presetSearchQuery = '';

function setSubtitle(text: string): void {
  subtitleElement.textContent = text;
}

function setStatus(variant: PopupStatusVariant, message: string): void {
  statusElement.classList.remove('status--success', 'status--error', 'status--info');
  statusElement.classList.add(`status--${variant}`);
  statusElement.textContent = message;
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

function getInputSize(): ResizeInput {
  return {
    width: parsePositiveInteger(widthInput.value, 1366),
    height: parsePositiveInteger(heightInput.value, 768),
  };
}

function isCustomPresetId(presetId: string): boolean {
  return presetId.startsWith(CUSTOM_PRESET_PREFIX);
}

function updateRemovePresetButtonState(selectedPresetId: string): void {
  removePresetButton.disabled = !isCustomPresetId(selectedPresetId);
}

function findAnyPresetById(presetId: string): SizePreset | undefined {
  return findPresetById(presetId) ?? customPresets.find((preset) => preset.id === presetId);
}

function appendPresetOption(parent: HTMLOptGroupElement, preset: SizePreset): void {
  const option = document.createElement('option');
  option.value = preset.id;
  option.textContent = preset.label;
  parent.appendChild(option);
}

function splitPresetLabel(preset: SizePreset): { size: string; name: string } {
  const size = `${preset.width} x ${preset.height}`;
  const prefix = `${size} `;
  if (preset.label.startsWith(prefix)) {
    return { size, name: preset.label.slice(prefix.length) };
  }

  return { size, name: preset.label };
}

function setPresetTriggerDisplay(preset: SizePreset): void {
  const label = splitPresetLabel(preset);
  presetTriggerSize.textContent = label.size;
  presetTriggerName.textContent = label.name || 'Preset';
}

function getSelectedMenuOption(): HTMLButtonElement | null {
  const options = presetMenu.querySelectorAll<HTMLButtonElement>('.preset-option');
  for (const option of options) {
    if (option.dataset.presetId === presetSelect.value) {
      return option;
    }
  }

  return null;
}

function normalizeSearchQuery(value: string): string {
  return value.trim().toLowerCase();
}

function matchesPresetSearch(preset: SizePreset, query: string): boolean {
  if (!query) {
    return true;
  }

  const parts = splitPresetLabel(preset);
  const searchableText = `${parts.size} ${parts.name} ${preset.label}`.toLowerCase();
  return searchableText.includes(query);
}

function focusPresetSearchInput(): void {
  const searchInput = presetMenu.querySelector<HTMLInputElement>('.preset-search-input');
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
  input.value = presetSearchQuery;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', 'Search presets');

  input.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement;
    presetSearchQuery = target.value;
    renderPresetMenu(selectedPresetId, true);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const firstOption = presetMenu.querySelector<HTMLButtonElement>('.preset-option');
      firstOption?.focus();
      return;
    }

    if (event.key === 'Escape') {
      event.stopPropagation();
      if (!presetSearchQuery) {
        setPresetMenuOpen(false);
        presetTrigger.focus();
        return;
      }

      presetSearchQuery = '';
      renderPresetMenu(selectedPresetId, true);
    }
  });

  wrapper.appendChild(input);
  return wrapper;
}

function setPresetMenuOpen(open: boolean): void {
  if (isPresetMenuOpen === open) {
    return;
  }

  isPresetMenuOpen = open;
  presetDropdown.dataset.open = open ? 'true' : 'false';
  presetTrigger.setAttribute('aria-expanded', String(open));

  if (open) {
    focusPresetSearchInput();
    const selectedOption = getSelectedMenuOption();
    selectedOption?.scrollIntoView({ block: 'nearest' });
    return;
  }

  if (!presetSearchQuery) {
    return;
  }

  presetSearchQuery = '';
  renderPresetMenu(presetSelect.value);
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
  const normalizedQuery = normalizeSearchQuery(presetSearchQuery);
  const filteredBuiltIns = PRESETS.filter((preset) => matchesPresetSearch(preset, normalizedQuery));
  const filteredCustoms = customPresets.filter((preset) => matchesPresetSearch(preset, normalizedQuery));

  presetMenu.textContent = '';
  presetMenu.appendChild(createPresetSearchControl(selectedPresetId));

  if (filteredBuiltIns.length > 0) {
    presetMenu.appendChild(createPresetMenuGroup('Built-in', filteredBuiltIns, selectedPresetId));
  }

  if (filteredCustoms.length > 0) {
    presetMenu.appendChild(createPresetMenuGroup('Custom', filteredCustoms, selectedPresetId));
  }

  if (filteredBuiltIns.length === 0 && filteredCustoms.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'preset-empty';
    emptyState.textContent = 'No preset matches your search.';
    presetMenu.appendChild(emptyState);
  }

  const selectedPreset = findAnyPresetById(selectedPresetId);
  if (selectedPreset) {
    setPresetTriggerDisplay(selectedPreset);
  }

  if (keepSearchFocus && isPresetMenuOpen) {
    focusPresetSearchInput();
  }
}

function renderPresetOptions(selectedPresetId?: string): void {
  presetSelect.textContent = '';

  const builtInGroup = document.createElement('optgroup');
  builtInGroup.label = 'Built-in';
  PRESETS.forEach((preset) => {
    appendPresetOption(builtInGroup, preset);
  });
  presetSelect.appendChild(builtInGroup);

  if (customPresets.length > 0) {
    const customGroup = document.createElement('optgroup');
    customGroup.label = 'Custom';
    customPresets.forEach((preset) => {
      appendPresetOption(customGroup, preset);
    });
    presetSelect.appendChild(customGroup);
  }

  const fallbackPreset = getDefaultPreset();
  const resolvedSelection =
    selectedPresetId && findAnyPresetById(selectedPresetId) ? selectedPresetId : fallbackPreset.id;

  presetSelect.value = resolvedSelection;
  updateRemovePresetButtonState(resolvedSelection);
  renderPresetMenu(resolvedSelection);
}

function applyPresetToInputs(preset: SizePreset): void {
  widthInput.value = String(preset.width);
  heightInput.value = String(preset.height);
}

function persistState(size: ResizeInput): void {
  chrome.storage.local.set({
    [STORAGE_KEYS.presetId]: presetSelect.value,
    [STORAGE_KEYS.customWidth]: size.width,
    [STORAGE_KEYS.customHeight]: size.height,
  });
}

function saveCustomPresets(): void {
  chrome.storage.local.set({
    [STORAGE_KEYS.customPresets]: customPresets,
  });
}

function normalizePresetName(rawName: string): string {
  return rawName.trim().replace(/\s+/g, ' ').slice(0, 40);
}

function buildCustomPresetLabel(size: ResizeInput, customName: string): string {
  const suffix = customName || 'Custom';
  return `${size.width} x ${size.height} ${suffix}`;
}

function createCustomPresetId(): string {
  return `${CUSTOM_PRESET_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
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
    typeof preset.width === 'number' &&
    Number.isFinite(preset.width) &&
    preset.width > 0 &&
    typeof preset.height === 'number' &&
    Number.isFinite(preset.height) &&
    preset.height > 0
  );
}

function normalizeCustomPresets(value: unknown): SizePreset[] {
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
        item.label.trim().slice(0, 80) ||
        `${Math.round(item.width)} x ${Math.round(item.height)} Custom`,
      width: Math.max(200, Math.round(item.width)),
      height: Math.max(200, Math.round(item.height)),
    };

    if (knownIds.has(normalizedPreset.id)) {
      continue;
    }

    knownIds.add(normalizedPreset.id);
    normalized.push(normalizedPreset);
  }

  return normalized;
}

function renderResult(result: ResizeResult): void {
  const variant: PopupStatusVariant = result.mode === 'fallback' ? 'info' : 'success';
  const modeLabel = result.mode === 'fallback' ? 'Mode: fallback' : 'Mode: calibrated';

  setSubtitle(modeLabel);
  setStatus(variant, result.message);
}

function loadInitialState(): void {
  chrome.storage.local.get(
    [
      STORAGE_KEYS.presetId,
      STORAGE_KEYS.customWidth,
      STORAGE_KEYS.customHeight,
      STORAGE_KEYS.customPresets,
    ],
    (savedValues) => {
      customPresets = normalizeCustomPresets(savedValues[STORAGE_KEYS.customPresets]);

      const defaultPreset = getDefaultPreset();
      const savedPresetId =
        typeof savedValues[STORAGE_KEYS.presetId] === 'string'
          ? savedValues[STORAGE_KEYS.presetId]
          : defaultPreset.id;

      renderPresetOptions(savedPresetId);

      const selectedPreset = findAnyPresetById(presetSelect.value) ?? defaultPreset;

      const savedWidth =
        typeof savedValues[STORAGE_KEYS.customWidth] === 'number'
          ? savedValues[STORAGE_KEYS.customWidth]
          : selectedPreset.width;

      const savedHeight =
        typeof savedValues[STORAGE_KEYS.customHeight] === 'number'
          ? savedValues[STORAGE_KEYS.customHeight]
          : selectedPreset.height;

      widthInput.value = String(savedWidth);
      heightInput.value = String(savedHeight);
    },
  );
}

function handlePresetChange(): void {
  const selectedPreset = findAnyPresetById(presetSelect.value);
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

function handleAddPreset(): void {
  const size = getInputSize();
  const normalizedName = normalizePresetName(presetNameInput.value);
  const nextLabel = buildCustomPresetLabel(size, normalizedName);

  const duplicate = customPresets.find(
    (preset) =>
      preset.width === size.width &&
      preset.height === size.height &&
      preset.label.toLowerCase() === nextLabel.toLowerCase(),
  );

  if (duplicate) {
    renderPresetOptions(duplicate.id);
    applyPresetToInputs(duplicate);
    persistState(size);
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

  customPresets = [...customPresets, customPreset];
  saveCustomPresets();
  renderPresetOptions(customPreset.id);
  applyPresetToInputs(customPreset);
  persistState(size);

  presetNameInput.value = '';
  setSubtitle(`Preset saved: ${customPreset.label}`);
  setStatus('success', 'Custom preset saved.');
}

function handleRemoveSelectedPreset(): void {
  const selectedId = presetSelect.value;
  if (!isCustomPresetId(selectedId)) {
    setStatus('info', 'Built-in presets cannot be removed.');
    return;
  }

  const removedPreset = customPresets.find((preset) => preset.id === selectedId);
  customPresets = customPresets.filter((preset) => preset.id !== selectedId);
  saveCustomPresets();

  const fallbackPreset = getDefaultPreset();
  renderPresetOptions(fallbackPreset.id);
  applyPresetToInputs(fallbackPreset);
  persistState({ width: fallbackPreset.width, height: fallbackPreset.height });

  setSubtitle(removedPreset ? `Removed: ${removedPreset.label}` : 'Removed custom preset');
  setStatus('info', 'Custom preset removed.');
}

function handlePresetMenuClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const option = target.closest<HTMLButtonElement>('.preset-option');
  if (!option) {
    return;
  }

  const presetId = option.dataset.presetId;
  if (!presetId || presetSelect.value === presetId) {
    setPresetMenuOpen(false);
    return;
  }

  presetSelect.value = presetId;
  handlePresetChange();
  setPresetMenuOpen(false);
}

function bindPresetDropdownEvents(): void {
  presetTrigger.addEventListener('click', () => {
    setPresetMenuOpen(!isPresetMenuOpen);
  });

  presetTrigger.addEventListener('keydown', (event) => {
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

  presetMenu.addEventListener('click', handlePresetMenuClick);

  document.addEventListener('click', (event) => {
    const target = event.target as Node | null;
    if (!target || presetDropdown.contains(target)) {
      return;
    }

    setPresetMenuOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isPresetMenuOpen) {
      setPresetMenuOpen(false);
    }
  });
}

async function handleApply(event: Event): Promise<void> {
  event.preventDefault();

  const requestedSize = getInputSize();
  widthInput.value = String(requestedSize.width);
  heightInput.value = String(requestedSize.height);

  applyButton.disabled = true;
  setSubtitle('Applying viewport target');
  setStatus('info', 'Resizing current window...');

  try {
    const result = await applyViewportResize(requestedSize);
    persistState(requestedSize);
    renderResult(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected resize error.';
    setSubtitle('Mode: failed');
    setStatus('error', message);
  } finally {
    applyButton.disabled = false;
  }
}

function initPopup(): void {
  loadInitialState();
  bindPresetDropdownEvents();

  addPresetButton.addEventListener('click', handleAddPreset);
  removePresetButton.addEventListener('click', handleRemoveSelectedPreset);

  formElement.addEventListener('submit', (event) => {
    handleApply(event).catch((error) => {
      const message = error instanceof Error ? error.message : 'Unexpected popup error.';
      setStatus('error', message);
    });
  });
}

initPopup();
