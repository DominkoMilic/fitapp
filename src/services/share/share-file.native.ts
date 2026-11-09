import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Writes the file to the cache and opens the OS share sheet (save to Files, AirDrop, email…). */
export async function shareJsonFile(name: string, content: string): Promise<void> {
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
