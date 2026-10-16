import { useEffect, useState } from "react";

type VisibilitySource = Pick<
  Document,
  "visibilityState" | "addEventListener" | "removeEventListener"
>;

export function startVisibleClock(
  source: VisibilitySource,
  tick: (now: number) => void,
  intervalMs = 30_000,
) {
  let timer: ReturnType<typeof setInterval> | undefined;
  const sync = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    if (source.visibilityState === "hidden") return;
    tick(Date.now());
    timer = setInterval(() => tick(Date.now()), intervalMs);
  };
  source.addEventListener("visibilitychange", sync);
  sync();
  return () => {
    source.removeEventListener("visibilitychange", sync);
    if (timer !== undefined) clearInterval(timer);
  };
}

export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(Date.now);
  useEffect(
    () => startVisibleClock(document, setNow, intervalMs),
    [intervalMs],
  );
  return now;
}
