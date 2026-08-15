import { assertEquals, assertNotEquals } from '@std/assert';

import { generateUploadSessionTag, isUploadSessionTagValid } from './auth.ts';

Deno.test('that generateUploadSessionTag works', async () => {
  const tag = await generateUploadSessionTag('cf8b3a5e-0e6e-4a9a-9a1e-1f4c0d8b1a11');

  assertEquals(tag, await generateUploadSessionTag('cf8b3a5e-0e6e-4a9a-9a1e-1f4c0d8b1a11'));

  // A queue tagged by another session must not match, otherwise leftover uploads would be accepted under the session that's logged in now
  assertNotEquals(tag, await generateUploadSessionTag('0b2d4f6a-1c3e-4b5d-8e7f-2a9c0b1d3e42'));

  // The raw session id never leaves the server
  assertNotEquals(tag, 'cf8b3a5e-0e6e-4a9a-9a1e-1f4c0d8b1a11');

  assertEquals(await generateUploadSessionTag(), '');
  assertEquals(await generateUploadSessionTag(''), '');
});

Deno.test('that isUploadSessionTagValid requires a matching tag for cookie sessions', async () => {
  const sessionId = 'cf8b3a5e-0e6e-4a9a-9a1e-1f4c0d8b1a11';
  const tag = await generateUploadSessionTag(sessionId);

  assertEquals(await isUploadSessionTagValid(tag, sessionId), true);
  assertEquals(await isUploadSessionTagValid('', sessionId), false);
  assertEquals(await isUploadSessionTagValid(undefined, sessionId), false);
  assertEquals(
    await isUploadSessionTagValid(await generateUploadSessionTag('0b2d4f6a-1c3e-4b5d-8e7f-2a9c0b1d3e42'), sessionId),
    false,
  );

  // Basic auth / no cookie session: untagged requests are allowed
  assertEquals(await isUploadSessionTagValid('', undefined), true);
  assertEquals(await isUploadSessionTagValid(undefined), true);
  assertEquals(await isUploadSessionTagValid(tag), true);
});
