export interface PopupElements {
  presetSelect: HTMLSelectElement;
  presetDropdown: HTMLDivElement;
  presetTrigger: HTMLButtonElement;
  presetTriggerSize: HTMLSpanElement;
  presetTriggerName: HTMLSpanElement;
  presetMenu: HTMLDivElement;
  presetNameInput: HTMLInputElement;
  widthInput: HTMLInputElement;
  heightInput: HTMLInputElement;
  addPresetButton: HTMLButtonElement;
  removePresetButton: HTMLButtonElement;
  applyButton: HTMLButtonElement;
  statusElement: HTMLDivElement;
  subtitleElement: HTMLParagraphElement;
  formElement: HTMLFormElement;
}

function requireElementById(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required popup element: #${id}`);
  }

  return element;
}

function requireTypedElement<T extends HTMLElement>(
  id: string,
  expectedType: string,
  isExpectedType: (element: HTMLElement) => element is T,
): T {
  const element = requireElementById(id);
  if (!isExpectedType(element)) {
    throw new Error(`Invalid element type for #${id}. Expected ${expectedType}.`);
  }

  return element;
}

function isHTMLSelectElement(element: HTMLElement): element is HTMLSelectElement {
  return element instanceof HTMLSelectElement;
}

function isHTMLDivElement(element: HTMLElement): element is HTMLDivElement {
  return element instanceof HTMLDivElement;
}

function isHTMLButtonElement(element: HTMLElement): element is HTMLButtonElement {
  return element instanceof HTMLButtonElement;
}

function isHTMLSpanElement(element: HTMLElement): element is HTMLSpanElement {
  return element instanceof HTMLSpanElement;
}

function isHTMLInputElement(element: HTMLElement): element is HTMLInputElement {
  return element instanceof HTMLInputElement;
}

function isHTMLParagraphElement(element: HTMLElement): element is HTMLParagraphElement {
  return element instanceof HTMLParagraphElement;
}

function isHTMLFormElement(element: HTMLElement): element is HTMLFormElement {
  return element instanceof HTMLFormElement;
}

export function getPopupElements(): PopupElements {
  return {
    presetSelect: requireTypedElement('preset-select', 'HTMLSelectElement', isHTMLSelectElement),
    presetDropdown: requireTypedElement('preset-dropdown', 'HTMLDivElement', isHTMLDivElement),
    presetTrigger: requireTypedElement('preset-trigger', 'HTMLButtonElement', isHTMLButtonElement),
    presetTriggerSize: requireTypedElement(
      'preset-trigger-size',
      'HTMLSpanElement',
      isHTMLSpanElement,
    ),
    presetTriggerName: requireTypedElement(
      'preset-trigger-name',
      'HTMLSpanElement',
      isHTMLSpanElement,
    ),
    presetMenu: requireTypedElement('preset-menu', 'HTMLDivElement', isHTMLDivElement),
    presetNameInput: requireTypedElement(
      'preset-name-input',
      'HTMLInputElement',
      isHTMLInputElement,
    ),
    widthInput: requireTypedElement('width-input', 'HTMLInputElement', isHTMLInputElement),
    heightInput: requireTypedElement('height-input', 'HTMLInputElement', isHTMLInputElement),
    addPresetButton: requireTypedElement(
      'add-preset-button',
      'HTMLButtonElement',
      isHTMLButtonElement,
    ),
    removePresetButton: requireTypedElement(
      'remove-preset-button',
      'HTMLButtonElement',
      isHTMLButtonElement,
    ),
    applyButton: requireTypedElement('apply-button', 'HTMLButtonElement', isHTMLButtonElement),
    statusElement: requireTypedElement('status', 'HTMLDivElement', isHTMLDivElement),
    subtitleElement: requireTypedElement(
      'popup-subtitle',
      'HTMLParagraphElement',
      isHTMLParagraphElement,
    ),
    formElement: requireTypedElement('resizer-form', 'HTMLFormElement', isHTMLFormElement),
  };
}
