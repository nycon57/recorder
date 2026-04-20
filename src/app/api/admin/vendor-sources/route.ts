import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireSystemAdmin,
  successResponse,
} from '@/lib/utils/api';
import { createVendorSourceOpsService } from '@/lib/services/vendor-source-ops';

export const GET = apiHandler(async (_request: NextRequest) => {
  await requireSystemAdmin();

  const service = createVendorSourceOpsService();
  const snapshot = await service.getSnapshot();

  return successResponse(snapshot);
});
