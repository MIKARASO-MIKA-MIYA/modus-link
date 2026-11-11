import { describe, expect, it } from "vitest";
import { inspectFile, MAX_FILE_BYTES } from "@/server/services/attachments";
const pdf = Buffer.from("%PDF-1.7\nSynthetic test attachment\n%%EOF");
describe("Attachment validation", () => {
  it("recognizes allowed signatures independently from client MIME", () => {
    expect(inspectFile("report.pdf", pdf, "application/pdf")).toBe(
      "application/pdf",
    );
    expect(inspectFile("report.PDF", pdf, "")).toBe("application/pdf");
  });
  it("rejects an executable or SVG renamed to an image", () => {
    expect(() =>
      inspectFile(
        "photo.png",
        Buffer.from("<svg onload='alert(1)'/>"),
        "image/png",
      ),
    ).toThrow();
    expect(() =>
      inspectFile("file.pdf", Buffer.from("MZExecutable"), "application/pdf"),
    ).toThrow();
  });
  it("rejects extension and declared MIME mismatches", () => {
    expect(() => inspectFile("report.png", pdf, "image/png")).toThrow();
    expect(() => inspectFile("report.pdf", pdf, "text/html")).toThrow();
  });
  it("bounds size and rejects empty files", () => {
    expect(() =>
      inspectFile("empty.pdf", Buffer.alloc(0), "application/pdf"),
    ).toThrow();
    expect(() =>
      inspectFile(
        "huge.pdf",
        Buffer.alloc(MAX_FILE_BYTES + 1),
        "application/pdf",
      ),
    ).toThrow();
  });
  it("rejects a corrupt Office ZIP without throwing an unhandled buffer exception", () => {
    const zip = Buffer.alloc(30);
    zip.writeUInt32LE(0x04034b50);
    expect(() => inspectFile("report.docx", zip, "")).toThrow("Разрешены");
  });
});
