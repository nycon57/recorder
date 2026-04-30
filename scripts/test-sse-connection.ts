#!/usr/bin/env tsx
/**
 * Test SSE Connection
 *
 * This script connects to the SSE endpoint to debug streaming issues.
 * It will log all events received from the server.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

import * as EventSourceModule from 'eventsource';

type EventSourceConstructor = new (
  url: string,
  init?: { withCredentials?: boolean }
) => {
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((error: { type?: string; status?: number; message?: string }) => void) | null;
  readyState: number;
  close: () => void;
};

const EventSource = ((EventSourceModule as { default?: unknown }).default || EventSourceModule) as EventSourceConstructor & {
  CLOSED: number;
  CONNECTING: number;
};

const RECORDING_ID = '80e70735-9b25-4c8a-8345-c7d41545ccc7';
const BASE_URL = 'http://localhost:3000';
const ENDPOINT = `/api/recordings/${RECORDING_ID}/reprocess/stream?step=all`;

async function testSSEConnection() {
  console.log('='.repeat(60));
  console.log('🔌 SSE Connection Test');
  console.log('='.repeat(60));
  console.log();

  console.log(`📍 Recording ID: ${RECORDING_ID}`);
  console.log(`🔗 Endpoint: ${BASE_URL}${ENDPOINT}`);
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  console.log();
  console.log('Attempting to connect...');
  console.log();

  // Create EventSource connection
  const eventSource = new EventSource(`${BASE_URL}${ENDPOINT}`, {
    withCredentials: true
  });

  let messageCount = 0;

  // Event handlers
  eventSource.onopen = () => {
    console.log('✅ Connection opened successfully!');
    console.log(`   Time: ${new Date().toISOString()}`);
    console.log();
  };

  eventSource.onmessage = (event) => {
    messageCount++;
    console.log(`📨 Message #${messageCount} received at ${new Date().toISOString()}`);

    try {
      const data = JSON.parse(event.data);
      console.log('   Type:', data.type);
      console.log('   Message:', data.message);

      if (data.progress !== undefined) {
        console.log('   Progress:', `${data.progress}%`);
      }

      if (data.step) {
        console.log('   Step:', data.step);
      }

      if (data.data) {
        console.log('   Data:', JSON.stringify(data.data, null, 2));
      }
    } catch {
      console.log('   Raw data:', event.data);
    }

    console.log();
  };

  eventSource.onerror = (error) => {
    console.error('❌ SSE Error occurred:');
    console.error('   Type:', error.type);

    if (error.status) {
      console.error('   Status:', error.status);
    }

    if (error.message) {
      console.error('   Message:', error.message);
    }

    console.error('   Time:', new Date().toISOString());
    console.error('   Full error:', error);
    console.log();

    if (eventSource.readyState === EventSource.CLOSED) {
      console.log('🔌 Connection closed by server');
    } else if (eventSource.readyState === EventSource.CONNECTING) {
      console.log('🔄 Attempting to reconnect...');
    } else {
      console.log('📊 Connection state:', eventSource.readyState);
    }
  };

  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Closing connection...');
    eventSource.close();
    console.log('✅ Connection closed');
    console.log(`📊 Total messages received: ${messageCount}`);
    process.exit(0);
  });

  // Keep script running
  console.log('🎧 Listening for events... (Press Ctrl+C to stop)');
  console.log('-'.repeat(60));
  console.log();
}

const execAsync = promisify(exec);

async function checkAndInstallDependencies() {
  try {
    require.resolve('eventsource');
  } catch {
    console.log('📦 Installing eventsource package...');
    await execAsync('npm install --no-save eventsource @types/eventsource');
    console.log('✅ Package installed\n');
  }
}

// Run the test
checkAndInstallDependencies().then(() => {
  testSSEConnection().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
});
