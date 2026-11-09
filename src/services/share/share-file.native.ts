import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const EXPORT_PREFIX = 'pace-export-';

/** Deletes earlier exports from the app cache (they contain all of a user's data). */
export async function clearExportFiles(): Promise<void> {
  for (const entry of Paths.cache.list()) {
    if (entry instanceof File && entry.name.startsWith(EXPORT_PREFIX)) {
      try {
        entry.delete();
      } catch {
        // Already gone.
      }
    }
  }
}

/** Writes the file to the cache and opens the OS share sheet (save to Files, AirDrop, email…). */
export async function shareJsonFile(name: string, content: string): Promise<void> {
  await clearExportFiles();
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(content);
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing_unavailable');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Your PACE data',
  });
}
