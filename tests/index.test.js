/**
 * CLI Tests
 */

const { Command } = require('commander');

describe('CLI', () => {
  it('should be defined', () => {
    expect(Command).toBeDefined();
  });
});
