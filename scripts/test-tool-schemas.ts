/**
 * Test Tool Schemas for Gemini API Compatibility
 *
 * This script verifies that tool schemas are properly formatted
 * for Google's Gemini function calling API.
 */

import { tool } from 'ai';
import {
  executeSearchRecordings,
  executeGetDocument,
  executeGetTranscript,
  executeGetRecordingMetadata,
  executeListRecordings,
  toolDescriptions,
} from '../lib/services/chat-tools';
import {
  searchRecordingsInputSchema,
  getDocumentInputSchema,
  getTranscriptInputSchema,
  getRecordingMetadataInputSchema,
  listRecordingsInputSchema,
} from '../lib/validations/chat';

// ANSI colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

console.log(`\n${YELLOW}Testing Tool Schema Compatibility with Gemini API${RESET}\n`);

// Create tools exactly as they're created in the API route
const toolsWithContext = {
  searchRecordings: tool({
    description: toolDescriptions.searchRecordings,
    inputSchema: searchRecordingsInputSchema,
    execute: async (args: any) => {
      return await executeSearchRecordings(args, { orgId: 'test', userId: 'test' });
    },
  }),
  getDocument: tool({
    description: toolDescriptions.getDocument,
    inputSchema: getDocumentInputSchema,
    execute: async (args: any) => {
      return await executeGetDocument(args, { orgId: 'test', userId: 'test' });
    },
  }),
  getTranscript: tool({
    description: toolDescriptions.getTranscript,
    inputSchema: getTranscriptInputSchema,
    execute: async (args: any) => {
      return await executeGetTranscript(args, { orgId: 'test', userId: 'test' });
    },
  }),
  getRecordingMetadata: tool({
    description: toolDescriptions.getRecordingMetadata,
    inputSchema: getRecordingMetadataInputSchema,
    execute: async (args: any) => {
      return await executeGetRecordingMetadata(args, { orgId: 'test', userId: 'test' });
    },
  }),
  listRecordings: tool({
    description: toolDescriptions.listRecordings,
    inputSchema: listRecordingsInputSchema,
    execute: async (args: any) => {
      return await executeListRecordings(args, { orgId: 'test', userId: 'test' });
    },
  }),
};

let allPassed = true;

// Test each tool's schema
for (const [toolName, toolDef] of Object.entries(toolsWithContext)) {
  console.log(`Testing: ${toolName}`);

  // Check description
  if (!toolDef.description || typeof toolDef.description !== 'string') {
    console.log(`  ${RED}✗${RESET} Description is missing or invalid`);
    allPassed = false;
  } else {
    console.log(`  ${GREEN}✓${RESET} Description: "${toolDef.description.substring(0, 50)}..."`);
  }

  // Check inputSchema
  if (!toolDef.inputSchema) {
    console.log(`  ${RED}✗${RESET} Input schema is missing`);
    allPassed = false;
  } else {
    // Verify it's a Zod schema with the right shape
    const schema = toolDef.inputSchema as any;

    // Check if it's a Zod object schema
    if (schema._def && schema._def.typeName === 'ZodObject') {
      console.log(`  ${GREEN}✓${RESET} Parameters: Valid Zod Object schema`);

      // List the fields
      const shape = schema._def.shape();
      const fields = Object.keys(shape);
      console.log(`    Fields: ${fields.join(', ')}`);
    } else {
      console.log(`  ${RED}✗${RESET} Parameters: Not a valid Zod Object schema`);
      console.log(`    Type: ${schema._def?.typeName || 'unknown'}`);
      allPassed = false;
    }
  }

  // Check execute function
  if (!toolDef.execute || typeof toolDef.execute !== 'function') {
    console.log(`  ${RED}✗${RESET} Execute function is missing or invalid`);
    allPassed = false;
  } else {
    console.log(`  ${GREEN}✓${RESET} Execute: Valid function`);
  }

  console.log('');
}

// Summary
if (allPassed) {
  console.log(`${GREEN}✓ All tools are properly structured for Gemini API${RESET}\n`);
  console.log('The tools should work correctly with Google\'s function calling API.\n');
  process.exit(0);
} else {
  console.log(`${RED}✗ Some tools have schema issues${RESET}\n`);
  console.log('Please fix the issues above before testing with the API.\n');
  process.exit(1);
}
