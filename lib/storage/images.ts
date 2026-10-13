import "server-only";
import sharp from "sharp";
import type { StoredFile } from "./index";

/** Widths served by /fichiers?l=…; anything else gets the original. */
export const WIDTHS = [160, 320, 640, 1280, 2048] as const;

const RASTER = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isRaster(contentType: string) {
  return RASTER.has(contentType);
}

export function variantKey(key: string, width: number) {
  return `tailles/${width}/${key.replace(/\.[a-z0-9]+$/i, "")}.webp`;
}

/** A smaller copy for the screen, turned the right way up. */
export async function resize(
  file: StoredFile,
  width: number,
): Promise<StoredFile> {
  const data = await sharp(file.data)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  return { data, contentType: "image/webp" };
}

export type Ingested = {
  data: Buffer;
  width: number;
  height: number;
  contentType: string;
  extension: string;
};

/**
 * A photo as it arrives from a phone or a scanner: checked to be an image,
 * turned upright, at most 3 200 pixels wide, and stripped of its metadata
 * (the GPS position of a family home has nothing to do on the site).
 */
export async function ingest(input: Buffer): Promise<Ingested | null> {
  try {
    const image = sharp(input, { failOn: "error" });
    const meta = await image.metadata();
    if (
      !meta.format ||
      !["jpeg", "png", "webp", "heif", "avif", "tiff"].includes(meta.format)
    )
      return null;
    const keepPng = meta.format === "png" && meta.hasAlpha;
    const pipeline = image.rotate().resize({
      width: 3200,
      height: 3200,
      fit: "inside",
      withoutEnlargement: true,
    });
    const { data, info } = keepPng
      ? await pipeline.png().toBuffer({ resolveWithObject: true })
      : await pipeline
          .jpeg({ quality: 88, mozjpeg: true })
          .toBuffer({ resolveWithObject: true });
    return {
      data,
      width: info.width,
      height: info.height,
      contentType: keepPng ? "image/png" : "image/jpeg",
      extension: keepPng ? "png" : "jpg",
    };
  } catch {
    return null;
  }
}
