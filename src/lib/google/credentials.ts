/**
 * Google Cloud Authentication Helper
 *
 * Handles credentials loading for both development and production:
 * - Development: Uses GOOGLE_APPLICATION_CREDENTIALS file path
 * - Production: Uses GOOGLE_CREDENTIALS_BASE64 environment variable
 */

import { GoogleAuth, GoogleAuthOptions } from 'google-auth-library';

/**
 * Creates a GoogleAuth instance with credentials from environment
 *
 * @throws {Error} If no credentials are configured
 */
export function getGoogleAuth(): GoogleAuth {
  // Production: Decode from base64 environment variable
  if (process.env.GOOGLE_CREDENTIALS_BASE64) {
    try {
      const credentials = JSON.parse(
        Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString(
          'utf-8'
        )
      );

      const authOptions: GoogleAuthOptions = {
        credentials,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      };

      console.log(
        '[Google Auth] Loaded credentials from GOOGLE_CREDENTIALS_BASE64'
      );
      return new GoogleAuth(authOptions);
    } catch (error) {
      console.error('[Google Auth] Failed to parse base64 credentials:', error);
      throw new Error(
        'Invalid GOOGLE_CREDENTIALS_BASE64: Failed to parse JSON'
      );
    }
  }

  // Development: Use file path
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const authOptions: GoogleAuthOptions = {
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    };

    console.log(
      '[Google Auth] Loaded credentials from file:',
      process.env.GOOGLE_APPLICATION_CREDENTIALS
    );
    return new GoogleAuth(authOptions);
  }

  // No credentials configured
  throw new Error(
    'No Google Cloud credentials configured. Set either GOOGLE_CREDENTIALS_BASE64 (production) or GOOGLE_APPLICATION_CREDENTIALS (development)'
  );
}

/**
 * Get the project ID from credentials
 */
export async function getProjectId(): Promise<string> {
  const auth = getGoogleAuth();
  const projectId = await auth.getProjectId();

  if (!projectId) {
    throw new Error('Could not determine Google Cloud project ID');
  }

  return projectId;
}
