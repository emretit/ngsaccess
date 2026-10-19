import { describe, expect, it } from "vitest";
import { parseGatewayDeviceList } from "./devices";

describe("gateway/devices - parseGatewayDeviceList", () => {
  it("canli deviceList yanitini (SearchResult.MatchList) cozer", () => {
    const list = parseGatewayDeviceList({
      SearchResult: {
        MatchList: [
          {
            Device: {
              EhomeParams: { EhomeID: "NGS0001" },
              devIndex: "D12D7DAE-9272-394E-9EF2-3807CEC0AA3A",
              devMode: "DS-K1T804AEF",
              devName: "NGS0001",
              devStatus: "online",
              devType: "AccessControl",
            },
          },
          { Device: { devIndex: "X", devStatus: "offline", ipAddress: "10.0.0.5" } },
        ],
        numOfMatches: 2,
        totalMatches: 2,
      },
    });
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      devIndex: "D12D7DAE-9272-394E-9EF2-3807CEC0AA3A",
      devName: "NGS0001",
      ehomeID: "NGS0001",
      online: true,
      model: "DS-K1T804AEF",
    });
    expect(list[1]).toMatchObject({ devIndex: "X", online: false, ipAddress: "10.0.0.5" });
  });

  it("beklenmeyen govdede bos liste doner", () => {
    expect(parseGatewayDeviceList(undefined)).toEqual([]);
    expect(parseGatewayDeviceList({ statusCode: 4, subStatusCode: "invalidContent" })).toEqual([]);
    expect(parseGatewayDeviceList({ SearchResult: { MatchList: [null, {}] } })).toEqual([]);
  });
});
