export function createCardCaptureSession() {
  let captured = false;
  return {
    rearm() { captured = false; },
    capture(card: string | undefined): string | null {
      if (captured || !card) return null;
      captured = true;
      return card;
    },
  };
}
