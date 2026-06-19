import { describe, expect, it } from "vitest";
import { prepareVerificationToken } from "./emailVerification";

const NOW = Date.parse("2026-06-10T12:00:00.000Z");

describe("prepareVerificationToken", () => {
  it("reuses a token that has more than 15 minutes remaining", () => {
    const expiresAt = "2026-06-10T13:00:00.000Z";

    expect(
      prepareVerificationToken(
        { setupToken: "existing-token", tokenExpiresAt: expiresAt },
        NOW,
        () => "new-token",
      ),
    ).toEqual({
      token: "existing-token",
      expiresAt,
      shouldPersist: false,
    });
  });

  it("replaces a token that is close to expiry", () => {
    expect(
      prepareVerificationToken(
        {
          setupToken: "existing-token",
          tokenExpiresAt: "2026-06-10T12:10:00.000Z",
        },
        NOW,
        () => "new-token",
      ),
    ).toEqual({
      token: "new-token",
      expiresAt: "2026-06-11T12:00:00.000Z",
      shouldPersist: true,
    });
  });

  it("creates a token when none exists", () => {
    expect(prepareVerificationToken({}, NOW, () => "new-token")).toEqual({
      token: "new-token",
      expiresAt: "2026-06-11T12:00:00.000Z",
      shouldPersist: true,
    });
  });
});
