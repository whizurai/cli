/**
 * Jest test setup file
 */

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock process.exit to prevent tests from actually exiting
const originalExit = process.exit;
beforeAll(() => {
  process.exit = jest.fn();
});

afterAll(() => {
  process.exit = originalExit;
});
