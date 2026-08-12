import page, { RequestHandlerParams } from '/lib/page.ts';

import { UserModel } from '/lib/models/user.ts';
import {
  FileView,
  SortColumn,
  SortOrder,
  VALID_FILE_VIEWS,
  VALID_SORT_COLUMNS,
  VALID_SORT_ORDERS,
} from '/public/ts/utils/files.ts';

// Stores the files view preferences: sorting, and whether the listing shows as a list or a grid
export interface RequestBody {
  sortBy: SortColumn;
  sortOrder: SortOrder;
  view?: FileView;
}

export interface ResponseBody {
  success: boolean;
}

async function post({ request, user }: RequestHandlerParams) {
  const requestBody = await request.clone().json() as RequestBody;

  if (!VALID_SORT_COLUMNS.includes(requestBody.sortBy) || !VALID_SORT_ORDERS.includes(requestBody.sortOrder)) {
    return new Response('Bad Request', { status: 400 });
  }

  if (typeof requestBody.view !== 'undefined' && !VALID_FILE_VIEWS.includes(requestBody.view)) {
    return new Response('Bad Request', { status: 400 });
  }

  user!.extra.file_sorting = { sort_by: requestBody.sortBy, sort_order: requestBody.sortOrder };

  if (requestBody.view) {
    user!.extra.file_view = requestBody.view;
  }

  await UserModel.update(user!);

  const responseBody: ResponseBody = { success: true };

  return new Response(JSON.stringify(responseBody));
}

export default page({
  post,
  accessMode: 'user',
});
