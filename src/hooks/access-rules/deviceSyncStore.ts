import { useSyncExternalStore } from "react";

let counter = 0;
const active = new Set<number>();
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((l) => l());
};

export const deviceSyncStore = {
  start(): () => void {
    const id = ++counter;
    const wasActive = active.size > 0;
    active.add(id);
    if (!wasActive) emit();
    return () => {
      if (!active.delete(id)) return;
      if (active.size === 0) emit();
    };
  },
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  getSnapshot: () => active.size > 0,
  getServerSnapshot: () => false,
};

export function useDeviceSyncing(): boolean {
  return useSyncExternalStore(
    deviceSyncStore.subscribe,
    deviceSyncStore.getSnapshot,
    deviceSyncStore.getServerSnapshot,
  );
}
