import { lookup as defaultLookup } from "node:dns/promises";
import { isIPv4, isIPv6 } from "node:net";

export class OutboundUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutboundUrlError";
  }
}

export type HostLookup = (
  host: string,
  options: { all: true; verbatim: true },
) => Promise<Array<{ address: string; family: number }>>;

export type OutboundUrlOptions = {
  allowHttp?: boolean;
  allowLoopback?: boolean;
  lookup?: HostLookup;
};

const blockedHosts = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.internal",
  "instance-data",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

export const outboundFetchInit = { redirect: "error" as const };

export async function assertPublicHttpUrl(
  value: string,
  options: OutboundUrlOptions = {},
) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new OutboundUrlError("URL is invalid");
  }
  if (url.username || url.password)
    throw new OutboundUrlError("URL must not include credentials");
  if (url.protocol === "http:") {
    if (!options.allowHttp) throw new OutboundUrlError("URL must use HTTPS");
  } else if (url.protocol !== "https:") {
    throw new OutboundUrlError("URL must use HTTP or HTTPS");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const allowLoopback = options.allowLoopback ?? false;
  if (isLoopbackHost(host)) {
    if (!allowLoopback)
      throw new OutboundUrlError("URL cannot target a private network");
  } else if (
    blockedHosts.has(host) ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    throw new OutboundUrlError("URL cannot target a private network");
  }

  const literal = literalIp(host);
  const addresses = literal
    ? [literal]
    : await resolveAddresses(
        host,
        options.lookup ?? (defaultLookup as HostLookup),
      );
  for (const address of addresses) {
    if (isBlockedAddress(address, allowLoopback))
      throw new OutboundUrlError("URL cannot target a private network");
  }
  return url.toString();
}

async function resolveAddresses(host: string, lookupFn: HostLookup) {
  try {
    const records = await lookupFn(host, { all: true, verbatim: true });
    const addresses = records.map((record) => record.address);
    if (!addresses.length)
      throw new OutboundUrlError("URL host could not be resolved");
    return addresses;
  } catch (error) {
    if (error instanceof OutboundUrlError) throw error;
    throw new OutboundUrlError("URL host could not be resolved");
  }
}

function literalIp(host: string) {
  if (isIPv4(host) || isIPv6(host)) return host;
  if (/^\d+$/.test(host)) {
    const value = Number(host);
    if (value >= 0 && value <= 0xffffffff)
      return [
        (value >>> 24) & 255,
        (value >>> 16) & 255,
        (value >>> 8) & 255,
        value & 255,
      ].join(".");
  }
  if (/^0x[0-9a-f]+$/i.test(host)) {
    const value = Number.parseInt(host, 16);
    if (value >= 0 && value <= 0xffffffff)
      return [
        (value >>> 24) & 255,
        (value >>> 16) & 255,
        (value >>> 8) & 255,
        value & 255,
      ].join(".");
  }
  return null;
}

function isLoopbackHost(host: string) {
  return (
    host === "localhost" ||
    host === "localhost.localdomain" ||
    host.endsWith(".localhost") ||
    host === "::1" ||
    isLoopbackIPv4(host)
  );
}

function isLoopbackIPv4(ip: string) {
  if (!isIPv4(ip)) return false;
  return ip.split(".").map(Number)[0] === 127;
}

function isBlockedAddress(address: string, allowLoopback: boolean) {
  if (isIPv4(address)) {
    if (isLoopbackIPv4(address)) return !allowLoopback;
    return isPrivateIPv4(address);
  }
  if (isIPv6(address)) {
    const mapped = ipv4Mapped(address);
    if (mapped) return isBlockedAddress(mapped, allowLoopback);
    if (address === "::1" || address === "::") return !allowLoopback;
    return isPrivateIPv6(address);
  }
  return true;
}

function isPrivateIPv4(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return a >= 224;
}

function isPrivateIPv6(ip: string) {
  const value = ip.toLowerCase();
  if (value === "::" || value === "::1") return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true;
  if (/^fe[89ab]/i.test(value)) return true;
  return value.startsWith("ff");
}

function ipv4Mapped(ip: string) {
  const value = ip.toLowerCase();
  if (value.startsWith("::ffff:")) return value.slice("::ffff:".length);
  return null;
}
