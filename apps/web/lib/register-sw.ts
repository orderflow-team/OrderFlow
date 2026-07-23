export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  const doRegister = () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('Service worker registration failed', err);
    });
  };
  // This runs from a client component mounted well after hydration, so the
  // window 'load' event has often already fired by the time we get here —
  // register immediately in that case instead of waiting for an event that
  // will never come.
  if (document.readyState === 'complete') {
    doRegister();
  } else {
    window.addEventListener('load', doRegister);
  }
}
