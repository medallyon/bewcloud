import {
  RequestBody as CreateDirectoryRequestBody,
  ResponseBody as CreateDirectoryResponseBody,
} from '/pages/api/files/create-directory.ts';
import {
  RequestBody as RenameDirectoryRequestBody,
  ResponseBody as RenameDirectoryResponseBody,
} from '/pages/api/files/rename-directory.ts';
import { RequestBody as RenameRequestBody, ResponseBody as RenameResponseBody } from '/pages/api/files/rename.ts';
import {
  RequestBody as MoveDirectoryRequestBody,
  ResponseBody as MoveDirectoryResponseBody,
} from '/pages/api/files/move-directory.ts';
import { RequestBody as MoveRequestBody, ResponseBody as MoveResponseBody } from '/pages/api/files/move.ts';
import {
  RequestBody as DeleteDirectoryRequestBody,
  ResponseBody as DeleteDirectoryResponseBody,
} from '/pages/api/files/delete-directory.ts';
import { RequestBody as DeleteRequestBody, ResponseBody as DeleteResponseBody } from '/pages/api/files/delete.ts';
import {
  RequestBody as CreateShareRequestBody,
  ResponseBody as CreateShareResponseBody,
} from '/pages/api/files/create-share.ts';
import {
  RequestBody as UpdateShareRequestBody,
  ResponseBody as UpdateShareResponseBody,
} from '/pages/api/files/update-share.ts';
import {
  RequestBody as DeleteShareRequestBody,
  ResponseBody as DeleteShareResponseBody,
} from '/pages/api/files/delete-share.ts';

// Every mutating files endpoint answers with the whole new listing plus a success flag, so one poster covers all of them. Callers own the UI state; these only throw.
async function post<T extends { success: boolean }>(
  endpoint: string,
  requestBody: unknown,
  action: string,
): Promise<T> {
  const response = await fetch(`/api/files/${endpoint}`, {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Failed to ${action}. ${response.statusText} ${await response.text()}`);
  }

  const result = await response.json() as T;

  if (!result.success) {
    throw new Error(`Failed to ${action}!`);
  }

  return result;
}

export function createDirectory(parentPath: string, name: string) {
  const requestBody: CreateDirectoryRequestBody = { parentPath, name };

  return post<CreateDirectoryResponseBody>('create-directory', requestBody, 'create directory');
}

export function renameDirectory(parentPath: string, oldName: string, newName: string) {
  const requestBody: RenameDirectoryRequestBody = { parentPath, oldName, newName };

  return post<RenameDirectoryResponseBody>('rename-directory', requestBody, 'rename directory');
}

export function renameFile(parentPath: string, oldName: string, newName: string) {
  const requestBody: RenameRequestBody = { parentPath, oldName, newName };

  return post<RenameResponseBody>('rename', requestBody, 'rename file');
}

export function moveDirectory(oldParentPath: string, newParentPath: string, name: string) {
  const requestBody: MoveDirectoryRequestBody = { oldParentPath, newParentPath, name };

  return post<MoveDirectoryResponseBody>('move-directory', requestBody, 'move directory');
}

export function moveFile(oldParentPath: string, newParentPath: string, name: string) {
  const requestBody: MoveRequestBody = { oldParentPath, newParentPath, name };

  return post<MoveResponseBody>('move', requestBody, 'move file');
}

export function deleteDirectory(parentPath: string, name: string) {
  const requestBody: DeleteDirectoryRequestBody = { parentPath, name };

  return post<DeleteDirectoryResponseBody>('delete-directory', requestBody, 'delete directory');
}

export function deleteFile(parentPath: string, name: string) {
  const requestBody: DeleteRequestBody = { parentPath, name };

  return post<DeleteResponseBody>('delete', requestBody, 'delete file');
}

export function createFileShare(pathInView: string, filePath: string, password?: string) {
  const requestBody: CreateShareRequestBody = { pathInView, filePath, password };

  return post<CreateShareResponseBody>('create-share', requestBody, 'create share');
}

export function updateFileShare(pathInView: string, fileShareId: string, password?: string) {
  const requestBody: UpdateShareRequestBody = { pathInView, fileShareId, password };

  return post<UpdateShareResponseBody>('update-share', requestBody, 'update share');
}

export function deleteFileShare(pathInView: string, fileShareId: string) {
  const requestBody: DeleteShareRequestBody = { pathInView, fileShareId };

  return post<DeleteShareResponseBody>('delete-share', requestBody, 'delete file share');
}
