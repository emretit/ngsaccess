import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AccountAccessBadges } from "./AccountAccessActions";
import type { User } from "../types/user-types";

const user: User = {
  _id: "user" as User["_id"], displayName: "Kullanıcı", email: "", role: "viewer",
  disabledAt: undefined, accessExpiresAt: undefined, setupExpiresAt: undefined,
  projects: [], isSelf: false, canResetPassword: false, pendingSetup: false, accessExpired: false,
};
describe("account access badges", () => {
  it("shows frozen and expired states together", () => {
    const html = renderToStaticMarkup(<AccountAccessBadges user={{ ...user, disabledAt: 0, accessExpiresAt: 0, accessExpired: true }} />);
    expect(html).toContain("Donduruldu");
    expect(html).toContain("Erişim bitti");
  });
  it("formats expiry in Istanbul independently of the browser timezone", () => {
    const html = renderToStaticMarkup(<AccountAccessBadges user={{ ...user, accessExpiresAt: Date.parse("2030-01-02T10:30:00Z") }} />);
    expect(html).toContain("Bitiş:");
    expect(html).toContain("13:30");
  });
  it("preserves legacy users without access fields", () => {
    const html = renderToStaticMarkup(<AccountAccessBadges user={user} />);
    expect(html).not.toContain("Donduruldu");
    expect(html).not.toContain("Bitiş:");
  });
});
