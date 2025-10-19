/**
 * Test script for Cloudflare R2 connection
 *
 * Verifies R2 credentials and basic operations:
 * - Upload test file
 * - Download test file
 * - Delete test file
 *
 * Usage: npx tsx scripts/test-r2.ts
 * Or with explicit env: npx tsx --env-file=.env.local scripts/test-r2.ts
 */

// Load environment variables from .env.local BEFORE any other imports
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env.local') });

import { r2Client } from '@/lib/cloudflare/r2-client';

async function testR2() {
  console.log('🧪 Testing Cloudflare R2 connection...\n');

  const testKey = `test/hello-${Date.now()}.txt`;
  const testContent = 'Hello from R2! 🎉';

  try {
    // Test 1: Upload
    console.log('📤 Test 1: Uploading file...');
    const uploadResult = await r2Client.upload(
      testKey,
      Buffer.from(testContent),
      {
        contentType: 'text/plain',
        metadata: { test: 'true' }
      }
    );

    if (!uploadResult.success) {
      throw new Error(`Upload failed: ${uploadResult.error}`);
    }
    console.log('✅ Upload successful:', {
      key: uploadResult.key,
      size: uploadResult.size,
    });

    // Test 2: Check if file exists
    console.log('\n🔍 Test 2: Checking if file exists...');
    const existsResult = await r2Client.exists(testKey);
    if (!existsResult.exists) {
      throw new Error('File should exist but does not');
    }
    console.log('✅ File exists:', {
      size: existsResult.size,
      lastModified: existsResult.lastModified,
    });

    // Test 3: Download
    console.log('\n📥 Test 3: Downloading file...');
    const downloadResult = await r2Client.download(testKey);

    if (!downloadResult.success || !downloadResult.data) {
      throw new Error(`Download failed: ${downloadResult.error}`);
    }

    const downloadedContent = downloadResult.data.toString();
    if (downloadedContent !== testContent) {
      throw new Error(`Content mismatch: expected "${testContent}", got "${downloadedContent}"`);
    }
    console.log('✅ Download successful:', {
      content: downloadedContent,
      contentType: downloadResult.metadata?.contentType,
      size: downloadResult.metadata?.contentLength,
    });

    // Test 4: List files
    console.log('\n📋 Test 4: Listing files...');
    const listResult = await r2Client.list('test/', 10);
    if (!listResult.success) {
      throw new Error(`List failed: ${listResult.error}`);
    }
    console.log(`✅ Found ${listResult.objects.length} file(s) in test/ folder`);

    // Test 5: Delete
    console.log('\n🗑️  Test 5: Deleting file...');
    const deleteResult = await r2Client.delete(testKey);
    if (!deleteResult.success) {
      throw new Error(`Delete failed: ${deleteResult.error}`);
    }
    console.log('✅ Delete successful');

    // Test 6: Verify deletion
    console.log('\n✓ Test 6: Verifying deletion...');
    const existsAfterDelete = await r2Client.exists(testKey);
    if (existsAfterDelete.exists) {
      throw new Error('File should not exist after deletion');
    }
    console.log('✅ File successfully deleted\n');

    console.log('🎉 All R2 tests passed! Your R2 configuration is working correctly.\n');

    // Display configuration info
    console.log('📊 R2 Configuration:');
    console.log(`   Account ID: ${r2Client.getAccountId()}`);
    console.log(`   Bucket: ${r2Client.getBucketName()}`);
    console.log(`   Endpoint: https://${r2Client.getAccountId()}.r2.cloudflarestorage.com\n`);

  } catch (error) {
    console.error('\n❌ R2 test failed:', error);
    console.error('\nTroubleshooting:');
    console.error('1. Check your .env file has all R2 variables:');
    console.error('   - R2_ACCOUNT_ID');
    console.error('   - R2_ACCESS_KEY_ID');
    console.error('   - R2_SECRET_ACCESS_KEY');
    console.error('   - R2_BUCKET_NAME');
    console.error('2. Verify your R2 API token has "Object Read & Write" permissions');
    console.error('3. Ensure the bucket name matches exactly (case-sensitive)');
    console.error('4. Check https://dash.cloudflare.com/r2 for account status\n');
    process.exit(1);
  }
}

testR2();
