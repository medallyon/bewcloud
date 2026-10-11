import page, { RequestHandlerParams } from '/lib/page.ts';
import { join } from '@std/path';

import { AppConfig } from '/lib/config.ts';
import { ensureFileSharePathIsValidAndSecurelyAccessible, FileShareModel } from '/lib/models/files.ts';
import { zipDirectoryAsResponse } from '/lib/utils/files.ts';

async function get({ request, match }: RequestHandlerParams): Promise<Response> {
  const { fileShareId } = match.pathname.groups;

  if (!fileShareId) {
    throw new Error('NotFound');
  }

  const isPublicFileSharingAllowed = await AppConfig.isPublicFileSharingAllowed();

  if (!isPublicFileSharingAllowed) {
    throw new Error('NotFound');
  }

  if (!(await AppConfig.areDirectoryDownloadsAllowedForPublicShares())) {
    return new Response('Directory downloads are not enabled for public shares', { status: 403 });
  }

  if (!(await AppConfig.isAppEnabled('files'))) {
    throw new Error('NotFound');
  }

  const fileShare = await FileShareModel.getById(fileShareId);

  if (!fileShare) {
    throw new Error('NotFound');
  }

  if (fileShare.extra.hashed_password) {
    const { fileShareId: fileShareIdFromSession, hashedPassword: hashedPasswordFromSession } =
      (await FileShareModel.getDataFromRequest(request)) || {};

    if (
      !fileShareIdFromSession || fileShareIdFromSession !== fileShareId ||
      hashedPasswordFromSession !== fileShare.extra.hashed_password
    ) {
      return new Response('Redirect', { status: 303, headers: { 'Location': `/file-share/${fileShareId}/verify` } });
    }
  }

  const searchParams = new URL(request.url).searchParams;

  let currentPath = searchParams.get('path') || '/';
  const name = searchParams.get('name');

  if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\')) {
    return new Response('Directory name is required', { status: 400 });
  }

  // Send invalid paths back to root
  if (!currentPath.startsWith('/') || currentPath.includes('../')) {
    currentPath = '/';
  }

  // Always append a trailing slash
  if (!currentPath.endsWith('/')) {
    currentPath = `${currentPath}/`;
  }

  try {
    await ensureFileSharePathIsValidAndSecurelyAccessible(fileShare.user_id, fileShare.file_path, currentPath, name);
  } catch (error) {
    if ((error as Error).message === 'Invalid file path') {
      throw new Error('NotFound');
    }

    throw error;
  }

  const fullDirectoryPath = join(
    await AppConfig.getFilesRootPath(),
    fileShare.user_id,
    fileShare.file_path,
    currentPath,
    name,
  );

  try {
    return await zipDirectoryAsResponse(request, fullDirectoryPath, name);
  } catch (error) {
    console.error('Error creating directory zip:', error);

    return new Response('Error creating zip archive', { status: 500 });
  }
}

export default page({
  get,
  accessMode: 'public',
});
