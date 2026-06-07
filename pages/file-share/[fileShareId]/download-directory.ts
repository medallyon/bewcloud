import page, { RequestHandlerParams } from '/lib/page.ts';
import { join, resolve } from '@std/path';

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

  if (!name) {
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

  // Confirm that currentPath is not _outside_ the fileShare.file_path
  await ensureFileSharePathIsValidAndSecurelyAccessible(fileShare.user_id, fileShare.file_path, currentPath);

  const isFileSharePathDirectory = fileShare.file_path.endsWith('/');

  const filesRootPath = await AppConfig.getFilesRootPath();
  const userRootPath = join(filesRootPath, fileShare.user_id);

  // The share root on disk is always the directory containing (or being) the shared path
  const shareRootOnDisk = isFileSharePathDirectory
    ? `${resolve(join(userRootPath, fileShare.file_path))}/`
    : `${resolve(join(userRootPath, `${fileShare.file_path.split('/').slice(0, -1).join('/')}/`))}/`;

  // Build the full filesystem path to the requested directory
  const shareBasePath = isFileSharePathDirectory
    ? join(userRootPath, fileShare.file_path, currentPath, name)
    : join(userRootPath, `${fileShare.file_path.split('/').slice(0, -1).join('/')}/`, currentPath, name);

  const fullDirectoryPath = `${resolve(shareBasePath)}/`;

  // Safety: the resolved path must still be inside the share root
  if (!fullDirectoryPath.startsWith(shareRootOnDisk)) {
    return new Response('Invalid directory path', { status: 400 });
  }

  return await zipDirectoryAsResponse(fullDirectoryPath, name);
}

export default page({
  get,
  accessMode: 'public',
});
