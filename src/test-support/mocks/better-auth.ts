export const betterAuth = () => ({
  api: {
    getSession: jest.fn(async () => null),
  },
  handler: jest.fn(async () => new Response(null, { status: 404 })),
  $Infer: {},
});
