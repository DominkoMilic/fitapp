/** Web: nothing is kept on disk. */
export async function clearExportFiles(): Promise<void> {}

/** Web: download the file through a temporary link. */
export async function shareJsonFile(name: string, content: string): Promise<void> {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
