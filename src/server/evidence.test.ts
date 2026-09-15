import { describe, expect, it } from "vitest";

import {
  MAX_PRIVATE_EVIDENCE_BYTES,
  detectEvidenceMimeType,
  normalizeEvidenceFilename,
  prepareEvidenceUpload,
  sha256,
} from "@/server/evidence";

const matterId = "11111111-1111-4111-8111-111111111111";

describe("private evidence validation", () => {
  it("records a server-generated key, normalized display name, and hash", () => {
    const prepared = prepareEvidenceUpload({
      matterId,
      originalFilename: "..\\client\u0000 notes.txt",
      declaredMimeType: "text/plain",
      bytes: new TextEncoder().encode("Signed acknowledgement"),
    });

    expect(prepared.objectPath).toMatch(new RegExp(`^${matterId}/[0-9a-f-]{36}$`));
    expect(prepared.originalFilename).toBe("client notes.txt");
    expect(prepared.sha256).toBe(sha256(new TextEncoder().encode("Signed acknowledgement")));
  });

  it("recognizes allowed binary signatures rather than trusting Content-Type", () => {
    expect(detectEvidenceMimeType(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe("application/pdf");
    expect(detectEvidenceMimeType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectEvidenceMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
  });

  it("rejects a spoofed MIME type and non-text binary payload", () => {
    expect(() =>
      prepareEvidenceUpload({
        matterId,
        originalFilename: "not-really.txt",
        declaredMimeType: "text/plain",
        bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      }),
    ).toThrow(/declared MIME type/i);

    expect(() =>
      prepareEvidenceUpload({
        matterId,
        originalFilename: "unknown.bin",
        declaredMimeType: "text/plain",
        bytes: new Uint8Array([0, 1, 2]),
      }),
    ).toThrow();
  });

  it("enforces the conservative free-tier evidence cap", () => {
    expect(() =>
      prepareEvidenceUpload({
        matterId,
        originalFilename: "large.txt",
        declaredMimeType: "text/plain",
        bytes: new Uint8Array(MAX_PRIVATE_EVIDENCE_BYTES + 1).fill(0x61),
      }),
    ).toThrow(/limited/i);
  });

  it("normalizes hostile or empty filenames without using them in object keys", () => {
    expect(normalizeEvidenceFilename("  ../../  ")).toBe("evidence");
    expect(normalizeEvidenceFilename("a\n\tb.pdf")).toBe("ab.pdf");
  });
});
