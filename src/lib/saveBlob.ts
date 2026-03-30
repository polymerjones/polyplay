import { isDesktopSafari } from "./platform";

export type SaveBlobMode = "shared" | "save-dialog" | "downloaded" | "opened-preview";

type SaveBlobOptions = {
  accept?: Record<string, string[]>;
  description?: string;
};

type SaveFilenamePromptOptions = {
  message?: string;
  requiredExtension?: string;
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
  const previewFile =
    typeof File !== "undefined" ? new File([blob], filename, { type: blob.type || "application/octet-stream" }) : blob;
  const url = URL.createObjectURL(previewFile);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.setAttribute("aria-label", `Open preview for ${filename}`);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function sanitizeFilenameInput(value: string): string {
  return value
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function getFilenameExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === filename.length - 1) return "";
  return filename.slice(lastDot);
}

export function promptForSaveFilename(
  initialFilename: string,
  options?: SaveFilenamePromptOptions
): string | null {
  const response = window.prompt(options?.message || "Name this file before saving.", initialFilename);
  if (response === null) return null;
  const sanitized = sanitizeFilenameInput(response);
  if (!sanitized) return null;
  const requiredExtension = options?.requiredExtension || getFilenameExtension(initialFilename);
  if (!requiredExtension) return sanitized;
  return sanitized.toLowerCase().endsWith(requiredExtension.toLowerCase())
    ? sanitized
    : `${sanitized}${requiredExtension}`;
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

  if (!isDesktopSafari() && typeof nav.share === "function" && typeof File !== "undefined") {
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
            description: options?.description || "PolyPlay Export",
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
