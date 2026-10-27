import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { usePdksSavedViews } from "./usePdksSavedViews";

const state = vi.hoisted(() => ({ query: vi.fn(), mutate: vi.fn() }));
vi.mock("convex/react", () => ({
  useQuery: () => state.query(),
  useMutation: () => state.mutate,
}));

function readViews() {
  let result: ReturnType<typeof usePdksSavedViews> | undefined;
  function Probe() {
    result = usePdksSavedViews();
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  if (!result) throw new Error("Hook sonucu eksik");
  return result;
}

beforeEach(() => {
  state.mutate.mockReset();
  state.query.mockReturnValue(JSON.stringify([
    { id: "one", name: "Bir", filters: {} },
    { id: "two", name: "İki", filters: {} },
  ]));
});

it("silme Promise'i kalıcı kaydı bekler ve kalan görünümleri korur", async () => {
  let finish: (() => void) | undefined;
  state.mutate.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  const result = readViews().remove("one");
  let settled = false;
  void result.then(() => { settled = true; });
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(state.mutate).toHaveBeenCalledWith({
    key: "pdksSavedViews",
    value: JSON.stringify([{ id: "two", name: "İki", filters: {} }]),
  });
  finish?.();
  await result;
  expect(settled).toBe(true);
});

it("kalıcı kayıt hatasını silme onayına iletir", async () => {
  const error = new Error("Kayıt silinemedi");
  state.mutate.mockRejectedValue(error);
  await expect(readViews().remove("one")).rejects.toBe(error);
});
