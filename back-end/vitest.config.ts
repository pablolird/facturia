import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    env: {
      DATABASE_URL:
        process.env['DATABASE_URL'] ??
        'postgresql://test_user:test_password@localhost:5432/test_db',
      // Test-only Standard Webhooks secret; webhooks.test.ts signs its payloads with it
      CLERK_WEBHOOK_SIGNING_SECRET: 'whsec_dGVzdC13ZWJob29rLXNpZ25pbmctc2VjcmV0LTMyYnl0ZXM=',
      NODE_ENV: 'test',
    },
    globalSetup: ['./src/tests/globalSetup.ts'],
    setupFiles: ['./src/tests/setup.ts'],
    testTimeout: 30000,
  },
});
