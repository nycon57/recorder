/**
 * Test script for FFmpeg installation
 *
 * Verifies FFmpeg is installed and working correctly:
 * - Checks FFmpeg binary exists
 * - Verifies version
 * - Tests codec support
 * - Tests basic video operations
 *
 * Usage: tsx scripts/test-ffmpeg.ts
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

async function testFFmpeg() {
  console.log('🧪 Testing FFmpeg installation...\n');

  try {
    // Test 1: Check FFmpeg binary exists
    console.log('🔍 Test 1: Checking FFmpeg binary...');
    let ffmpegPath: string;
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync('where ffmpeg');
        ffmpegPath = stdout.trim().split('\n')[0];
      } else {
        const { stdout } = await execAsync('which ffmpeg');
        ffmpegPath = stdout.trim();
      }
      console.log(`✅ FFmpeg found at: ${ffmpegPath}\n`);
    } catch (error) {
      throw new Error(
        'FFmpeg not found in system PATH. Please install FFmpeg:\n' +
        '  - macOS: brew install ffmpeg\n' +
        '  - Windows: choco install ffmpeg\n' +
        '  - Linux: sudo apt install ffmpeg'
      );
    }

    // Test 2: Check version
    console.log('📋 Test 2: Checking FFmpeg version...');
    const { stdout: versionOutput } = await execAsync('ffmpeg -version');
    const versionMatch = versionOutput.match(/ffmpeg version (\S+)/);
    const version = versionMatch ? versionMatch[1] : 'unknown';
    console.log(`✅ FFmpeg version: ${version}\n`);

    // Test 3: Check important codecs
    console.log('🎬 Test 3: Checking codec support...');
    const requiredCodecs = [
      { name: 'H.264', pattern: /DEV.LS h264/ },
      { name: 'H.265/HEVC', pattern: /DEV.LS hevc/ },
      { name: 'VP9', pattern: /DEV.L. vp9/ },
      { name: 'AAC Audio', pattern: /DEAILS aac/ },
    ];

    const { stdout: codecsOutput } = await execAsync('ffmpeg -codecs');

    for (const codec of requiredCodecs) {
      const supported = codec.pattern.test(codecsOutput);
      const status = supported ? '✅' : '⚠️';
      console.log(`${status} ${codec.name}: ${supported ? 'Supported' : 'Not found (optional)'}`);
    }
    console.log();

    // Test 4: Check hardware acceleration
    console.log('⚡ Test 4: Checking hardware acceleration...');
    const { stdout: encodersOutput } = await execAsync('ffmpeg -encoders');

    const hwEncoders = [
      { name: 'NVIDIA (nvenc)', pattern: /h264_nvenc/ },
      { name: 'Intel Quick Sync (qsv)', pattern: /h264_qsv/ },
      { name: 'Apple VideoToolbox', pattern: /h264_videotoolbox/ },
      { name: 'AMD (amf)', pattern: /h264_amf/ },
    ];

    let hasHardwareAccel = false;
    for (const encoder of hwEncoders) {
      const supported = encoder.pattern.test(encodersOutput);
      if (supported) {
        console.log(`✅ ${encoder.name}: Available`);
        hasHardwareAccel = true;
      }
    }

    if (!hasHardwareAccel) {
      console.log('⚠️  No hardware acceleration available (will use CPU encoding)');
    }
    console.log();

    // Test 5: Create and compress test video
    console.log('🎥 Test 5: Testing video compression...');
    const tempDir = os.tmpdir();
    const testInput = path.join(tempDir, 'test-input.mp4');
    const testOutput = path.join(tempDir, 'test-output.mp4');

    // Create 3-second test video
    console.log('   Creating test video...');
    await execAsync(
      `ffmpeg -f lavfi -i testsrc=duration=3:size=640x480:rate=30 -pix_fmt yuv420p -y "${testInput}"`
    );

    const inputStats = await fs.stat(testInput);
    console.log(`   Input size: ${(inputStats.size / 1024).toFixed(1)} KB`);

    // Compress video
    console.log('   Compressing video...');
    await execAsync(
      `ffmpeg -i "${testInput}" -c:v libx264 -crf 23 -preset medium -y "${testOutput}"`
    );

    const outputStats = await fs.stat(testOutput);
    const compressionRatio = ((1 - outputStats.size / inputStats.size) * 100).toFixed(1);
    console.log(`   Output size: ${(outputStats.size / 1024).toFixed(1)} KB`);
    console.log(`   Compression: ${compressionRatio}% size reduction`);
    console.log('✅ Video compression test successful\n');

    // Cleanup
    await fs.unlink(testInput).catch(() => {});
    await fs.unlink(testOutput).catch(() => {});

    // Test 6: Check FFprobe
    console.log('🔍 Test 6: Checking FFprobe...');
    try {
      const { stdout: ffprobeVersion } = await execAsync('ffprobe -version');
      const probeMatch = ffprobeVersion.match(/ffprobe version (\S+)/);
      const probeVer = probeMatch ? probeMatch[1] : 'unknown';
      console.log(`✅ FFprobe version: ${probeVer}\n`);
    } catch (error) {
      console.log('⚠️  FFprobe not found (usually installed with FFmpeg)\n');
    }

    // Summary
    console.log('🎉 All FFmpeg tests passed!\n');
    console.log('📊 Summary:');
    console.log(`   FFmpeg Version: ${version}`);
    console.log(`   Location: ${ffmpegPath}`);
    console.log(`   Hardware Acceleration: ${hasHardwareAccel ? 'Available' : 'Not available (CPU only)'}`);
    console.log(`   Video Compression: Working`);
    console.log('\n✅ Your FFmpeg installation is ready for production use!\n');

  } catch (error) {
    console.error('\n❌ FFmpeg test failed:', error instanceof Error ? error.message : error);
    console.error('\nTroubleshooting:');
    console.error('1. Install FFmpeg:');
    console.error('   - macOS: brew install ffmpeg');
    console.error('   - Windows: choco install ffmpeg');
    console.error('   - Linux: sudo apt install ffmpeg');
    console.error('2. Restart your terminal after installation');
    console.error('3. Verify FFmpeg is in PATH: ffmpeg -version');
    console.error('4. Check deployment guide: DEPLOYMENT.md\n');
    process.exit(1);
  }
}

testFFmpeg();
