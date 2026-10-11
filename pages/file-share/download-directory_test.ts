import { assertEquals, assertRejects } from '@std/assert';
import { join } from '@std/path';

import { AppConfig } from '/lib/config.ts';
import { FileShareModel } from '/lib/models/files.ts';
import { FileShare } from '/lib/types.ts';

import downloadDirectoryFileSharePage from './[fileShareId]/download-directory.ts';

// These tests swap process-wide config and FileShareModel.getById. deno test --parallel would otherwise interleave them.
let downloadShareTail: Promise<void> = Promise.resolve();

function withDownloadShareLock<T>(callback: () => Promise<T>): Promise<T> {
  const run = downloadShareTail.then(callback, callback);
  downloadShareTail = run.then(() => {}, () => {});
  return run;
}

async function withPublicDirectoryDownloads<T>(
  callback: () => Promise<T>,
  isAllowedForPublicShares = true,
): Promise<T> {
  return await withDownloadShareLock(async () => {
    const config = await AppConfig.getConfig();
    const previousFiles = { ...config.files };
    const previousApps = [...config.core.enabledApps];

    config.files.allowPublicSharing = true;
    config.files.allowDirectoryDownloads = true;
    config.files.allowDirectoryDownloadsForPublicShares = isAllowedForPublicShares;

    if (!config.core.enabledApps.includes('files')) {
      config.core.enabledApps.push('files');
    }

    try {
      return await callback();
    } finally {
      config.files = previousFiles;
      config.core.enabledApps = previousApps;
    }
  });
}

async function downloadShareDirectory(fileShare: FileShare, name: string, path = '/'): Promise<Response> {
  const originalGetById = FileShareModel.getById;

  FileShareModel.getById = (id: string) => {
    return Promise.resolve(id === fileShare.id ? fileShare : null);
  };

  try {
    const request = new Request(
      `http://localhost:8000/file-share/${fileShare.id}/download-directory?path=${encodeURIComponent(path)}&name=${
        encodeURIComponent(name)
      }`,
    );
    const match = { pathname: { groups: { fileShareId: fileShare.id } } } as unknown as URLPatternResult;

    return await downloadDirectoryFileSharePage.get!({ request, match, isRunningLocally: true });
  } finally {
    FileShareModel.getById = originalGetById;
  }
}

function shareFor(userId: string, filePath: string): FileShare {
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    file_path: filePath,
    extra: {},
    created_at: new Date(),
  };
}

async function withUserRoot(test: (userRoot: string, userId: string) => Promise<void>) {
  const userId = crypto.randomUUID();
  const userRoot = join(await AppConfig.getFilesRootPath(), userId);

  try {
    await Deno.mkdir(join(userRoot, 'Public', 'Sub'), { recursive: true });
    await Deno.mkdir(join(userRoot, 'Private'), { recursive: true });
    await Deno.writeTextFile(join(userRoot, 'Public', 'Sub', 'note.txt'), 'NOTE');
    await Deno.writeTextFile(join(userRoot, 'Private', 'secret.txt'), 'SECRET');
    await Deno.writeTextFile(join(userRoot, 'shared.txt'), 'SHARED');

    await test(userRoot, userId);
  } finally {
    await Deno.remove(userRoot, { recursive: true }).catch(() => {});
  }
}

Deno.test('that a public directory share downloads a directory inside the share as a zip', async () => {
  await withUserRoot(async (_userRoot, userId) => {
    const response = await withPublicDirectoryDownloads(() =>
      downloadShareDirectory(shareFor(userId, '/Public/'), 'Sub')
    );

    assertEquals(response.status, 200);
    assertEquals(response.headers.get('content-type'), 'application/zip');

    const zip = new Uint8Array(await response.arrayBuffer());

    // Local file header signature "PK\x03\x04"
    assertEquals([...zip.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  });
});

Deno.test('that a public directory share does not download a directory outside the share', async () => {
  await withUserRoot(async (_userRoot, userId) => {
    await withPublicDirectoryDownloads(() =>
      assertRejects(() => downloadShareDirectory(shareFor(userId, '/Public/'), 'Private', '/..'), Error, 'NotFound')
    );

    const response = await withPublicDirectoryDownloads(() =>
      downloadShareDirectory(shareFor(userId, '/Public/'), '..')
    );

    assertEquals(response.status, 400);
  });
});

Deno.test('that a public file share does not download a sibling directory', async () => {
  await withUserRoot(async (_userRoot, userId) => {
    await withPublicDirectoryDownloads(() =>
      assertRejects(() => downloadShareDirectory(shareFor(userId, '/shared.txt'), 'Private'), Error, 'NotFound')
    );
  });
});

Deno.test('that public share directory downloads stay off unless enabled for public shares', async () => {
  await withUserRoot(async (_userRoot, userId) => {
    const response = await withPublicDirectoryDownloads(
      () => downloadShareDirectory(shareFor(userId, '/Public/'), 'Sub'),
      false,
    );

    assertEquals(response.status, 403);
  });
});
