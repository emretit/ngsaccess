declare const process: {
  env: Record<string, string | undefined>;
};

declare const crypto: {
  randomUUID(): string;
  getRandomValues<T extends ArrayBufferView>(array: T): T;
  subtle: SubtleCrypto;
};
