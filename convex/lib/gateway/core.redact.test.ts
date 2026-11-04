import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { gatewayApiCall } from "./core";
import { addDeviceToGateway, setHttpHostForwarding } from "./devices";
const digest = vi.hoisted(() => vi.fn());
vi.mock("../digestAuth", () => ({ digestFetch: digest }));
beforeEach(() => {
  vi.stubEnv("HIK_GATEWAY_HOST", "https://gateway.test");
  vi.stubEnv("HIK_GATEWAY_USER", "user");
  vi.stubEnv("HIK_GATEWAY_PASS", "gateway-secret");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it.each(["0", "1"])("masks registration keys and forwarding tokens even with debug=%s", async debug => {
  vi.stubEnv("HIK_GATEWAY_DEBUG", debug);
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  const secrets = ["ehome-secret", "password-secret", "token-secret", "unknown-echo-secret"];
  const response = { statusCode: 4, EhomeKey: secrets[0], password: secrets[1], URL: `https://app.test/card-reader?token=${secrets[2]}`, unexpectedEcho: secrets[3] };
  digest.mockResolvedValue({ status: debug === "1" ? 200 : 500, body: JSON.stringify(response) });
  await addDeviceToGateway({ devName: "Reader", ehomeID: "device-id", ehomeKey: secrets[0] });
  await setHttpHostForwarding("device", `https://app.test/card-reader?token=${secrets[2]}`);
  await gatewayApiCall(`/ISAPI/Test?token=${secrets[2]}`, "POST", { nested: [response], apiToken: secrets[2], authorization: secrets[1] });
  expect(log).toHaveBeenCalledTimes(3);
  const output = JSON.stringify(log.mock.calls);
  for (const secret of secrets) expect(output).not.toContain(secret);
  expect(output).toContain("***");
  expect(output).toContain("statusCode");
  // The wire payload remains intact; only diagnostic output is projected.
  expect(digest.mock.calls[0][2]).toContain(secrets[0]);
  expect(digest.mock.calls[1][2]).toContain(secrets[2]);
});

it("masks opaque and malformed response text before truncation", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  digest.mockResolvedValue({ status: 500, body: '<EhomeKey>opaque-secret</EhomeKey> https://app.test?token=url-secret' });
  await gatewayApiCall("/ISAPI/Test", "POST", "password=body-secret");
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/opaque-secret|url-secret|body-secret/);
});

it("Y-06 retains bounded diagnostic text while masking tokens, URLs and passwords", async () => {
  vi.stubEnv("HIK_GATEWAY_DEBUG", "1");
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  digest.mockResolvedValue({ status: 500, body: JSON.stringify({ ResponseStatus: {
    statusString: "badParameters", subStatusCode: "deviceUserAlreadyExist", errorCode: "0x001",
    errorMsg: "x".repeat(150), responseStatusStrg: "MORE", token: "private-token", url: "https://private.test", password: "private-password",
  } }) });
  await gatewayApiCall("/ISAPI/Test", "POST", { token: "private-token" });
  const output = JSON.stringify(log.mock.calls);
  expect(output).toContain("badParameters");
  expect(output).toContain("deviceUserAlreadyExist");
  expect(output).toContain("0x001");
  expect(output).toContain("MORE");
  expect(output).toContain("x".repeat(100));
  expect(output).not.toContain("x".repeat(101));
  expect(output).not.toMatch(/private-token|private-password|private\.test/);
});
