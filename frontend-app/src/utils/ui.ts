/** Yield once to the native UI without assuming a browser global exists. */
export function waitForUiFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

export function scheduleUiTask(task: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(task);
    return;
  }
  setTimeout(task, 0);
}
