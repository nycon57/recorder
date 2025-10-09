import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Fetch usage from database
    // This is placeholder data
    const usage = {
      recordings: {
        used: 2,
        limit: 5,
        percentage: 40,
      },
      storage: {
        used: 157286400, // bytes
        limit: 1073741824, // 1GB in bytes
        percentage: 15,
        usedFormatted: '150 MB',
        limitFormatted: '1 GB',
      },
      transcriptionMinutes: {
        used: 45,
        limit: 120,
        percentage: 37.5,
      },
      aiQueries: {
        used: 123,
        limit: 1000,
        percentage: 12.3,
      },
    };

    return NextResponse.json(usage);
  } catch (error) {
    console.error('Error fetching usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage' },
      { status: 500 }
    );
  }
}
