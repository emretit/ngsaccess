import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DateRangeFields } from "./DateRangeFields";

type CapturedProps = {
  id?: string; value: string; min?: string; max?: string; required?: boolean; disabled?: boolean;
  "aria-invalid"?: boolean; "aria-describedby"?: string; onChange: (value: string) => void;
};
const captured = vi.hoisted(() => [] as CapturedProps[]);
vi.mock("@/components/ui/date-picker", () => ({
  DateInput: (props: CapturedProps) => {
    captured.push(props);
    return <button type="button" id={props.id} aria-invalid={props["aria-invalid"]} aria-describedby={props["aria-describedby"]}>{props.value}</button>;
  },
}));
beforeEach(() => { captured.length = 0; });

describe("DateRangeFields", () => {
  it("labels both pickers by id prefix and reports which side changed", () => {
    const onChange = vi.fn();
    const html = renderToStaticMarkup(<DateRangeFields idPrefix="leave" required value={{ start: "2026-10-01", end: "2026-10-05" }} errors={{ end: "Bitiş geçersiz" }} onChange={onChange} />);
    expect(html).toContain('for="leave-start"');
    expect(html).toContain('>Başlangıç tarihi</label>');
    expect(html).toContain('id="leave-end" aria-invalid="true" aria-describedby="leave-end-error"');
    expect(html).toContain('id="leave-end-error"');
    const [start, end] = captured;
    expect(start?.required).toBe(true);
    expect(start?.max).toBeUndefined();
    expect(end?.min).toBeUndefined();
    start?.onChange("2026-09-30");
    expect(onChange).toHaveBeenLastCalledWith({ start: "2026-09-30", end: "2026-10-05" }, "start");
    end?.onChange("2026-10-09");
    expect(onChange).toHaveBeenLastCalledWith({ start: "2026-10-01", end: "2026-10-09" }, "end");
  });

  it("bounds each picker by the other and ties the range error to both", () => {
    const html = renderToStaticMarkup(<DateRangeFields idPrefix="pdks" constrainOrder disabled value={{ start: "2026-10-01", end: "2026-10-05" }} errors={{ range: "Başlangıç tarihi bitişten sonra olamaz." }} onChange={vi.fn()} />);
    const [start, end] = captured;
    expect(start?.max).toBe("2026-10-05");
    expect(end?.min).toBe("2026-10-01");
    expect(start?.disabled).toBe(true);
    expect(html.match(/aria-describedby="pdks-range-error"/g)).toHaveLength(2);
    expect(html).toMatch(/<p id="pdks-range-error"[^>]*role="alert"[^>]*>Başlangıç tarihi bitişten sonra olamaz\.<\/p>/);
  });

  it("leaves bounds open while the other side is empty", () => {
    renderToStaticMarkup(<DateRangeFields idPrefix="x" constrainOrder layout="row" value={{ start: "", end: "" }} onChange={vi.fn()} />);
    expect(captured[0]?.max).toBeUndefined();
    expect(captured[1]?.min).toBeUndefined();
  });
});
