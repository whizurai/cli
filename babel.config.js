// Used by babel-jest (jest.config.js). Without it babel-jest parsed the
// TypeScript test files as plain JavaScript and every suite failed to load.
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }], '@babel/preset-typescript'],
};
