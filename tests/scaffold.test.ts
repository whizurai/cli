/**
 * Scaffold Manager Tests
 */

import { ScaffoldManager } from '../src/scaffold';
import fs from 'fs';
import path from 'path';

// Mock dependencies
jest.mock('fs');
jest.mock('inquirer');
jest.mock('ora');

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedInquirer = require('inquirer') as jest.Mocked<typeof import('inquirer')>;

// Mock ora
const mockOra = {
  start: jest.fn().mockReturnThis(),
  succeed: jest.fn().mockReturnThis(),
  fail: jest.fn().mockReturnThis(),
};
jest.doMock('ora', () => jest.fn(() => mockOra));

describe('ScaffoldManager', () => {
  let scaffoldManager: ScaffoldManager;

  beforeEach(() => {
    scaffoldManager = new ScaffoldManager();
    jest.clearAllMocks();
  });

  describe('listTemplates', () => {
    it('should return list of available templates', () => {
      const templates = scaffoldManager.listTemplates();

      expect(templates).toEqual([
        {
          name: 'nextjs-app',
          description: 'Next.js application with CheddarWhizzy integration',
          language: 'typescript',
          framework: 'Next.js',
          features: ['generate', 'enrich', 'moderate'],
        },
        {
          name: 'react-app',
          description: 'React application with CheddarWhizzy SDK',
          language: 'typescript',
          framework: 'React',
          features: ['generate', 'enrich'],
        },
        {
          name: 'nodejs-api',
          description: 'Node.js API server with CheddarWhizzy integration',
          language: 'typescript',
          framework: 'Express',
          features: ['generate', 'enrich', 'moderate', 'recommend'],
        },
        {
          name: 'python-app',
          description: 'Python application with CheddarWhizzy SDK',
          language: 'python',
          framework: 'FastAPI',
          features: ['generate', 'enrich', 'moderate'],
        },
        {
          name: 'vanilla-js',
          description: 'Vanilla JavaScript with CheddarWhizzy SDK',
          language: 'javascript',
          framework: 'Vanilla JS',
          features: ['generate'],
        },
      ]);
    });
  });

  describe('displayTemplates', () => {
    it('should display templates without error', () => {
      // Mock console.log to capture output
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      scaffoldManager.displayTemplates();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('selectTemplate', () => {
    it('should select template interactively', async () => {
      const selectedTemplate = {
        name: 'nextjs-app',
        description: 'Next.js application with CheddarWhizzy integration',
        language: 'typescript',
        framework: 'Next.js',
        features: ['generate', 'enrich', 'moderate'],
      };

      mockedInquirer.prompt.mockResolvedValue({ template: selectedTemplate });

      const template = await scaffoldManager.selectTemplate();

      expect(template).toEqual(selectedTemplate);
      expect(mockedInquirer.prompt).toHaveBeenCalled();
    });
  });

  describe('createProject', () => {
    it('should create Next.js project successfully', async () => {
      const projectOptions = {
        template: 'nextjs-app',
        projectName: 'test-app',
        outputDir: './test-output',
        features: ['generate', 'enrich'],
      };

      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation(() => '');
      mockedFs.writeFileSync.mockImplementation(() => {});

      await scaffoldManager.createProject(projectOptions);

      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('test-output/test-app'),
        { recursive: true }
      );
      expect(mockedFs.writeFileSync).toHaveBeenCalled();
    });

    it('should create React project successfully', async () => {
      const projectOptions = {
        template: 'react-app',
        projectName: 'test-react-app',
        outputDir: './test-output',
        features: ['generate'],
      };

      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation(() => '');
      mockedFs.writeFileSync.mockImplementation(() => {});

      // Mock the generateReactApp method to avoid actual file operations
      const generateReactAppSpy = jest.spyOn(scaffoldManager as any, 'generateReactApp');
      generateReactAppSpy.mockImplementation(() => {});

      await scaffoldManager.createProject(projectOptions);

      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('test-output/test-react-app'),
        { recursive: true }
      );
      expect(generateReactAppSpy).toHaveBeenCalled();
    });

    it('should create Node.js API project successfully', async () => {
      const projectOptions = {
        template: 'nodejs-api',
        projectName: 'test-api',
        outputDir: './test-output',
        features: ['generate', 'enrich'],
      };

      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation(() => '');
      mockedFs.writeFileSync.mockImplementation(() => {});

      // Mock the generateNodeJSAPI method
      const generateNodeJSAPISpy = jest.spyOn(scaffoldManager as any, 'generateNodeJSAPI');
      generateNodeJSAPISpy.mockImplementation(() => {});

      await scaffoldManager.createProject(projectOptions);

      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('test-output/test-api'),
        { recursive: true }
      );
      expect(generateNodeJSAPISpy).toHaveBeenCalled();
    });

    it('should create Python project successfully', async () => {
      const projectOptions = {
        template: 'python-app',
        projectName: 'test-python-app',
        outputDir: './test-output',
        features: ['generate'],
      };

      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation(() => '');
      mockedFs.writeFileSync.mockImplementation(() => {});

      // Mock the generatePythonApp method
      const generatePythonAppSpy = jest.spyOn(scaffoldManager as any, 'generatePythonApp');
      generatePythonAppSpy.mockImplementation(() => {});

      await scaffoldManager.createProject(projectOptions);

      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('test-output/test-python-app'),
        { recursive: true }
      );
      expect(generatePythonAppSpy).toHaveBeenCalled();
    });

    it('should create vanilla JavaScript project successfully', async () => {
      const projectOptions = {
        template: 'vanilla-js',
        projectName: 'test-vanilla-app',
        outputDir: './test-output',
        features: ['generate'],
      };

      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation(() => '');
      mockedFs.writeFileSync.mockImplementation(() => {});

      // Mock the generateVanillaJS method
      const generateVanillaJSSpy = jest.spyOn(scaffoldManager as any, 'generateVanillaJS');
      generateVanillaJSSpy.mockImplementation(() => {});

      await scaffoldManager.createProject(projectOptions);

      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('test-output/test-vanilla-app'),
        { recursive: true }
      );
      expect(generateVanillaJSSpy).toHaveBeenCalled();
    });

    it('should handle existing directory', () => {
      const projectOptions = {
        template: 'nextjs-app',
        projectName: 'existing-app',
        outputDir: './test-output',
        features: ['generate'],
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.writeFileSync.mockImplementation(() => {});

      // Should not throw an error, just skip directory creation
      expect(() => scaffoldManager.createProject(projectOptions)).not.toThrow();
    });
  });

  describe('generateNextJSApp', () => {
    it('should generate Next.js app files', async () => {
      const options = {
        projectName: 'test-app',
        outputDir: './test-output',
        features: ['generate', 'enrich'],
      };

      mockedFs.writeFileSync.mockImplementation(() => {});

      scaffoldManager.generateNextJSApp('/test-output/test-app', ['generate', 'enrich']);

      expect(mockedFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('generateReactApp', () => {
    it('should generate React app files', async () => {
      const options = {
        projectName: 'test-react-app',
        outputDir: './test-output',
        features: ['generate'],
      };

      mockedFs.writeFileSync.mockImplementation(() => {});
      mockedFs.mkdirSync.mockImplementation(() => {});

      scaffoldManager.generateReactApp('/test-output/test-react-app', ['generate', 'enrich']);

      expect(mockedFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('generateNodeJSAPI', () => {
    it('should generate Node.js API files', async () => {
      const options = {
        projectName: 'test-api',
        outputDir: './test-output',
        features: ['generate', 'enrich'],
      };

      mockedFs.writeFileSync.mockImplementation(() => {});
      mockedFs.mkdirSync.mockImplementation(() => {});

      scaffoldManager.generateNodeJSAPI('/test-output/test-api', ['generate', 'enrich']);

      expect(mockedFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('generatePythonApp', () => {
    it('should generate Python app files', async () => {
      const options = {
        projectName: 'test-python-app',
        outputDir: './test-output',
        features: ['generate'],
      };

      mockedFs.writeFileSync.mockImplementation(() => {});
      mockedFs.mkdirSync.mockImplementation(() => {});

      scaffoldManager.generatePythonApp('/test-output/test-python-app', ['generate', 'enrich']);

      expect(mockedFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('generateVanillaJS', () => {
    it('should generate vanilla JavaScript files', async () => {
      const options = {
        projectName: 'test-vanilla-app',
        outputDir: './test-output',
        features: ['generate'],
      };

      mockedFs.writeFileSync.mockImplementation(() => {});
      mockedFs.mkdirSync.mockImplementation(() => {});

      scaffoldManager.generateVanillaJS('/test-output/test-vanilla-app', ['generate']);

      expect(mockedFs.writeFileSync).toHaveBeenCalled();
    });
  });
});
