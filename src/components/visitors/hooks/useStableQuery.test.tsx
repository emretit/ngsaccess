import { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { useStableQuery } from "./useStableQuery";

function renderSequence<T>(steps: { value: T | undefined; scope: string | undefined }[]) {
  const results = new Map<number, T | undefined>();
  function Harness() {
    const [step, setStep] = useState(0);
    const input = steps[step];
    const stable = useStableQuery(input.value, input.scope);
    results.set(step, stable);
    // Server rendering supports same-component state updates, so this exercises
    // the real hook over consecutive renders without a DOM or mocked React state.
    if (step < steps.length - 1) setStep(step + 1);
    return null;
  }
  renderToStaticMarkup(<Harness />);
  return [...results.values()];
}

describe("visitor query refresh continuity", () => {
  it("keeps detail, list and summary resolved through multiple pending refreshes", () => {
    for (const value of [{ _id: "visitor", notes: "Kaydedilmemiş düzenleme" }, { page: [], isDone: true }, { total: 0 }]) {
      const updated = { ...value };
      expect(renderSequence([
        { scope: "same", value: undefined },
        { scope: "same", value },
        { scope: "same", value: undefined },
        { scope: "same", value: undefined },
        { scope: "same", value: updated },
      ])).toEqual([undefined, value, value, value, updated]);
    }
  });

  it("clears stale data on visitor/project/filter/page changes, including a skipped query", () => {
    expect(renderSequence([
      { scope: "project-a:visitor-a:page-1", value: "old" },
      { scope: "project-a:visitor-a:page-2", value: undefined },
      { scope: "project-a:visitor-a:page-2", value: "next" },
      { scope: "project-b:visitor-b:filter-new", value: undefined },
      { scope: undefined, value: undefined },
      { scope: "project-a:visitor-a:page-1", value: undefined },
    ])).toEqual(["old", undefined, "next", undefined, undefined, undefined]);
  });

  it("accepts a resolved deletion and never resurrects the old detail", () => {
    expect(renderSequence<string | null>([
      { scope: "visitor", value: "detail" },
      { scope: "visitor", value: null },
      { scope: "visitor", value: undefined },
    ])).toEqual(["detail", null, null]);
  });
});
