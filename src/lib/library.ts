import { loadLibraryFromAppSourceOfTruth } from "./db";
import {
  LIBRARY_STORAGE_KEY,
  migrateLibraryIfNeeded,
  saveLibrary,
  type LibraryState
} from "./storage/library";

export async function getLibrary(): Promise<LibraryState> {
  return loadLibraryFromAppSourceOfTruth();
}

export function setLibrary(library: LibraryState): void {
  saveLibrary(library);
}

export function getLibraryKeyUsed(): string {
  return LIBRARY_STORAGE_KEY;
}

export function normalizeLibrary(input: unknown): LibraryState {
  return migrateLibraryIfNeeded(input);
}
