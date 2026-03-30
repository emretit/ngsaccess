declare global {
  var process: {
    env: Record<string, string | undefined>;
  };
  var crypto: typeof import("crypto");
}
export {};
