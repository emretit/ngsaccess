/** The app shell scrolls main rather than window. */
export function watchReadingScroll(container: Element | null, pause: () => void) {
  if (!container) return;
  const scroll = () => { if (container.scrollTop > 80) pause(); };
  container.addEventListener("scroll", scroll, { passive: true });
  return () => container.removeEventListener("scroll", scroll);
}
