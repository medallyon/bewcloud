import { Handlers } from 'fresh/server.ts';
import { join } from '@std/path';

import { FreshContextState } from '/lib/types.ts';
import { AppConfig } from '/lib/config.ts';
import { ensureUserPathIsValidAndSecurelyAccessible } from '/lib/models/files.ts';

interface Data {}

export const handler: Handlers<Data, FreshContextState> = {
  async GET(request, context) {
    if (!context.state.user) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/login` } });
    }

    const config = await AppConfig.getConfig();

    // Check if directory downloads are enabled
    if (!config.files?.allowDirectoryDownloads) {
      return new Response('Directory downloads are not enabled', { status: 403 });
    }

    const searchParams = new URL(request.url).searchParams;
    const parentPath = searchParams.get('parentPath') || '/';
    const name = searchParams.get('name');

    if (!name) {
      return new Response('Directory name is required', { status: 400 });
    }

    // Construct the full directory path
    const directoryPath = `${join(parentPath, name)}/`;

    try {
      await ensureUserPathIsValidAndSecurelyAccessible(context.state.user.id, directoryPath);

      // Get the actual filesystem path
      const filesRootPath = config.files?.rootPath || 'data-files';
      const userRootPath = join(filesRootPath, context.state.user.id);
      const fullDirectoryPath = join(userRootPath, directoryPath);

      // Use the zip command to create the archive with streaming
      const zipProcess = new Deno.Command('zip', {
        args: ['-r', '-', '.'],
        cwd: fullDirectoryPath,
        stdout: 'piped',
        stderr: 'piped',
      }).spawn();

      // Get the zip stream from the process stdout
      const zipStream = zipProcess.stdout;

      // Monitor process errors and log them (stream will end on error)
      zipProcess.status.then((status) => {
        if (status.code !== 0) {
          console.error('Zip command failed with code:', status.code);
          // Read stderr for error details
          zipProcess.stderr.getReader().read().then(({ value }) => {
            if (value) {
              console.error('Zip stderr:', new TextDecoder().decode(value));
            }
          });
        }
      }).catch((error) => {
        console.error('Zip process error:', error);
      });

      return new Response(zipStream, {
        status: 200,
        headers: {
          'content-type': 'application/zip',
          'content-disposition': `attachment; filename="${name}.zip"`,
          'cache-control': 'no-cache, no-store, must-revalidate',
        },
      });
    } catch (error) {
      console.error('Error creating directory zip:', error);

      if ((error as Error).message === 'Invalid file path') {
        return new Response('Invalid directory path', { status: 400 });
      }

      return new Response('Error creating zip archive', { status: 500 });
    }
  },
};
