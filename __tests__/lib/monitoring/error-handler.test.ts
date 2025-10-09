import {
  AppError,
  ValidationError,
  NotFoundError,
  RateLimitError,
  formatErrorResponse,
} from '@/lib/monitoring/error-handler';

describe('Error Handler', () => {
  describe('AppError', () => {
    it('should create error with correct properties', () => {
      const error = new AppError('Test error', 'TEST_ERROR', 400, true, { foo: 'bar' });

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.context).toEqual({ foo: 'bar' });
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with 400 status', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.context).toEqual({ field: 'email' });
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with 404 status', () => {
      const error = new NotFoundError('User');

      expect(error.message).toBe('User not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error with retry info', () => {
      const error = new RateLimitError(60);

      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.statusCode).toBe(429);
      expect(error.context?.retryAfter).toBe(60);
    });
  });

  describe('formatErrorResponse', () => {
    it('should format AppError correctly', () => {
      const error = new ValidationError('Invalid email', { field: 'email' });
      const response = formatErrorResponse(error);

      expect(response.statusCode).toBe(400);
      expect(response.error.code).toBe('VALIDATION_ERROR');
      expect(response.error.message).toBe('Invalid email');
      expect(response.error.details).toEqual({ field: 'email' });
    });

    it('should hide error details in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Internal database error');
      const response = formatErrorResponse(error);

      expect(response.statusCode).toBe(500);
      expect(response.error.code).toBe('INTERNAL_ERROR');
      expect(response.error.message).toBe('An unexpected error occurred');

      process.env.NODE_ENV = originalEnv;
    });

    it('should show error details in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Database connection failed');
      const response = formatErrorResponse(error);

      expect(response.error.message).toBe('Database connection failed');

      process.env.NODE_ENV = originalEnv;
    });
  });
});
