const MEASURE_VIEWPORT_MESSAGE = 'MEASURE_VIEWPORT';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== MEASURE_VIEWPORT_MESSAGE) {
    return false;
  }

  sendResponse({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight,
    devicePixelRatio: window.devicePixelRatio,
  });

  return false;
});
