async function post(endpoint, requestBody, action) {
  const response = await fetch(`/api/files/${endpoint}`, {
    method: 'POST',
    body: JSON.stringify(requestBody)
  });
  if (!response.ok) {
    throw new Error(`Failed to ${action}. ${response.statusText} ${await response.text()}`);
  }
  const result = await response.json();
  if (!result.success) {
    throw new Error(`Failed to ${action}!`);
  }
  return result;
}
export function createDirectory(parentPath, name) {
  const requestBody = {
    parentPath,
    name
  };
  return post('create-directory', requestBody, 'create directory');
}
export function renameDirectory(parentPath, oldName, newName) {
  const requestBody = {
    parentPath,
    oldName,
    newName
  };
  return post('rename-directory', requestBody, 'rename directory');
}
export function renameFile(parentPath, oldName, newName) {
  const requestBody = {
    parentPath,
    oldName,
    newName
  };
  return post('rename', requestBody, 'rename file');
}
export function moveDirectory(oldParentPath, newParentPath, name) {
  const requestBody = {
    oldParentPath,
    newParentPath,
    name
  };
  return post('move-directory', requestBody, 'move directory');
}
export function moveFile(oldParentPath, newParentPath, name) {
  const requestBody = {
    oldParentPath,
    newParentPath,
    name
  };
  return post('move', requestBody, 'move file');
}
export function deleteDirectory(parentPath, name) {
  const requestBody = {
    parentPath,
    name
  };
  return post('delete-directory', requestBody, 'delete directory');
}
export function deleteFile(parentPath, name) {
  const requestBody = {
    parentPath,
    name
  };
  return post('delete', requestBody, 'delete file');
}
export function createFileShare(pathInView, filePath, password) {
  const requestBody = {
    pathInView,
    filePath,
    password
  };
  return post('create-share', requestBody, 'create share');
}
export function updateFileShare(pathInView, fileShareId, password) {
  const requestBody = {
    pathInView,
    fileShareId,
    password
  };
  return post('update-share', requestBody, 'update share');
}
export function deleteFileShare(pathInView, fileShareId) {
  const requestBody = {
    pathInView,
    fileShareId
  };
  return post('delete-share', requestBody, 'delete file share');
}