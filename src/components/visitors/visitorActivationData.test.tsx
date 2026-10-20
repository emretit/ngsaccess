import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import type { VisitorDetail } from "@/types/visitor";
import { useVisitorFormData, type VisitorFormData } from "./hooks/useVisitorFormData";

const state = vi.hoisted(() => ({ updates: [] as unknown[], effects: [] as (() => void)[], cursor: 0 }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = state.cursor++;
    return [typeof initial === "function" ? initial() : initial, (value: unknown) => { state.updates[index] = value; }];
  },
  useEffect: (effect: () => void) => { state.effects.push(effect); },
}));
vi.mock("convex/react", () => ({
  useQuery: (reference: Parameters<typeof getFunctionName>[0]) => getFunctionName(reference) === "visitors:presetRules" ? [
    { _id: "active-rule", name: "Lobby", isActive: true, hasDoors: true },
    { _id: "no-doors", name: "Empty zone", isActive: true, hasDoors: false },
    { _id: "inactive-rule", name: "Inactive zone", isActive: false, hasDoors: true },
  ] : [],
}));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "project", loading: false }) }));

const visitor: VisitorDetail = {
  _id: "prereg" as Id<"employees">, projectId: "project" as Id<"projects">,
  firstName: "Synthetic", lastName: "Visitor", company: null, cardNumber: "PRE:synthetic-reference",
  hostName: null, presetRuleName: null, visitStart: null, visitEnd: "2099-01-01T15:00:00.000Z",
  status: "preRegistered", lastSeenAt: null, lastDirection: null, presence: "unknown", hasKvkkConsent: false,
  tcNo: null, sensitiveMasked: false, cardReleased: false, isActive: false,
  hostEmployeeId: null, presetRuleId: null, email: null, visitorPhone: null, visitorCompany: null,
  visitPurpose: null, notes: null, kvkkConsent: null, recentReadings: [],
};
function initialize(detail: VisitorDetail) {
  let options: { id: string; disabled: boolean }[] = [];
  function Harness() {
    options = useVisitorFormData(detail).presetRules;
    return null;
  }
  renderToStaticMarkup(<Harness />);
  for (const effect of state.effects) effect();
  return { form: state.updates[0] as VisitorFormData, options };
}
beforeEach(() => { state.updates = []; state.effects = []; state.cursor = 0; });

it.each(["PRE:synthetic-reference", "IADE:returned-card", "•••• 1234"])("starts the real edit form with an empty actual-card input for %s", cardNumber => {
  const { form } = initialize({ ...visitor, cardNumber });
  expect(form.cardNumber).toBe("");
  expect(form.isActive).toBe(false);
  expect(form.presetRuleId).toBeNull();
  expect(form.firstName).toBe(visitor.firstName);
});
it("keeps an ordinary actual card and its existing region while editing", () => {
  const { form } = initialize({ ...visitor, isActive: true, cardNumber: "00123456", presetRuleId: "active-rule" as Id<"accessRules"> });
  expect(form.cardNumber).toBe("00123456");
  expect(form.presetRuleId).toBe("active-rule");
});
it("offers only active zones for assignment and marks a zone without doors unavailable", () => {
  const { options } = initialize(visitor);
  expect(options).toEqual([
    { id: "active-rule", name: "Lobby", disabled: false },
    { id: "no-doors", name: "Empty zone (Kapı yok)", disabled: true },
  ]);
});
it("retains an existing inactive zone as disabled instead of making it selectable", () => {
  const { options } = initialize({ ...visitor, presetRuleId: "inactive-rule" as Id<"accessRules"> });
  expect(options.find(option => option.id === "inactive-rule")).toMatchObject({ disabled: true });
});
