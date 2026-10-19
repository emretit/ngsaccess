/** Controlled overlays have no Trigger; preserve the actual opener. */
export function restorePdksFocus(event: Pick<Event, "preventDefault">, target?: HTMLElement | null): void {
  if (!target?.isConnected) return;
  event.preventDefault();
  target.focus();
}
