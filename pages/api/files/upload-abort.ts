import { join } from '@std/path';

import page, { RequestHandlerParams } from '/lib/page.ts';
import { AppConfig } from '/lib/config.ts';
import { generateUploadSessionTag } from '/lib/auth.ts';

export interface RequestBody {
  upload_id: string;
  upload_session_tag: string;
}

export interface ResponseBody {
  success: boolean;
}

// Called by the upload service worker when it drops a chunked upload before it finished (e.g. its destination directory got deleted), so the chunks already received don't just sit in .chunk-uploads until the 24h stale sweep.
async function post({ request, user, session }: RequestHandlerParams) {
  const requestBody = await request.clone().json() as RequestBody;

  const uploadId = requestBody.upload_id;
  const uploadSessionTag = requestBody.upload_session_tag;

  if (uploadSessionTag && uploadSessionTag !== await generateUploadSessionTag(session?.tokenData?.session_id)) {
    return new Response('Forbidden', { status: 403 });
  }

  if (!uploadId || !/^[a-zA-Z0-9-]+$/.test(uploadId)) {
    return new Response('Bad Request', { status: 400 });
  }

  const filesRootPath = await AppConfig.getFilesRootPath();
  const uploadDir = join(filesRootPath, user!.id, '.chunk-uploads', uploadId);

  await Deno.remove(uploadDir, { recursive: true }).catch(() => {});

  const responseBody: ResponseBody = { success: true };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
