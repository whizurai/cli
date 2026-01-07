const axios = jest.genMockFromModule('axios');

// Create a mock axios instance
const mockAxios = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
  create: jest.fn(() => mockAxios),
  defaults: {
    baseURL: '',
    headers: {},
  },
  interceptors: {
    request: {
      use: jest.fn(),
    },
    response: {
      use: jest.fn(),
    },
  },
};

// Mock the create method to return the mock instance
axios.create = jest.fn(() => mockAxios);

// Export the mock
module.exports = axios;
