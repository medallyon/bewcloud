export async function fetchExistingFileNames(parentPath) {
  try {
    const requestBody = {
      parentPath
    };
    const response = await fetch('/api/files/get', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) {
      return new Set();
    }
    const result = await response.json();
    return new Set(result.files.map(file => file.file_name));
  } catch (error) {
    console.error(error);
    return new Set();
  }
}