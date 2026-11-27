import { expect, it } from "vitest";
import { toPdksTransport } from "./pdksTransport";
import { classifyReadingSource, filterPdksReadings } from "./pdksSource";
import type { Doc } from "../_generated/dataModel";
it.each([
  { cardNo: "1", rawData: '{"payload":{"method":"pin"},"transaction":{"type":"access_event"}}' },
  { cardNo: "1", rawData: '{"user_id":"12345678-1234-1234-1234-123456789abc"}' },
  { cardNo: "1", rawData: '<EventNotificationAlert><majorEventType>5</majorEventType><subEventType>75</subEventType></EventNotificationAlert>' },
  { cardNo: "1", rawData: '{"source":"manual"}' },
  { cardNo: "1", hikCurrentVerifyMode: "face" },
  { cardNo: "1", hikCurrentVerifyMode: "unrecognized", hikDevIndex: "device" },
])("normalization preserves source/checkpoint decisions without transporting raw body: %s", values => {
  const raw = { _id: "reading", _creationTime: 0, projectId: "project", accessTime: "2026-06-01T05:00:00Z", direction: "entry", ...values } as Doc<"cardReadings">;
  const compact = toPdksTransport(raw);
  expect(compact).not.toHaveProperty("rawData");
  expect(classifyReadingSource(compact)).toBe(classifyReadingSource(raw));
  expect(filterPdksReadings([compact]).length).toBe(filterPdksReadings([raw]).length);
});
