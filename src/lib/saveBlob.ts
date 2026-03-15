export type SaveBlobMode = "shared" | "save-dialog" | "downloaded" | "opened-preview";

type SaveBlobOptions = {
  accept?: Record<string, string[]>;
  description?: string;
};

function isIosLikeDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document);
}

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  if (standaloneNavigator.standalone) return true;
  return typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches;
}

function downloadBlobFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function openBlobPreview(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function saveBlobWithBestEffort(
  blob: Blob,
  filename: string,
  options?: SaveBlobOptions
): Promise<SaveBlobMode> {
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { title?: string; text?: string; files?: File[] }) => Promise<void>;
  };

  if (typeof nav.share === "function" && typeof File !== "undefined") {
    try {
      const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
      if (!nav.canShare || nav.canShare({ files: [file] })) {
        await nav.share({ title: filename, files: [file] });
        return "shared";
      }
    } catch {
      // Continue through save fallbacks if the share sheet is canceled or unavailable.
    }
  }

  const pickerHost = window as typeof window & {
    showSaveFilePicker?: (options: {
      suggestedName?: string;
      types?: Array<{ description?: string; accept: Record<string, string[]> }>;
    }) => Promise<{
      createWritable: () => Promise<{
        write: (data: Blob) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  };

  if (typeof pickerHost.showSaveFilePicker === "function") {
    try {
      const handle = await pickerHost.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: options?.description || "Polyplay Export",
            accept: options?.accept || { "application/octet-stream": [".bin"] }
          }
        ]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "save-dialog";
    } catch {
      // Continue through browser fallbacks if the picker is canceled or unsupported.
    }
  }

  if (isIosLikeDevice() || isStandalonePwa()) {
    openBlobPreview(blob, filename);
    return "opened-preview";
  }

  downloadBlobFile(blob, filename);
  return "downloaded";
}

export async function saveTextWithBestEffort(
  content: string,
  filename: string,
  mime: string,
  options?: SaveBlobOptions
): Promise<SaveBlobMode> {
  const blob = new Blob([content], { type: mime });
  return saveBlobWithBestEffort(blob, filename, options);
}
