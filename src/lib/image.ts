"use client";
/**
 * Shrink a photo in the browser before upload: max 640px on the long side, JPEG ~0.82.
 * A 4 MB phone photo becomes ~60–120 KB — quick on mobile data and kind to free storage.
 * Also drops EXIF data (GPS location etc.) because the image is re-drawn on a canvas.
 */
export async function shrinkPhoto(file: File, max = 640): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("not_image");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("unreadable");
  }
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("unreadable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
  if (!blob) throw new Error("unreadable");
  return blob;
}
