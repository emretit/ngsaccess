# W1 backend pass plan
1. Add optional schema fields and hash-only pass/reader-attempt tables; declare deletion policy.
2. Add secure credentials, transactional validation/log/count/lock helper and operator lifecycle API.
3. Route kiosk QR/PIN through helper; preserve employee UUID path.
4. Add cardless visitor creation, bounded pass cascade and focused tests/lint/leak checks.

## W2/W3 API contract
- `visitors.create`: existing args plus `credential?: "card"|"pass"`; `cardNumber?` required for card, generated uint32 for pass; returns visitor employee ID.
- `visitorPasses.issue({visitorId,maxUses?})` / `regenerate({visitorId,maxUses?})`: authenticated visitors.manage; returns `{passId, token, pin}` once. Regenerate rotates both hashes and resets usage; omitted maxUses preserves prior limit on regeneration.
- `visitorPasses.revoke({visitorId})`: returns null; `getForVisitor({visitorId})`: metadata or null, never hashes/secrets.
- `virtualReaders.scan({readerToken,code})`: employee UUID result unchanged; NGSV1 QR uses visitor result below.
- `virtualReaders.scanPin({readerToken,pin})`: visitor result below (reader_invalid for unknown reader).
- `consumeVisitorPass(ctx,device,{source:"qr"|"pin",code})`: one transaction; returns `{status:"denied",reason}` or `{status:"granted",employeeName,direction,accessTime,visitorPassId,visitorId,projectId,doorId}`.
- `doorId` is bound physical door ID or null; W2 loads physical door/device/actuator and dispatches in same mutation using projectId, visitorId and visitorPassId; last allowed entry remains eligible even when pass becomes exhausted.
- Denials: TOKEN_INVALID, READER_INACTIVE, PIN_LOCKED, NOT_ALLOWED, NOT_ACTIVE, NOT_STARTED, EXPIRED, REVOKED, EXHAUSTED; denied readings include reason without raw credential.
- `virtualReaders.create` additionally accepts `doorId?`; validates same project physical door and stores virtualReaderDoorId.
- `virtualReaders.setDoor({deviceId,doorId:Id<"doors">|null})`: devices.manage, same-project door binding or unbind; returns null.
- Visitor list/detail include `visitorCredential` (legacy defaults to card). Schema optional sessionId/authVersion requires W2 to narrow employee operations in `convex/lib/mobileAccess.ts:246`.
- Counts increment only on entry; exit does not increment; exhausted pass rejects subsequent scans. No door dispatch or email in W1.
