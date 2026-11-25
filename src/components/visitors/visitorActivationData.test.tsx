import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import type { VisitorDetail } from "@/types/visitor";
import { useVisitorFormData, type VisitorFormData } from "./hooks/useVisitorFormData";

const queries = vi.hoisted(() => [] as { name: string; args: unknown }[]);
const state = vi.hoisted(() => ({ search: "", updates: [] as unknown[], effects: [] as (() => void)[], cursor: 0 }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = state.cursor++;
    return [index === 2 || index === 3 ? state.search : typeof initial === "function" ? initial() : initial, (value: unknown) => { state.updates[index] = value; }];
  },
  useEffect: (effect: () => void) => { state.effects.push(effect); },
}));
vi.mock("convex/react", () => ({
  useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(reference);
    queries.push({ name, args });
    return [];
  },
}));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "project", loading: false }) }));

const visitor: VisitorDetail = {
  visitorCredential: "card",
  _id: "prereg" as Id<"employees">, projectId: "project" as Id<"projects">,
  firstName: "Synthetic", lastName: "Visitor", company: null, cardNumber: "PRE:synthetic-reference",
  hostName: null, presetRuleName: null, visitStart: null, visitEnd: "2099-01-01T15:00:00.000Z",
  status: "preRegistered", lastSeenAt: null, lastDirection: null, presence: "unknown", hasKvkkConsent: false,
  tcNo: null, sensitiveMasked: false, cardReleased: false, isActive: false,
  hostEmployeeId: null, presetRuleId: null, email: null, visitorPhone: null, visitorCompany: null,
  visitPurpose: null, notes: null, kvkkConsent: null, recentReadings: [],
};
function initialize(detail: VisitorDetail) {
  let hosts: { id: string; name: string }[] = [];
  function Harness() {
    const data = useVisitorFormData(detail);
    hosts = data.hostEmployees;
    return null;
  }
  renderToStaticMarkup(<Harness />);
  for (const effect of state.effects) effect();
  return { form: state.updates[0] as VisitorFormData, hosts };
}
afterEach(() => vi.useRealTimers());
beforeEach(() => { vi.useFakeTimers(); state.search = ""; queries.length = 0; state.updates = []; state.effects = []; state.cursor = 0; });

it.each(["PRE:synthetic-reference", "IADE:returned-card", "•••• 1234"])("starts the real edit form with an empty actual-card input for %s", cardNumber => {
  const { form } = initialize({ ...visitor, cardNumber });
  expect(form.cardNumber).toBe("");
  expect(form.isActive).toBe(false);
  expect(form.selected_doors).toEqual([]);
  expect(form.firstName).toBe(visitor.firstName);
});
it("keeps an ordinary actual card while editing without loading visitor zone rules", () => {
  const { form } = initialize({ ...visitor, isActive: true, cardNumber: "00123456", presetRuleId: "active-rule" as Id<"accessRules"> });
  expect(form.cardNumber).toBe("00123456");
  expect(form.selected_doors).toEqual([]);
  expect(queries.some(query => query.name === "visitors:presetRules")).toBe(false);
});

it("uses bounded server host search and retains the current host name outside results", () => {
  const hostEmployeeId = "old-host" as Id<"employees">;
  const { hosts } = initialize({ ...visitor, hostEmployeeId, hostName: "Deniz Yılmaz" });
  expect(hosts).toContainEqual({ id: hostEmployeeId, name: "Deniz Yılmaz" });
  expect(queries).toContainEqual({ name: "visitorHosts:search", args: { projectId: "project", search: "" } });
  expect(queries.some(query => query.name === "employees:list")).toBe(false);
});

it("sends the typed host search to the server while keeping the form available", () => {
  state.search = "Deniz";
  initialize(visitor);
  expect(queries).toContainEqual({ name: "visitorHosts:search", args: { projectId: "project", search: "Deniz" } });
});
