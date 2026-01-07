// Mock for inquirer package
const inquirer = {
  prompt: jest.fn(),
  registerPrompt: jest.fn(),
  createPromptModule: jest.fn(),
};

module.exports = inquirer;
module.exports.default = inquirer;
