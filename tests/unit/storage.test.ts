import { describe, expect, it } from "vitest";
import { contentTypeOf, isSafeKey } from "@/lib/storage";
import { variantKey } from "@/lib/storage/images";

describe("storage keys", () => {
  it("accept the paths the site writes", () => {
    expect(isSafeKey("photos/2026/0a1b2c3d.jpg")).toBe(true);
    expect(isSafeKey("tailles/640/photos/2026/0a1b2c3d.webp")).toBe(true);
  });

  it("refuse anything that could leave the storage folder", () => {
    for (const key of [
      "../secret",
      "photos/../../etc/passwd",
      "/etc/passwd",
      "photos//x.jpg",
      "",
      "photos/./x",
      "a\\b",
    ]) {
      expect(isSafeKey(key), key).toBe(false);
    }
  });

  it("name resized copies apart from the originals", () => {
    expect(variantKey("photos/2026/abc.jpg", 640)).toBe(
      "tailles/640/photos/2026/abc.webp",
    );
    expect(contentTypeOf("photos/x.JPG")).toBe("image/jpeg");
    expect(contentTypeOf("armes/x.svg")).toBe("image/svg+xml");
  });
});
