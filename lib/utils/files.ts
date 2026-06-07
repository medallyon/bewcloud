export async function zipDirectoryAsResponse(fullDirectoryPath: string, name: string): Promise<Response> {
  const zipProcess = new Deno.Command('zip', {
    args: ['-r', '-', '.'],
    cwd: fullDirectoryPath,
    stdout: 'piped',
    stderr: 'piped',
  });

  const { code, stdout, stderr } = await zipProcess.output();

  if (code !== 0) {
    const errorText = new TextDecoder().decode(stderr);

    console.error('Zip command failed:', errorText);

    return new Response('Error creating zip archive', { status: 500 });
  }

  return new Response(stdout, {
    status: 200,
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${name}.zip"`,
      'cache-control': 'no-cache, no-store, must-revalidate',
    },
  });
}
