export class Redis {
  constructor(_config?: { url?: string; token?: string }) {}

  get = jest.fn(async () => null);
  set = jest.fn(async () => 'OK');
  setex = jest.fn(async () => 'OK');
  del = jest.fn(async () => 0);
  incr = jest.fn(async () => 1);
  expire = jest.fn(async () => 1);
  pipeline = jest.fn(() => ({
    get: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    incr: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    exec: jest.fn(async () => []),
  }));
}
