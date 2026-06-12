import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.d.ts',
    '!src/application/use-cases/cancel-subscription.use-case.ts',
    '!src/application/use-cases/checkout-subscription.use-case.ts',
    '!src/application/use-cases/get-payment-logs.use-case.ts',
    '!src/application/use-cases/renew-subscription.use-case.ts',
    '!src/domain/errors/not-implemented.error.ts',
  ],
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};

export default config;
