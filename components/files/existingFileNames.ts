import { RequestBody as GetFilesRequestBody, ResponseBody as GetFilesResponseBody } from '/pages/api/files/get.ts';

// A directory's existing file names, used to detect naming conflicts before an upload. Fails open (empty set) on any error, so a check that itself fails doesn't block an upload that turns out fine, or wrongly report a clash.
export async function fetchExistingFileNames(parentPath: string): Promise<Set<string>> {
  try {
    const requestBody: GetFilesRequestBody = { parentPath };

    // Same reasoning as sw.js's fetchForJob: don't let a hung server response block the upload from ever starting.
    const response = await fetch('/api/files/get', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return new Set();
    }

    const result = await response.json() as GetFilesResponseBody;

    return new Set(result.files.map((file) => file.file_name));
  } catch (error) {
    console.error(error);
    return new Set();
  }
}
