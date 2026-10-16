/**
 * `/card-reader` kimlik doğrulama kararı (saf — ctx yok).
 *
 * Token'sız istek eskiden body serial/IP lookup'ına düşüyordu → seri numarasını bilen
 * herkes sahte PDKS kaydı yazabiliyordu. Artık üç kabul yolu var:
 *  1. Cihaz token'ı: `Authorization: Bearer <token>` veya `?token=<token>`
 *     (Hikvision httpHosts / gateway forwarding özel header gönderemez → URL).
 *  2. Güvenilir relay (Hetzner nginx köprüsü, Hik gateway alarm forwarding gibi çok-cihazlı
 *     aktarıcılar): `X-Relay-Secret` header'ı veya `?relay=` = `CARD_READER_RELAY_SECRET`.
 *     Relay arkasındaki cihaz body serial/IP/devIndex ile çözülür.
 *  3. Geçiş dönemi: `CARD_READER_ALLOW_UNAUTHENTICATED=1` ise eski davranış (uyarı loglanır).
 * Hiçbiri yoksa → reddet. Varsayılan KAPALI (env set değilse token şart).
 */

export type CardReaderAuth =
  | { kind: "token"; token: string }
  | { kind: "relay" }
  | { kind: "legacy" }
  | { kind: "reject"; reason: "missing_credentials" };

export interface CardReaderAuthInput {
  authorizationHeader: string | null;
  queryToken: string | null;
  relayHeader: string | null;
  queryRelay: string | null;
  relaySecret: string | undefined;
  allowUnauthenticated: string | undefined;
}

const nonEmpty = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export function resolveCardReaderAuth(input: CardReaderAuthInput): CardReaderAuth {
  const header = input.authorizationHeader ?? "";
  const bearer = header.startsWith("Bearer ") ? nonEmpty(header.slice(7)) : null;
  const token = bearer ?? nonEmpty(input.queryToken);
  // Token verildiyse karar token'a aittir: geçersiz token relay/legacy'ye DÜŞMEZ.
  if (token) return { kind: "token", token };

  const relaySecret = nonEmpty(input.relaySecret);
  const presentedRelay = nonEmpty(input.relayHeader) ?? nonEmpty(input.queryRelay);
  if (relaySecret && presentedRelay === relaySecret) return { kind: "relay" };

  if (input.allowUnauthenticated === "1") return { kind: "legacy" };

  return { kind: "reject", reason: "missing_credentials" };
}

/** Forwarding URL'ine cihaz token'ını `?token=` olarak ekler (mevcut query korunur). */
export function withDeviceToken(forwardUrl: string, token: string): string {
  const url = new URL(forwardUrl);
  url.searchParams.set("token", token);
  return url.toString();
}
