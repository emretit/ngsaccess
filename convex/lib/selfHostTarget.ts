/** Both operator opt-in and an exact acknowledgement of this deployment are required. */
export function requireSelfHostTarget(confirmHost: string | undefined): URL {
  const value = process.env.CONVEX_SITE_URL;
  if (process.env.SELF_HOST_TARGET !== "1" || !value) throw new Error("Self-host hedef kilidi: SELF_HOST_TARGET=1 gerekli");
  const site = new URL(value);
  if (site.protocol !== "https:" || site.username || site.password || site.search || site.hash ||
      (site.pathname !== "/" && site.pathname !== "") ||
      /(^|\.)convex\.(cloud|site)$/i.test(site.hostname) || confirmHost !== site.host) {
    throw new Error("Self-host hedef kilidi: confirmHost bu self-host deployment ile eşleşmeli");
  }
  return site;
}
