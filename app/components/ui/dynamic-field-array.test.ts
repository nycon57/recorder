/**
 * Unit Tests for DynamicFieldArray Helper Functions
 *
 * Test the conversion helpers to ensure data transformation works correctly
 */

import {
  KeyValuePair,
  SingleValue,
  keyValuePairsToObject,
  objectToKeyValuePairs,
  singleValuesToArray,
  arrayToSingleValues,
} from './dynamic-field-array';

describe('DynamicFieldArray Helper Functions', () => {
  describe('keyValuePairsToObject', () => {
    it('should convert key-value pairs to object', () => {
      const pairs: KeyValuePair[] = [
        { key: 'Authorization', value: 'Bearer token123' },
        { key: 'Content-Type', value: 'application/json' },
      ];

      const result = keyValuePairsToObject(pairs);

      expect(result).toEqual({
        Authorization: 'Bearer token123',
        'Content-Type': 'application/json',
      });
    });

    it('should filter out empty pairs', () => {
      const pairs: KeyValuePair[] = [
        { key: 'Authorization', value: 'Bearer token123' },
        { key: '', value: '' },
        { key: 'Content-Type', value: '' },
        { key: '', value: 'application/json' },
      ];

      const result = keyValuePairsToObject(pairs);

      expect(result).toEqual({
        Authorization: 'Bearer token123',
      });
    });

    it('should handle empty array', () => {
      const pairs: KeyValuePair[] = [];
      const result = keyValuePairsToObject(pairs);
      expect(result).toEqual({});
    });

    it('should handle array with all empty pairs', () => {
      const pairs: KeyValuePair[] = [
        { key: '', value: '' },
        { key: '', value: '' },
      ];
      const result = keyValuePairsToObject(pairs);
      expect(result).toEqual({});
    });

    it('should handle duplicate keys (last one wins)', () => {
      const pairs: KeyValuePair[] = [
        { key: 'Authorization', value: 'token1' },
        { key: 'Authorization', value: 'token2' },
      ];

      const result = keyValuePairsToObject(pairs);

      expect(result).toEqual({
        Authorization: 'token2',
      });
    });
  });

  describe('objectToKeyValuePairs', () => {
    it('should convert object to key-value pairs', () => {
      const obj = {
        Authorization: 'Bearer token123',
        'Content-Type': 'application/json',
      };

      const result = objectToKeyValuePairs(obj);

      expect(result).toEqual([
        { key: 'Authorization', value: 'Bearer token123' },
        { key: 'Content-Type', value: 'application/json' },
      ]);
    });

    it('should handle empty object', () => {
      const obj = {};
      const result = objectToKeyValuePairs(obj);
      expect(result).toEqual([]);
    });

    it('should handle object with empty string values', () => {
      const obj = {
        key1: '',
        key2: 'value2',
      };

      const result = objectToKeyValuePairs(obj);

      expect(result).toEqual([
        { key: 'key1', value: '' },
        { key: 'key2', value: 'value2' },
      ]);
    });
  });

  describe('singleValuesToArray', () => {
    it('should convert single values to array of strings', () => {
      const values: SingleValue[] = [
        { value: 'tag1' },
        { value: 'tag2' },
        { value: 'tag3' },
      ];

      const result = singleValuesToArray(values);

      expect(result).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should filter out empty values', () => {
      const values: SingleValue[] = [
        { value: 'tag1' },
        { value: '' },
        { value: 'tag2' },
        { value: '' },
      ];

      const result = singleValuesToArray(values);

      expect(result).toEqual(['tag1', 'tag2']);
    });

    it('should handle empty array', () => {
      const values: SingleValue[] = [];
      const result = singleValuesToArray(values);
      expect(result).toEqual([]);
    });

    it('should handle array with all empty values', () => {
      const values: SingleValue[] = [{ value: '' }, { value: '' }];
      const result = singleValuesToArray(values);
      expect(result).toEqual([]);
    });
  });

  describe('arrayToSingleValues', () => {
    it('should convert array of strings to single values', () => {
      const arr = ['tag1', 'tag2', 'tag3'];
      const result = arrayToSingleValues(arr);

      expect(result).toEqual([
        { value: 'tag1' },
        { value: 'tag2' },
        { value: 'tag3' },
      ]);
    });

    it('should handle empty array', () => {
      const arr: string[] = [];
      const result = arrayToSingleValues(arr);
      expect(result).toEqual([]);
    });

    it('should handle array with empty strings', () => {
      const arr = ['', 'tag1', '', 'tag2'];
      const result = arrayToSingleValues(arr);

      expect(result).toEqual([
        { value: '' },
        { value: 'tag1' },
        { value: '' },
        { value: 'tag2' },
      ]);
    });
  });

  describe('Round-trip conversions', () => {
    it('should maintain data through object round-trip', () => {
      const original = {
        API_KEY: 'secret123',
        NODE_ENV: 'production',
        PORT: '3000',
      };

      const pairs = objectToKeyValuePairs(original);
      const result = keyValuePairsToObject(pairs);

      expect(result).toEqual(original);
    });

    it('should maintain data through array round-trip', () => {
      const original = ['tag1', 'tag2', 'tag3'];

      const values = arrayToSingleValues(original);
      const result = singleValuesToArray(values);

      expect(result).toEqual(original);
    });

    it('should filter empty values during round-trip', () => {
      const pairs: KeyValuePair[] = [
        { key: 'valid', value: 'data' },
        { key: '', value: '' },
        { key: 'also', value: 'valid' },
      ];

      const obj = keyValuePairsToObject(pairs);
      const result = objectToKeyValuePairs(obj);

      expect(result).toEqual([
        { key: 'valid', value: 'data' },
        { key: 'also', value: 'valid' },
      ]);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle custom headers from CreateWebhookModal', () => {
      // Simulating user input
      const customHeaders: KeyValuePair[] = [
        { key: 'X-API-Key', value: 'sk_test_123' },
        { key: 'Authorization', value: 'Bearer token' },
        { key: '', value: '' }, // Empty row
      ];

      // Converting for API submission
      const headers = keyValuePairsToObject(customHeaders);

      expect(headers).toEqual({
        'X-API-Key': 'sk_test_123',
        Authorization: 'Bearer token',
      });
    });

    it('should handle environment variables', () => {
      // Simulating existing env vars
      const existingEnv = {
        NODE_ENV: 'production',
        API_URL: 'https://api.example.com',
        DATABASE_URL: 'postgres://...',
      };

      // Loading into form
      const pairs = objectToKeyValuePairs(existingEnv);

      // User edits values
      pairs[1].value = 'https://api-staging.example.com';

      // Converting back
      const updatedEnv = keyValuePairsToObject(pairs);

      expect(updatedEnv).toEqual({
        NODE_ENV: 'production',
        API_URL: 'https://api-staging.example.com',
        DATABASE_URL: 'postgres://...',
      });
    });

    it('should handle tags with filtering', () => {
      // Simulating user input
      const tags: SingleValue[] = [
        { value: 'typescript' },
        { value: 'react' },
        { value: '' }, // Empty tag
        { value: 'nextjs' },
        { value: '' }, // Another empty tag
      ];

      // Converting for API submission (filtering empty)
      const tagArray = singleValuesToArray(tags);

      expect(tagArray).toEqual(['typescript', 'react', 'nextjs']);
    });

    it('should handle email list', () => {
      // Simulating existing emails
      const existingEmails = [
        'user1@example.com',
        'user2@example.com',
      ];

      // Loading into form
      const values = arrayToSingleValues(existingEmails);

      // User adds new email
      values.push({ value: 'user3@example.com' });

      // Converting back
      const emailList = singleValuesToArray(values);

      expect(emailList).toEqual([
        'user1@example.com',
        'user2@example.com',
        'user3@example.com',
      ]);
    });
  });

  describe('Edge cases', () => {
    it('should handle special characters in keys', () => {
      const pairs: KeyValuePair[] = [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'X-Custom-Header', value: 'value' },
        { key: 'api.key', value: 'secret' },
      ];

      const result = keyValuePairsToObject(pairs);

      expect(result).toEqual({
        'Content-Type': 'application/json',
        'X-Custom-Header': 'value',
        'api.key': 'secret',
      });
    });

    it('should handle special characters in values', () => {
      const pairs: KeyValuePair[] = [
        { key: 'password', value: 'p@ssw0rd!#$%' },
        { key: 'url', value: 'https://example.com?foo=bar&baz=qux' },
      ];

      const result = keyValuePairsToObject(pairs);

      expect(result).toEqual({
        password: 'p@ssw0rd!#$%',
        url: 'https://example.com?foo=bar&baz=qux',
      });
    });

    it('should handle whitespace in keys and values', () => {
      const pairs: KeyValuePair[] = [
        { key: '  key with spaces  ', value: '  value with spaces  ' },
      ];

      const result = keyValuePairsToObject(pairs);

      // Note: We preserve whitespace (consumers can trim if needed)
      expect(result).toEqual({
        '  key with spaces  ': '  value with spaces  ',
      });
    });

    it('should handle very long values', () => {
      const longValue = 'a'.repeat(10000);
      const pairs: KeyValuePair[] = [{ key: 'long', value: longValue }];

      const result = keyValuePairsToObject(pairs);

      expect(result.long).toHaveLength(10000);
      expect(result.long).toBe(longValue);
    });

    it('should handle numeric string values', () => {
      const pairs: KeyValuePair[] = [
        { key: 'port', value: '3000' },
        { key: 'timeout', value: '5000' },
      ];

      const result = keyValuePairsToObject(pairs);

      expect(result).toEqual({
        port: '3000',
        timeout: '5000',
      });
      expect(typeof result.port).toBe('string');
    });
  });
});
