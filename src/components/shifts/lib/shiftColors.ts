import type { ShiftColor } from "../../../../convex/lib/shiftColors";

export const SHIFT_COLORS = {
  slate: { label: "Gri", dot: "bg-slate-400", bar: "border-l-[3px] border-l-slate-400" },
  blue: { label: "Mavi", dot: "bg-blue-400", bar: "border-l-[3px] border-l-blue-400" },
  teal: { label: "Turkuaz", dot: "bg-teal-400", bar: "border-l-[3px] border-l-teal-400" },
  green: { label: "Yeşil", dot: "bg-green-400", bar: "border-l-[3px] border-l-green-400" },
  amber: { label: "Sarı", dot: "bg-amber-400", bar: "border-l-[3px] border-l-amber-400" },
  orange: { label: "Turuncu", dot: "bg-orange-400", bar: "border-l-[3px] border-l-orange-400" },
  rose: { label: "Gül", dot: "bg-rose-400", bar: "border-l-[3px] border-l-rose-400" },
  violet: { label: "Mor", dot: "bg-violet-400", bar: "border-l-[3px] border-l-violet-400" },
} satisfies Record<ShiftColor, { label: string; dot: string; bar: string }>;

export function shiftColorClasses(color?: string | null): { dot: string; bar: string } | null {
  if (!color || !Object.prototype.hasOwnProperty.call(SHIFT_COLORS, color)) return null;
  return SHIFT_COLORS[color as ShiftColor];
}
