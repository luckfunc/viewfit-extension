export interface PopupElements {
  presetSelect: HTMLSelectElement;
  presetMenu: HTMLDivElement;
  presetNameInput: HTMLInputElement;
  widthInput: HTMLInputElement;
  heightInput: HTMLInputElement;
  addPresetButton: HTMLButtonElement;
  statusElement: HTMLDivElement;
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

function isHTMLInputElement(element: HTMLElement): element is HTMLInputElement {
  return element instanceof HTMLInputElement;
}

function isHTMLFormElement(element: HTMLElement): element is HTMLFormElement {
  return element instanceof HTMLFormElement;
}

export function getPopupElements(): PopupElements {
  return {
    presetSelect: requireTypedElement('preset-select', 'HTMLSelectElement', isHTMLSelectElement),
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
    statusElement: requireTypedElement('status', 'HTMLDivElement', isHTMLDivElement),
    formElement: requireTypedElement('resizer-form', 'HTMLFormElement', isHTMLFormElement),
  };
}
