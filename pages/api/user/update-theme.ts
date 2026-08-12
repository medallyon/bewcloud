import page, { RequestHandlerParams } from '/lib/page.ts';

import { UserModel } from '/lib/models/user.ts';
import { isThemeId, ThemeId } from '/public/ts/utils/theme.ts';

export interface RequestBody {
  theme: ThemeId;
}

export interface ResponseBody {
  success: boolean;
}

async function post({ request, user }: RequestHandlerParams) {
  const requestBody = await request.clone().json() as RequestBody;

  if (!isThemeId(requestBody.theme)) {
    return new Response('Bad Request', { status: 400 });
  }

  user!.extra.theme = requestBody.theme;

  await UserModel.update(user!);

  const responseBody: ResponseBody = { success: true };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
