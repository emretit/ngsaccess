import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MultipartStreamParser, digestAuthorization, parseDigestChallenge, resolveToken, shouldForward, toCardReaderBody, withTimeOffset,
} from './bridge.mjs';
import { parseCardReaderBody } from '../../convex/lib/cardReaderParse.ts';

// Canlı yakalandı 2026-10-19 (DS-K1T804AEF FW V1.4.0, gateway V1.8.0.4 subscribeDeviceMgmt).
const cardAlert = {
  AccessControllerEvent: {
    PurePwdVerifyEnable: true, RetransFlag: 0, attendanceStatus: 'undefined', cardNo: '0008463106', cardReaderNo: 1,
    cardType: 1, currentEvent: false, doorNo: 1, frontSerialNo: 265, majorEventType: 5, serialNo: 266, subEventType: 9,
  },
  activePostCount: 1, channelID: '1', channelName: 'Channel 1', dateTime: '2026-10-19T18:12:13+00:00',
  devIndex: 'D12D7DAE-9272-394E-9EF2-3807CEC0AA3A', deviceID: 'NGS0001', deviceSerial: 'FK5305278',
  eventDescription: 'Access Controller Event', eventState: 'active', eventType: 'AccessControllerEvent',
};

function part(json) {
  const body = Buffer.from(JSON.stringify(json));
  return Buffer.concat([
    Buffer.from(`--boundary\r\nContent-Type: application/json; charset="UTF-8"\r\nContent-Length: ${body.length}\r\n\r\n`),
    body,
    Buffer.from('\r\n'),
  ]);
}

test('multipart parser parçaları chunk sınırlarından bağımsız çözer', () => {
  const stream = Buffer.concat([
    part({ SubscribeDeviceMgmtRsp: { id: 1 } }),
    part({ EventNotificationAlert: { eventType: 'heartBeat' } }),
    part({ EventNotificationAlert: { ...cardAlert, channelName: 'Kapı ğüşİ' } }),
  ]);
  for (const size of [1, 7, 64, stream.length]) {
    const parts = [];
    const parser = new MultipartStreamParser('boundary', (body) => parts.push(JSON.parse(body)));
    for (let i = 0; i < stream.length; i += size) parser.push(stream.subarray(i, i + size));
    assert.equal(parts.length, 3, `chunk=${size}`);
    assert.equal(parts[0].SubscribeDeviceMgmtRsp.id, 1);
    assert.equal(parts[2].EventNotificationAlert.channelName, 'Kapı ğüşİ');
  }
});

test('Content-Length yoksa bir sonraki boundary’ye kadar okur', () => {
  const parts = [];
  const parser = new MultipartStreamParser('b', (body) => parts.push(body));
  parser.push(Buffer.from('--b\r\nContent-Type: application/json\r\n\r\n{"a":1}\r\n--b\r\nContent-Type: application/json\r\n\r\n'));
  assert.deepEqual(parts, ['{"a":1}']);
});

test('digest yanıtı RFC 2617 örneğiyle eşleşir', () => {
  const challenge = parseDigestChallenge('Digest realm="testrealm@host.com", qop="auth,auth-int", nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093", opaque="5ccc069c403ebaf9f0171e9517f40e41"');
  const header = digestAuthorization({
    challenge, username: 'Mufasa', password: 'Circle Of Life', method: 'GET', uri: '/dir/index.html', cnonce: '0a4f113b',
  });
  assert.match(header, /response="6629fae49393a05397450978507c4ef1"/);
  assert.match(header, /opaque="5ccc069c403ebaf9f0171e9517f40e41"/);
});

test('yaş filtresi eski geri-basılan kayıtları düşürür, canlıyı iletir', () => {
  const now = Date.parse('2026-10-19T15:40:00Z');
  const maxAgeMs = 24 * 3600_000;
  assert.deepEqual(shouldForward(cardAlert, { now, maxAgeMs }), { forward: true });
  assert.equal(shouldForward({ ...cardAlert, dateTime: '1970-01-01T00:00:11+00:00' }, { now, maxAgeMs }).reason, 'too_old');
  assert.equal(shouldForward({ eventType: 'devStatusChanged' }, { now, maxAgeMs }).reason, 'not_access_event');
  assert.equal(shouldForward({ ...cardAlert, dateTime: 'bozuk' }, { now, maxAgeMs }).forward, true);
});

test('gateway’in +00:00 etiketi yapılandırılan offset ile değiştirilir', () => {
  assert.equal(withTimeOffset('2026-10-19T19:20:42+00:00', '+03:00'), '2026-10-19T19:20:42+03:00');
  assert.equal(withTimeOffset('2026-10-19T19:20:42Z', '+03:00'), '2026-10-19T19:20:42+03:00');
  assert.equal(withTimeOffset('2026-10-19T19:20:42', '+03:00'), '2026-10-19T19:20:42+03:00');
  assert.equal(withTimeOffset('2026-10-19T19:20:42+00:00', undefined), '2026-10-19T19:20:42+00:00');
  assert.equal(withTimeOffset('bozuk', '+03:00'), 'bozuk');
});

test('token devIndex, yoksa ehomeID ile çözülür', () => {
  assert.equal(resolveToken({ 'D12D7DAE-9272-394E-9EF2-3807CEC0AA3A': 't1' }, cardAlert), 't1');
  assert.equal(resolveToken({ NGS0001: 't2' }, cardAlert), 't2');
  assert.equal(resolveToken({}, cardAlert), null);
});

test('köprü gövdesi /card-reader parser’ında cihaz seri no + kart no verir', () => {
  const parsed = parseCardReaderBody(JSON.stringify(toCardReaderBody(cardAlert)), 'application/json');
  assert.equal(parsed.user_id, '0008463106');
  assert.equal(parsed.serial, 'FK5305278');
  assert.equal(parsed.hikDevIndex, 'D12D7DAE-9272-394E-9EF2-3807CEC0AA3A');
  assert.equal(parsed.hikEhomeID, 'NGS0001');
  assert.equal(parsed.hikMajorEventType, 5);
  assert.equal(parsed.hikSubEventType, 9);
  assert.equal(parsed.hikSerialNo, 266);
  assert.equal(parsed.hikFrontSerialNo, 265);
});

test('ham gateway gövdesinde parser seri no yerine event sıra no okur (köprü dönüşümünün gerekçesi)', () => {
  const parsed = parseCardReaderBody(JSON.stringify({ EventNotificationAlert: cardAlert }), 'application/json');
  assert.equal(parsed.serial, '266');
});

test('kartsız erişim event’i cihaz seri no ile ayrıştırılır', () => {
  const doorEvent = {
    ...cardAlert,
    AccessControllerEvent: { currentEvent: true, doorNo: 1, frontSerialNo: 1, majorEventType: 5, serialNo: 2, subEventType: 27 },
  };
  const parsed = parseCardReaderBody(JSON.stringify(toCardReaderBody(doorEvent)), 'application/json');
  assert.equal(parsed.user_id, undefined);
  assert.equal(parsed.serial, 'FK5305278');
  assert.equal(parsed.hikMajorEventType, 5);
  assert.equal(parsed.hikSubEventType, 27);
});
