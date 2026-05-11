export const nextCookies = () => ({ id: 'next-cookies' });

export const toNextJsHandler = (handler: unknown) => ({
  GET: handler,
  POST: handler,
});
