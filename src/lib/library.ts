import { loadLibraryFromAppSourceOfTruth } from "./db";
import {
  getLibraryCandidates,
  LIBRARY_KEY,
  LIBRARY_STORAGE_KEY,
  migrateBestLibraryCandidateToPrimary,
  migrateLibraryIfNeeded,
  saveLibrary,
  type LibraryState
} from "./storage/library";

export { LIBRARY_KEY };

export async function getLibrary(): Promise<LibraryState> {
  return loadLibraryFromAppSourceOfTruth();
}

export function setLibrary(library: LibraryState): void {
  saveLibrary(library);
}

export function getLibraryKeyUsed(): string {
  return LIBRARY_KEY || LIBRARY_STORAGE_KEY;
}

export function normalizeLibrary(input: unknown): LibraryState {
  return migrateLibraryIfNeeded(input);
}

export function getLibraryStorageCandidates() {
  return getLibraryCandidates();
}

export function migrateLegacyLibraryKeys() {
  return migrateBestLibraryCandidateToPrimary();
}
