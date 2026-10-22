import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MouseEvent } from "react";
import { isRowActivationClick, onRowActivate } from "./tableRowClick";

/** Node ortamında DOM yok: yalnız helper'ın kullandığı yüzeyi taklit eder. */
class FakeElement {
  constructor(
    readonly interactive = false,
    readonly parent: FakeElement | null = null,
  ) {}
  closest() {
    return this.interactive ? this : null;
  }
  contains(other: FakeElement): boolean {
    return other === this || (other.parent ? this.contains(other.parent) : false);
  }
}

let selection = "";

function click(target: FakeElement, row: FakeElement) {
  return { target, currentTarget: row } as unknown as MouseEvent<HTMLElement>;
}

beforeEach(() => {
  selection = "";
  vi.stubGlobal("Element", FakeElement);
  vi.stubGlobal("window", { getSelection: () => ({ toString: () => selection }) });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isRowActivationClick", () => {
  const row = new FakeElement();

  it("accepts a click on plain cell content", () => {
    expect(isRowActivationClick(click(new FakeElement(false, row), row))).toBe(true);
  });

  it("ignores clicks on buttons and checkboxes inside the row", () => {
    expect(isRowActivationClick(click(new FakeElement(true, row), row))).toBe(false);
  });

  it("ignores portal clicks that bubble through React but sit outside the row", () => {
    expect(isRowActivationClick(click(new FakeElement(), row))).toBe(false);
  });

  it("ignores the click that ends a text selection", () => {
    selection = "Ad";
    expect(isRowActivationClick(click(new FakeElement(false, row), row))).toBe(false);
  });
});

describe("onRowActivate", () => {
  it("calls open only for row activation clicks", () => {
    const row = new FakeElement();
    const open = vi.fn();
    const handler = onRowActivate(open);
    handler(click(new FakeElement(true, row), row));
    expect(open).not.toHaveBeenCalled();
    handler(click(new FakeElement(false, row), row));
    expect(open).toHaveBeenCalledTimes(1);
  });
});
