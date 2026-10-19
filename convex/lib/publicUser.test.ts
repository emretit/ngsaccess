import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { toPublicUser } from "./publicUser";

describe("toPublicUser", () => {
  it("returns only the explicit safe field allowlist", () => {
    const user = Object.assign({
      _id: "user-1" as Id<"users">,
      _creationTime: 10,
      email: "person@example.test",
      name: "Person",
      fullName: "Test Person",
      role: "project_user" as const,
      verified: true,
      setupToken: "secret-token",
      tokenExpiresAt: "2030-01-01T00:00:00.000Z",
      firstCompanyName: "Private company",
    } satisfies Doc<"users">, { futureSensitiveField: "hidden" });

    expect(toPublicUser(user)).toEqual({
      _id: user._id,
      _creationTime: 10,
      email: "person@example.test",
      name: "Person",
      fullName: "Test Person",
      role: "project_user",
      verified: true,
    });
    expect(toPublicUser(user)).not.toHaveProperty("setupToken");
    expect(toPublicUser(user)).not.toHaveProperty("tokenExpiresAt");
    expect(toPublicUser(user)).not.toHaveProperty("firstCompanyName");
    expect(toPublicUser(user)).not.toHaveProperty("futureSensitiveField");
  });
});
