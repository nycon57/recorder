import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/utils/api';

export async function GET(request: NextRequest) {
  return successResponse({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.0.0',
  });
}
