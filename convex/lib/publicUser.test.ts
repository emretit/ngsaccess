import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { publicUserValidator, toPublicUser } from "./publicUser";

describe("toPublicUser", () => {
  it("returns only defined validator fields for a complete user document", () => {
    const user = Object.assign({
      _id: "user-1" as Id<"users">,
      _creationTime: 10,
      email: "person@example.test",
      name: "Person",
      image: "https://example.test/avatar.png",
      emailVerificationTime: 20,
      phone: "+15555550123",
      phoneVerificationTime: 30,
      isAnonymous: false,
      fullName: "Test Person",
      photoUrl: "https://example.test/photo.png",
      role: "project_user" as const,
      verified: true,
      updatedAt: "2030-01-01T00:00:00.000Z",
      setupToken: "secret-token",
      tokenExpiresAt: "2030-01-01T00:00:00.000Z",
      firstCompanyName: "Private company",
    } satisfies Doc<"users">, { futureSensitiveField: "hidden" });

    expect(toPublicUser(user)).toEqual({
      _id: user._id,
      _creationTime: 10,
      email: "person@example.test",
      name: "Person",
      image: "https://example.test/avatar.png",
      emailVerificationTime: 20,
      phone: "+15555550123",
      phoneVerificationTime: 30,
      isAnonymous: false,
      fullName: "Test Person",
      photoUrl: "https://example.test/photo.png",
      role: "project_user",
      verified: true,
      updatedAt: "2030-01-01T00:00:00.000Z",
    });
    expect(toPublicUser(user)).not.toHaveProperty("setupToken");
    expect(toPublicUser(user)).not.toHaveProperty("tokenExpiresAt");
    expect(toPublicUser(user)).not.toHaveProperty("firstCompanyName");
    expect(toPublicUser(user)).not.toHaveProperty("futureSensitiveField");

    const output = toPublicUser(user);
    const allowedFields = Object.keys(publicUserValidator.fields);
    expect(Object.keys(output).every((key) => allowedFields.includes(key))).toBe(true);
    expect(Object.values(output).every((value) => value !== undefined)).toBe(true);
  });
});
