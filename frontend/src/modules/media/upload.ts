"use client";

import { formatBytes } from "@/lib/format";
import { ApiError } from "@/types/api";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/types/media";

/** Longest edge kept for uploads in the mock — keeps data URLs within localStorage limits. */
const MOCK_MAX_EDGE = 1600;

export interface PreparedImage {
  dataUrl: string;
  contentType: string;
  sizeBytes: number;
  width: number;
  height: number;
}

/** Same checks the backend applies, run before upload so errors show instantly. */
export function validateImageFile(file: File): void {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new ApiError("UNSUPPORTED_TYPE", `${file.name}: only JPEG, PNG, WebP and GIF images are supported.`, 415);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new ApiError("FILE_TOO_LARGE", `${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_IMAGE_BYTES)}.`, 413);
  }
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new ApiError("READ_FAILED", "Could not read the file.", 400));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ApiError("INVALID_IMAGE", "The file is not a readable image.", 400));
    img.src = src;
  });
}

/**
 * Validates and, for the mock, downsizes an image to a WebP data URL. GIFs are kept
 * as-is so animations survive. With the real backend only validation remains —
 * the original file is uploaded and the server records its dimensions.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  validateImageFile(file);
  const original = await readAsDataUrl(file);
  const img = await loadImage(original);
  const { naturalWidth: width, naturalHeight: height } = img;

  const scale = Math.min(1, MOCK_MAX_EDGE / Math.max(width, height));
  if (file.type === "image/gif" || (scale === 1 && file.size < 400 * 1024)) {
    return { dataUrl: original, contentType: file.type, sizeBytes: file.size, width, height };
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/webp", 0.85);
  // Base64 inflates by 4/3; this recovers the approximate binary size.
  const sizeBytes = Math.round(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);
  return { dataUrl, contentType: "image/webp", sizeBytes, width: canvas.width, height: canvas.height };
}
