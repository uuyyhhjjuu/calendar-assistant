type ImageTransfer = {
  files: ArrayLike<File>;
  items?: ArrayLike<{ kind: string; type: string; getAsFile: () => File | null }>;
};

// Read only the payload of the user's paste/drop event, never the clipboard API.
export function getCaptureImage(transfer: ImageTransfer): File | null {
  const file = Array.from(transfer.files).find((item) => item.type.startsWith("image/"));
  if (file) return file;
  for (const item of Array.from(transfer.items ?? [])) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const image = item.getAsFile();
      if (image) return image;
    }
  }
  return null;
}
