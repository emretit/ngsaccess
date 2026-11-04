import { describe, expect, it, vi } from "vitest";
import { validateIsapiResult } from "./isapiResult";
import { searchAcsEventsOnDevice } from "./events";
import { deleteDeviceFromGateway, remoteDoorControl } from "./devices";
import { gatewayApiCall } from "./core";
import { runRemoteOpenDoor, runRemoveDeviceFromGateway } from "../gatewayCommand";
import type { ActionCtx } from "../../_generated/server";
import type { Doc, Id } from "../../_generated/dataModel";
import { getFunctionName } from "convex/server";

vi.mock("./core", async original => ({
  ...await original<typeof import("./core")>(), gatewayApiCall: vi.fn(),
}));

describe("CIH-05 ISAPI response validation", () => {
  it.each([
    { statusCode: 4, subStatusCode: "badParameters" },
    { statusCode: 1, subStatusCode: "badParameters" },
    { statusCode: 4, subStatusCode: "ok", statusString: "OK" },
    { ResponseStatus: { statusCode: 4 } },
    {}, null, "not JSON",
  ])("rejects failed and missing acknowledgments: %j", async data => {
    vi.mocked(gatewayApiCall).mockResolvedValue({ status: 200, data, raw: JSON.stringify(data) });
    expect(await deleteDeviceFromGateway("index")).toMatchObject({ ok: false });
    expect(await remoteDoorControl("index", 1, "open")).toMatchObject({ ok: false });
    expect(await searchAcsEventsOnDevice("index", { searchID: "search", position: 30 })).toMatchObject({ ok: false, nextPosition: 30 });
  });

  it.each([
    { statusCode: 1, subStatusCode: "ok" },
    { ResponseStatus: { statusCode: "1", subStatusCode: "OK" } },
  ])("accepts explicit successful acknowledgments: %j", data => {
    expect(validateIsapiResult({ status: 200, data }).ok).toBe(true);
    expect(validateIsapiResult({ status: 500, data }).ok).toBe(false);
    expect(validateIsapiResult({ status: 200, data }, "AcsEvent").ok).toBe(false);
  });

  it.each([
    {}, { numOfMatches: 1 }, { numOfMatches: 0, InfoList: "bad" },
    { numOfMatches: -1 },
    { numOfMatches: 0, responseStatusStrg: "MORE" },
  ])("rejects malformed event pages without moving the position: %j", AcsEvent => {
    vi.mocked(gatewayApiCall).mockResolvedValue({ status: 200, data: { AcsEvent }, raw: "" });
    return expect(searchAcsEventsOnDevice("index", { searchID: "s", position: 7 }))
      .resolves.toMatchObject({ ok: false, nextPosition: 7, events: [] });
  });

  // Y-01: row validation cannot pin an otherwise complete page forever.
  it.each([{}, { serialNo: 1, time: "2026-11-03T12:00:00Z", major: "invalid", minor: 75 }])(
    "counts and skips malformed rows while preserving raw page pagination: %j", async row => {
      vi.mocked(gatewayApiCall).mockResolvedValue({ status: 200, data: { AcsEvent: { numOfMatches: 1, InfoList: [row] } }, raw: "" });
      expect(await searchAcsEventsOnDevice("index", { searchID: "s", position: 7 }))
        .toMatchObject({ ok: true, nextPosition: 8, events: [], skipped: 1 });
    },
  );

  it("accepts a genuine empty event search", async () => {
    vi.mocked(gatewayApiCall).mockResolvedValue({ status: 200, data: { AcsEvent: { numOfMatches: 0, responseStatusStrg: "NO MATCH" } }, raw: "" });
    expect(await searchAcsEventsOnDevice("index", { searchID: "s", position: 7 })).toMatchObject({ ok: true, hasMore: false, nextPosition: 7 });
  });

  it.each(["remove", "open"])("propagates rejection through %s command and preserves the device binding", async command => {
    const device = { _id: "device", projectId: "project", hikDevIndex: "index", hikTransport: "gateway" };
    const runQuery = vi.fn(async (ref: Parameters<typeof getFunctionName>[0]) => {
      const name = getFunctionName(ref);
      if (name.endsWith(":getByIdInternal")) return device;
      return name.endsWith(":listProjectIdsForCurrentUser") ? ["project"] : true;
    });
    const runMutation = vi.fn();
    const ctx = { runQuery, runMutation, user: { _id: "user" } } as unknown as ActionCtx & { user: Doc<"users"> };
    vi.mocked(gatewayApiCall).mockResolvedValue({ status: 200, data: { statusCode: 4, subStatusCode: "badParameters" }, raw: "" });
    const run = command === "remove" ? runRemoveDeviceFromGateway : runRemoteOpenDoor;
    expect(await run(ctx, { deviceId: "device" as Id<"devices"> })).toMatchObject({ ok: false });
    expect(runMutation).toHaveBeenCalledTimes(1);
    expect(getFunctionName(runMutation.mock.calls[0][0])).toBe("deviceEvents:recordOperationInternal");
    expect(runMutation.mock.calls[0][1]).toMatchObject({ ok: false });
    expect(device.hikDevIndex).toBe("index");
  });
});
