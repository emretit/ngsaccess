export function createCardCaptureSession() {
  let captured = false;
  let generation = 0;
  return {
    rearm() { captured = false; return ++generation; },
    cancel() { captured = true; generation += 1; },
    isCurrent(token: number) { return token === generation; },
    capture(card: string | undefined): string | null {
      if (captured || !card) return null;
      captured = true;
      return card;
    },
  };
}
