/**
 * Basic SSRF guard for the same-origin image proxy: reject hostnames that
 * resolve to the local machine or a private/reserved network so the proxy
 * can't be used to reach internal services. Purely lexical — it blocks
 * obvious localhost/`.local` names and bare IPs in private/reserved ranges
 * (it does not resolve DNS).
 */
export function isBlockedHost(hostname: string): boolean {
  let h = hostname.toLowerCase().trim();
  // Drop a trailing dot (FQDN root) and IPv6 brackets.
  h = h.replace(/\.$/, "");
  if (h.startsWith("[") && h.endsWith("]")) {
    h = h.slice(1, -1);
  }

  if (h === "" || h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "local" || h.endsWith(".local")) return true;

  // IPv6 loopback / unspecified.
  if (h === "::1" || h === "::" || h === "0:0:0:0:0:0:0:1") return true;

  // IPv4 private / reserved ranges.
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if ([a, b, Number(ipv4[3]), Number(ipv4[4])].some((n) => n > 255)) {
      return false;
    }
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local
    if (a === 192 && b === 168) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
  }

  return false;
}
