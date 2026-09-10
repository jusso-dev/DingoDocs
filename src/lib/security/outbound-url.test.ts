import { describe, expect, it, vi } from "vitest";
import { assertPublicHttpUrl, OutboundUrlError } from "./outbound-url";

const publicLookup = vi.fn(async () => [
  { address: "93.184.216.34", family: 4 },
]);

describe("assertPublicHttpUrl", () => {
  it("accepts public HTTPS hosts after DNS resolution", async () => {
    await expect(
      assertPublicHttpUrl("https://hooks.example.test/dingodocs", {
        lookup: publicLookup,
      }),
    ).resolves.toBe("https://hooks.example.test/dingodocs");
  });

  it("rejects private literals, metadata hosts, and credentials", async () => {
    await expect(
      assertPublicHttpUrl("https://127.0.0.1/"),
    ).rejects.toBeInstanceOf(OutboundUrlError);
    await expect(
      assertPublicHttpUrl("https://169.254.169.254/latest/meta-data/"),
    ).rejects.toBeInstanceOf(OutboundUrlError);
    await expect(
      assertPublicHttpUrl("https://10.1.2.3/hook"),
    ).rejects.toBeInstanceOf(OutboundUrlError);
    await expect(
      assertPublicHttpUrl("https://2130706433/"),
    ).rejects.toBeInstanceOf(OutboundUrlError);
    await expect(
      assertPublicHttpUrl("https://user:pass@example.com/"),
    ).rejects.toBeInstanceOf(OutboundUrlError);
    await expect(
      assertPublicHttpUrl("https://metadata.google.internal/"),
    ).rejects.toBeInstanceOf(OutboundUrlError);
    await expect(
      assertPublicHttpUrl("http://example.com/"),
    ).rejects.toBeInstanceOf(OutboundUrlError);
  });

  it("allows loopback HTTP only when explicitly requested", async () => {
    await expect(
      assertPublicHttpUrl("http://127.0.0.1:11434", {
        allowHttp: true,
        allowLoopback: true,
      }),
    ).resolves.toBe("http://127.0.0.1:11434/");
    await expect(
      assertPublicHttpUrl("http://127.0.0.1:11434", { allowHttp: true }),
    ).rejects.toBeInstanceOf(OutboundUrlError);
  });

  it("rejects hosts that resolve to a private address", async () => {
    await expect(
      assertPublicHttpUrl("https://evil.example/", {
        lookup: async () => [{ address: "169.254.169.254", family: 4 }],
      }),
    ).rejects.toBeInstanceOf(OutboundUrlError);
  });
});
