/**
 * Sample App Scaffolding
 *
 * Handles creation of sample applications and project templates
 * for the Whizurai CLI tool.
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

export interface ScaffoldTemplate {
  name: string;
  description: string;
  language: 'typescript' | 'python' | 'javascript';
  framework: string;
  features: string[];
}

export interface ScaffoldOptions {
  template: string;
  projectName: string;
  outputDir: string;
  features?: string[] | undefined;
}

export class ScaffoldManager {
  private templates: ScaffoldTemplate[] = [
    {
      name: 'nextjs-app',
      description: 'Next.js application with Whizurai integration',
      language: 'typescript',
      framework: 'Next.js',
      features: ['generate', 'enrich', 'moderate'],
    },
    {
      name: 'react-app',
      description: 'React application with Whizurai SDK',
      language: 'typescript',
      framework: 'React',
      features: ['generate', 'enrich'],
    },
    {
      name: 'nodejs-api',
      description: 'Node.js API server with Whizurai integration',
      language: 'typescript',
      framework: 'Express',
      features: ['generate', 'enrich', 'moderate', 'recommend'],
    },
    {
      name: 'python-app',
      description: 'Python application with Whizurai SDK',
      language: 'python',
      framework: 'FastAPI',
      features: ['generate', 'enrich', 'moderate'],
    },
    {
      name: 'vanilla-js',
      description: 'Vanilla JavaScript with Whizurai SDK',
      language: 'javascript',
      framework: 'Vanilla JS',
      features: ['generate'],
    },
  ];

  /**
   * List available templates
   */
  listTemplates(): ScaffoldTemplate[] {
    return this.templates;
  }

  /**
   * Display templates in a formatted way
   */
  displayTemplates(): void {
    console.log(chalk.blue('\n📋 Available Templates'));
    console.log(chalk.gray('─'.repeat(60)));

    this.templates.forEach((template) => {
      console.log(chalk.bold(`${template.name}`));
      console.log(chalk.gray(`   ${template.description}`));
      console.log(
        chalk.gray(`   Language: ${template.language} | Framework: ${template.framework}`)
      );
      console.log(chalk.gray(`   Features: ${template.features.join(', ')}`));
      console.log(chalk.gray('─'.repeat(60)));
    });
  }

  /**
   * Interactive template selection
   */
  async selectTemplate(): Promise<ScaffoldTemplate> {
    const choices = this.templates.map((template) => ({
      name: `${template.name} - ${template.description}`,
      value: template,
    }));

    const { template } = (await inquirer.prompt([
      {
        type: 'list',
        name: 'template',
        message: 'Select a template:',
        choices,
      },
    ])) as { template: string };

    return template as unknown as ScaffoldTemplate;
  }

  /**
   * Create project from template
   */
  createProject(options: ScaffoldOptions): void {
    const template = this.templates.find((t) => t.name === options.template);
    if (!template) {
      throw new Error(`Template "${options.template}" not found`);
    }

    const spinner = ora(`Creating ${template.name} project...`).start();

    try {
      const projectPath = path.resolve(options.outputDir, options.projectName);

      // Create project directory
      if (!fs.existsSync(projectPath)) {
        fs.mkdirSync(projectPath, { recursive: true });
      }

      // Generate project files based on template
      this.generateProjectFiles(template, projectPath, options);

      spinner.succeed(`Project "${options.projectName}" created successfully!`);

      console.log(chalk.green(`\n🎉 Project created at: ${projectPath}`));
      console.log(chalk.yellow('\n📝 Next steps:'));
      console.log(chalk.gray(`   cd ${options.projectName}`));

      if (template.language === 'typescript' || template.language === 'javascript') {
        console.log(chalk.gray('   npm install'));
        console.log(chalk.gray('   npm run dev'));
      } else if (template.language === 'python') {
        console.log(chalk.gray('   pip install -r requirements.txt'));
        console.log(chalk.gray('   python main.py'));
      }

      console.log(chalk.gray('\n   # Configure your API key:'));
      console.log(chalk.gray('   whizzy auth login'));
    } catch (error) {
      spinner.fail('Failed to create project');
      throw error;
    }
  }

  /**
   * Generate project files based on template
   */
  private generateProjectFiles(
    template: ScaffoldTemplate,
    projectPath: string,
    options: ScaffoldOptions
  ): void {
    const features = options.features || template.features;

    switch (template.name) {
      case 'nextjs-app':
        this.generateNextJSApp(projectPath, features);
        break;
      case 'react-app':
        this.generateReactApp(projectPath, features);
        break;
      case 'nodejs-api':
        this.generateNodeJSAPI(projectPath, features);
        break;
      case 'python-app':
        this.generatePythonApp(projectPath, features);
        break;
      case 'vanilla-js':
        this.generateVanillaJS(projectPath, features);
        break;
      default:
        throw new Error(`Template "${template.name}" not implemented`);
    }
  }

  /**
   * Generate Next.js application
   */
  private generateNextJSApp(projectPath: string, _features: string[]): void {
    // package.json
    const packageJson = {
      name: path.basename(projectPath),
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        lint: 'next lint',
      },
      dependencies: {
        next: '^14.0.0',
        react: '^18.0.0',
        'react-dom': '^18.0.0',
        '@whizurai/sdk': '^0.2.0',
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        '@types/react': '^18.0.0',
        '@types/react-dom': '^18.0.0',
        eslint: '^8.0.0',
        'eslint-config-next': '^14.0.0',
        typescript: '^5.0.0',
      },
    };

    fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Create basic Next.js structure
    const pagesDir = path.join(projectPath, 'pages');
    const apiDir = path.join(pagesDir, 'api');
    fs.mkdirSync(apiDir, { recursive: true });

    // pages/index.tsx
    const indexPage = `import { useState } from 'react';
import { WhizuraiClient } from '@whizurai/sdk';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setLoading(true);
    try {
      const client = new WhizuraiClient({
        apiKey: process.env.NEXT_PUBLIC_WHIZURAI_API_KEY,
      });
      
      const response = await client.generate({
        prompt,
        model: 'gpt-3.5-turbo',
      });
      
      setResult(response.content);
    } catch (error) {
      console.error('Generation failed:', error);
      setResult('Error: Failed to generate content');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Whizurai Next.js App</h1>
      <div style={{ marginBottom: '1rem' }}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt here..."
          style={{ width: '100%', height: '100px', padding: '0.5rem' }}
        />
      </div>
      <button
        onClick={handleGenerate}
        disabled={loading || !prompt.trim()}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: loading ? '#ccc' : '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Generating...' : 'Generate Content'}
      </button>
      {result && (
        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <h3>Generated Content:</h3>
          <p>{result}</p>
        </div>
      )}
    </div>
  );
}`;

    fs.writeFileSync(path.join(pagesDir, 'index.tsx'), indexPage);

    // .env.local
    const envContent = `# Whizurai API Configuration
NEXT_PUBLIC_WHIZURAI_API_KEY=your_api_key_here
NEXT_PUBLIC_WHIZURAI_BASE_URL=http://api.whizurai.com`;

    fs.writeFileSync(path.join(projectPath, '.env.local'), envContent);

    // README.md
    const readme = `# Whizurai Next.js App

This is a sample Next.js application demonstrating Whizurai integration.

## Features

- Content generation using Whizurai API
- React-based user interface
- TypeScript support

## Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Configure your API key in \`.env.local\`:
   \`\`\`bash
   NEXT_PUBLIC_WHIZURAI_API_KEY=your_api_key_here
   \`\`\`

3. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

4. Open [http://api.whizurai.com](http://api.whizurai.com) in your browser.

## Usage

Enter a prompt in the text area and click "Generate Content" to create AI-generated content using the Whizurai platform.
`;

    fs.writeFileSync(path.join(projectPath, 'README.md'), readme);
  }

  /**
   * Generate React application
   */
  private generateReactApp(projectPath: string, _features: string[]): void {
    // package.json
    const packageJson = {
      name: path.basename(projectPath),
      version: '0.1.0',
      private: true,
      scripts: {
        start: 'react-scripts start',
        build: 'react-scripts build',
        test: 'react-scripts test',
        eject: 'react-scripts eject',
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
        '@whizurai/sdk': '^0.2.0',
        axios: '^1.6.2',
      },
      devDependencies: {
        'react-scripts': '^5.0.1',
        '@types/react': '^18.2.0',
        '@types/react-dom': '^18.2.0',
        typescript: '^5.0.0',
      },
    };

    fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Create src directory
    const srcDir = path.join(projectPath, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    // src/App.tsx
    const appContent = `import React, { useState } from 'react';
import { WhizuraiClient } from '@whizurai/sdk';
import './App.css';

function App() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setLoading(true);
    try {
      const client = new WhizuraiClient({
        apiKey: process.env.REACT_APP_WHIZURAI_API_KEY,
      });
      
      const response = await client.generate({
        prompt,
        model: 'gpt-3.5-turbo',
      });
      
      setResult(response.content);
    } catch (error) {
      console.error('Generation failed:', error);
      setResult('Error: Failed to generate content');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Whizurai React App</h1>
        <div className="input-section">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
            rows={4}
            cols={50}
          />
          <button onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating...' : 'Generate Content'}
          </button>
        </div>
        {result && (
          <div className="result-section">
            <h3>Generated Content:</h3>
            <p>{result}</p>
          </div>
        )}
      </header>
    </div>
  );
}

export default App;`;

    fs.writeFileSync(path.join(srcDir, 'App.tsx'), appContent);

    // src/App.css
    const appCss = `.App {
  text-align: center;
}

.App-header {
  background-color: #282c34;
  padding: 20px;
  color: white;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.input-section {
  margin: 20px 0;
}

.input-section textarea {
  width: 100%;
  max-width: 600px;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
}

.input-section button {
  background-color: #61dafb;
  color: #282c34;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
}

.input-section button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.result-section {
  margin-top: 20px;
  max-width: 800px;
  text-align: left;
  background-color: #f5f5f5;
  padding: 20px;
  border-radius: 4px;
  color: #282c34;
}`;

    fs.writeFileSync(path.join(srcDir, 'App.css'), appCss);

    // src/index.tsx
    const indexContent = `import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;

    fs.writeFileSync(path.join(srcDir, 'index.tsx'), indexContent);

    // src/index.css
    const indexCss = `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}`;

    fs.writeFileSync(path.join(srcDir, 'index.css'), indexCss);

    // public/index.html
    const publicDir = path.join(projectPath, 'public');
    fs.mkdirSync(publicDir, { recursive: true });

    const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="Whizurai React App" />
    <title>Whizurai React App</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>`;

    fs.writeFileSync(path.join(publicDir, 'index.html'), indexHtml);

    // .env.local
    const envContent = `# Whizurai API Configuration
REACT_APP_WHIZURAI_API_KEY=your_api_key_here
REACT_APP_WHIZURAI_BASE_URL=https://api.whizurai.com`;

    fs.writeFileSync(path.join(projectPath, '.env.local'), envContent);

    // README.md
    const readme = `# Whizurai React App

This is a sample React application demonstrating Whizurai integration.

## Features

- Content generation using Whizurai API
- React-based user interface
- TypeScript support

## Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Configure your API key in \`.env.local\`:
   \`\`\`bash
   REACT_APP_WHIZURAI_API_KEY=your_api_key_here
   \`\`\`

3. Start the development server:
   \`\`\`bash
   npm start
   \`\`\`

4. Open [http://api.whizurai.com](http://api.whizurai.com) in your browser.

## Usage

Enter a prompt in the text area and click "Generate Content" to create AI-generated content using the Whizurai platform.`;

    fs.writeFileSync(path.join(projectPath, 'README.md'), readme);
  }

  /**
   * Generate Node.js API
   */
  private generateNodeJSAPI(projectPath: string, _features: string[]): void {
    // package.json
    const packageJson = {
      name: path.basename(projectPath),
      version: '0.1.0',
      description: 'Whizurai Node.js API',
      main: 'src/index.js',
      scripts: {
        start: 'node src/index.js',
        dev: 'nodemon src/index.js',
        test: 'jest',
      },
      dependencies: {
        express: '^4.18.2',
        '@whizurai/sdk': '^0.2.0',
        cors: '^2.8.5',
        dotenv: '^16.3.1',
        helmet: '^7.1.0',
      },
      devDependencies: {
        nodemon: '^3.0.2',
        jest: '^29.7.0',
        '@types/express': '^4.17.21',
        '@types/cors': '^2.8.17',
        typescript: '^5.0.0',
        'ts-node': '^10.9.2',
      },
    };

    fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Create src directory
    const srcDir = path.join(projectPath, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    // src/index.ts
    const indexContent = `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { WhizuraiClient } from '@whizurai/sdk';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize Whizurai client
const client = new WhizuraiClient({
  apiKey: process.env.WHIZURAI_API_KEY,
  baseUrl: process.env.WHIZURAI_BASE_URL || 'https://api.whizurai.com',
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Generate content endpoint
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, model = 'gpt-3.5-turbo', maxTokens = 1000 } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const response = await client.generate({
      prompt,
      model,
      maxTokens,
    });

    res.json({
      success: true,
      content: response.content,
      model: response.model,
      usage: response.usage,
    });
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate content' 
    });
  }
});

// Enrich content endpoint
app.post('/api/enrich', async (req, res) => {
  try {
    const { content, type = 'text' } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const response = await client.enrich({
      content,
      type,
    });

    res.json({
      success: true,
      enriched: response,
    });
  } catch (error) {
    console.error('Enrichment error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to enrich content' 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(\`🚀 Server running on port \${PORT}\`);
  console.log(\`📚 API Documentation: http://localhost:\${PORT}/health\`);
});

export default app;`;

    fs.writeFileSync(path.join(srcDir, 'index.ts'), indexContent);

    // .env
    const envContent = `# Whizurai API Configuration
WHIZURAI_API_KEY=your_api_key_here
WHIZURAI_BASE_URL=https://api.whizurai.com

# Server Configuration
PORT=3000
NODE_ENV=development`;

    fs.writeFileSync(path.join(projectPath, '.env'), envContent);

    // .env.example
    const envExampleContent = `# Whizurai API Configuration
WHIZURAI_API_KEY=your_api_key_here
WHIZURAI_BASE_URL=https://api.whizurai.com

# Server Configuration
PORT=3000
NODE_ENV=development`;

    fs.writeFileSync(path.join(projectPath, '.env.example'), envExampleContent);

    // tsconfig.json
    const tsconfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist'],
    };

    fs.writeFileSync(path.join(projectPath, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

    // README.md
    const readme = `# Whizurai Node.js API

A Node.js API server demonstrating Whizurai integration with Express.js and TypeScript.

## Features

- Content generation using Whizurai API
- Content enrichment and analysis
- RESTful API endpoints
- TypeScript support
- CORS and security middleware

## Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Configure your API key in \`.env\`:
   \`\`\`bash
   WHIZURAI_API_KEY=your_api_key_here
   \`\`\`

3. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

4. The API will be available at http://api.whizurai.com

## API Endpoints

### Health Check
- \`GET /health\` - Check server status

### Content Generation
- \`POST /api/generate\` - Generate content
  - Body: \`{ "prompt": "Your prompt here", "model": "gpt-3.5-turbo", "maxTokens": 1000 }\`

### Content Enrichment
- \`POST /api/enrich\` - Enrich content
  - Body: \`{ "content": "Your content here", "type": "text" }\`

## Usage

\`\`\`bash
# Generate content
curl -X POST http://api.whizurai.com/api/generate \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Write a story about a robot", "model": "gpt-3.5-turbo"}'

# Enrich content
curl -X POST http://api.whizurai.com/api/enrich \\
  -H "Content-Type: application/json" \\
  -d '{"content": "This is a sample text", "type": "text"}'
\`\`\``;

    fs.writeFileSync(path.join(projectPath, 'README.md'), readme);
  }

  /**
   * Generate Python application
   */
  private generatePythonApp(projectPath: string, _features: string[]): void {
    // requirements.txt
    const requirements = `fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
python-dotenv==1.0.0
httpx==0.25.2
pytest==7.4.3
pytest-asyncio==0.21.1`;

    fs.writeFileSync(path.join(projectPath, 'requirements.txt'), requirements);

    // main.py
    const mainContent = `import os
import asyncio
from typing import Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
import httpx

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Whizurai Python API",
    description="A Python API server demonstrating Whizurai integration",
    version="0.1.0"
)

# Whizurai API configuration
WHIZURAI_API_KEY = os.getenv("WHIZURAI_API_KEY")
WHIZURAI_BASE_URL = os.getenv("WHIZURAI_BASE_URL", "https://api.whizurai.com")

# Request models
class GenerateRequest(BaseModel):
    prompt: str
    model: Optional[str] = "gpt-3.5-turbo"
    max_tokens: Optional[int] = 1000

class EnrichRequest(BaseModel):
    content: str
    type: Optional[str] = "text"

# Whizurai client
class WhizuraiClient:
    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    async def generate(self, prompt: str, model: str = "gpt-3.5-turbo", max_tokens: int = 1000):
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/v1/generate",
                headers=self.headers,
                json={
                    "prompt": prompt,
                    "model": model,
                    "max_tokens": max_tokens
                }
            )
            response.raise_for_status()
            return response.json()
    
    async def enrich(self, content: str, type: str = "text"):
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/v1/enrich",
                headers=self.headers,
                json={
                    "content": content,
                    "type": type
                }
            )
            response.raise_for_status()
            return response.json()

# Initialize client
client = WhizuraiClient(WHIZURAI_API_KEY, WHIZURAI_BASE_URL)

@app.get("/")
async def root():
    return {"message": "Whizurai Python API", "status": "running"}

@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": "2024-01-01T00:00:00Z"}

@app.post("/api/generate")
async def generate_content(request: GenerateRequest):
    try:
        if not WHIZURAI_API_KEY:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        result = await client.generate(
            prompt=request.prompt,
            model=request.model,
            max_tokens=request.max_tokens
        )
        
        return {
            "success": True,
            "content": result.get("content", ""),
            "model": result.get("model", request.model),
            "usage": result.get("usage", {})
        }
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="API request failed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

@app.post("/api/enrich")
async def enrich_content(request: EnrichRequest):
    try:
        if not WHIZURAI_API_KEY:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        result = await client.enrich(
            content=request.content,
            type=request.type
        )
        
        return {
            "success": True,
            "enriched": result
        }
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail="API request failed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Enrichment failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)`;

    fs.writeFileSync(path.join(projectPath, 'main.py'), mainContent);

    // .env
    const envContent = `# Whizurai API Configuration
WHIZURAI_API_KEY=your_api_key_here
WHIZURAI_BASE_URL=https://api.whizurai.com

# Server Configuration
PORT=8000
HOST=0.0.0.0`;

    fs.writeFileSync(path.join(projectPath, '.env'), envContent);

    // .env.example
    const envExampleContent = `# Whizurai API Configuration
WHIZURAI_API_KEY=your_api_key_here
WHIZURAI_BASE_URL=https://api.whizurai.com

# Server Configuration
PORT=8000
HOST=0.0.0.0`;

    fs.writeFileSync(path.join(projectPath, '.env.example'), envExampleContent);

    // test_main.py
    const testContent = `import pytest
import asyncio
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["message"] == "Whizurai Python API"

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_generate_missing_api_key():
    response = client.post("/api/generate", json={"prompt": "test"})
    assert response.status_code == 500
    assert "API key not configured" in response.json()["detail"]

def test_enrich_missing_api_key():
    response = client.post("/api/enrich", json={"content": "test"})
    assert response.status_code == 500
    assert "API key not configured" in response.json()["detail"]`;

    fs.writeFileSync(path.join(projectPath, 'test_main.py'), testContent);

    // README.md
    const readme = `# Whizurai Python API

A Python API server demonstrating Whizurai integration with FastAPI and asyncio.

## Features

- Content generation using Whizurai API
- Content enrichment and analysis
- FastAPI with automatic API documentation
- Async/await support
- Type hints and Pydantic models
- Comprehensive testing

## Setup

1. Create a virtual environment:
   \`\`\`bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\\Scripts\\activate
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   pip install -r requirements.txt
   \`\`\`

3. Configure your API key in \`.env\`:
   \`\`\`bash
   WHIZURAI_API_KEY=your_api_key_here
   \`\`\`

4. Start the development server:
   \`\`\`bash
   python main.py
   \`\`\`

5. The API will be available at http://localhost:8000
6. API documentation at http://localhost:8000/docs

## API Endpoints

### Health Check
- \`GET /\` - Root endpoint
- \`GET /health\` - Check server status

### Content Generation
- \`POST /api/generate\` - Generate content
  - Body: \`{ "prompt": "Your prompt here", "model": "gpt-3.5-turbo", "max_tokens": 1000 }\`

### Content Enrichment
- \`POST /api/enrich\` - Enrich content
  - Body: \`{ "content": "Your content here", "type": "text" }\`

## Testing

Run the test suite:
\`\`\`bash
pytest test_main.py -v
\`\`\`

## Usage

\`\`\`bash
# Generate content
curl -X POST http://localhost:8000/api/generate \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Write a story about a robot", "model": "gpt-3.5-turbo"}'

# Enrich content
curl -X POST http://localhost:8000/api/enrich \\
  -H "Content-Type: application/json" \\
  -d '{"content": "This is a sample text", "type": "text"}'
\`\`\``;

    fs.writeFileSync(path.join(projectPath, 'README.md'), readme);
  }

  /**
   * Generate Vanilla JavaScript
   */
  private generateVanillaJS(projectPath: string, _features: string[]): void {
    // package.json
    const packageJson = {
      name: path.basename(projectPath),
      version: '0.1.0',
      description: 'Whizurai Vanilla JavaScript App',
      main: 'src/index.js',
      scripts: {
        start: 'npx http-server src -p 3000 -o',
        build: 'npx webpack --mode production',
        dev: 'npx webpack serve --mode development',
      },
      dependencies: {
        '@whizurai/sdk': '^0.2.0',
      },
      devDependencies: {
        'http-server': '^14.1.1',
        webpack: '^5.89.0',
        'webpack-cli': '^5.1.4',
        'webpack-dev-server': '^4.15.1',
        'html-webpack-plugin': '^5.5.3',
        'css-loader': '^6.8.1',
        'style-loader': '^3.3.3',
      },
    };

    fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify(packageJson, null, 2));

    // Create src directory
    const srcDir = path.join(projectPath, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    // src/index.html
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Whizurai Vanilla JS App</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>🤖 Whizurai Vanilla JS App</h1>
            <p>Generate amazing content with AI</p>
        </header>
        
        <main>
            <div class="input-section">
                <label for="prompt">Enter your prompt:</label>
                <textarea 
                    id="prompt" 
                    placeholder="Write a story about a robot learning to paint..."
                    rows="4"
                ></textarea>
                
                <div class="controls">
                    <select id="model">
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                        <option value="gpt-4">GPT-4</option>
                    </select>
                    
                    <input 
                        type="number" 
                        id="maxTokens" 
                        placeholder="Max tokens" 
                        value="1000"
                        min="1"
                        max="4000"
                    >
                    
                    <button id="generateBtn">Generate Content</button>
                </div>
            </div>
            
            <div class="result-section" id="resultSection" style="display: none;">
                <h3>Generated Content:</h3>
                <div id="result" class="result-content"></div>
                <button id="copyBtn">Copy to Clipboard</button>
            </div>
            
            <div class="loading" id="loading" style="display: none;">
                <div class="spinner"></div>
                <p>Generating content...</p>
            </div>
        </main>
        
        <footer>
            <p>Powered by <a href="https://whizurai.com" target="_blank">Whizurai</a></p>
        </footer>
    </div>
    
    <script src="app.js"></script>
</body>
</html>`;

    fs.writeFileSync(path.join(srcDir, 'index.html'), indexHtml);

    // src/styles.css
    const stylesCss = `* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    line-height: 1.6;
    color: #333;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
}

header {
    text-align: center;
    margin-bottom: 3rem;
    color: white;
}

header h1 {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

header p {
    font-size: 1.2rem;
    opacity: 0.9;
}

main {
    background: white;
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}

.input-section {
    margin-bottom: 2rem;
}

label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: #555;
}

textarea {
    width: 100%;
    padding: 1rem;
    border: 2px solid #e1e5e9;
    border-radius: 8px;
    font-size: 1rem;
    font-family: inherit;
    resize: vertical;
    transition: border-color 0.3s ease;
}

textarea:focus {
    outline: none;
    border-color: #667eea;
}

.controls {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
    flex-wrap: wrap;
}

select, input[type="number"] {
    padding: 0.75rem;
    border: 2px solid #e1e5e9;
    border-radius: 6px;
    font-size: 1rem;
    flex: 1;
    min-width: 150px;
}

button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    flex: 1;
    min-width: 150px;
}

button:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

button:active {
    transform: translateY(0);
}

button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
}

.result-section {
    margin-top: 2rem;
    padding: 1.5rem;
    background: #f8f9fa;
    border-radius: 8px;
    border-left: 4px solid #667eea;
}

.result-content {
    background: white;
    padding: 1.5rem;
    border-radius: 6px;
    margin: 1rem 0;
    white-space: pre-wrap;
    line-height: 1.8;
    border: 1px solid #e1e5e9;
}

.loading {
    text-align: center;
    padding: 2rem;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

footer {
    text-align: center;
    margin-top: 3rem;
    color: white;
    opacity: 0.8;
}

footer a {
    color: white;
    text-decoration: none;
}

footer a:hover {
    text-decoration: underline;
}

@media (max-width: 600px) {
    .container {
        padding: 1rem;
    }
    
    .controls {
        flex-direction: column;
    }
    
    select, input[type="number"], button {
        min-width: 100%;
    }
}`;

    fs.writeFileSync(path.join(srcDir, 'styles.css'), stylesCss);

    // src/app.js
    const appJs = `// Whizurai Vanilla JavaScript App
class WhizuraiApp {
    constructor() {
        this.apiKey = null;
        this.baseUrl = 'https://api.whizurai.com';
        this.initializeApp();
    }

    initializeApp() {
        this.promptTextarea = document.getElementById('prompt');
        this.modelSelect = document.getElementById('model');
        this.maxTokensInput = document.getElementById('maxTokens');
        this.generateBtn = document.getElementById('generateBtn');
        this.resultSection = document.getElementById('resultSection');
        this.resultDiv = document.getElementById('result');
        this.copyBtn = document.getElementById('copyBtn');
        this.loadingDiv = document.getElementById('loading');

        this.generateBtn.addEventListener('click', () => this.generateContent());
        this.copyBtn.addEventListener('click', () => this.copyToClipboard());

        this.checkApiKey();
    }

    async checkApiKey() {
        // In a real app, you'd get this from environment variables or user input
        this.apiKey = prompt('Please enter your Whizurai API key:');
        
        if (!this.apiKey) {
            alert('API key is required to use this app. Please refresh and try again.');
            return;
        }
    }

    async generateContent() {
        const prompt = this.promptTextarea.value.trim();
        const model = this.modelSelect.value;
        const maxTokens = parseInt(this.maxTokensInput.value);

        if (!prompt) {
            alert('Please enter a prompt');
            return;
        }

        if (!this.apiKey) {
            alert('API key is required');
            return;
        }

        this.showLoading(true);
        this.resultSection.style.display = 'none';

        try {
            const response = await fetch(\`\${this.baseUrl}/v1/generate\`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': \`Bearer \${this.apiKey}\`
                },
                body: JSON.stringify({
                    prompt,
                    model,
                    max_tokens: maxTokens
                })
            });

            if (!response.ok) {
                throw new Error(\`API request failed: \${response.status}\`);
            }

            const data = await response.json();
            this.displayResult(data.content || 'No content generated');
        } catch (error) {
            console.error('Generation error:', error);
            this.displayResult(\`Error: \${error.message}\`);
        } finally {
            this.showLoading(false);
        }
    }

    displayResult(content) {
        this.resultDiv.textContent = content;
        this.resultSection.style.display = 'block';
    }

    async copyToClipboard() {
        try {
            await navigator.clipboard.writeText(this.resultDiv.textContent);
            this.copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                this.copyBtn.textContent = 'Copy to Clipboard';
            }, 2000);
        } catch (error) {
            console.error('Copy failed:', error);
            alert('Failed to copy to clipboard');
        }
    }

    showLoading(show) {
        this.loadingDiv.style.display = show ? 'block' : 'none';
        this.generateBtn.disabled = show;
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WhizuraiApp();
});`;

    fs.writeFileSync(path.join(srcDir, 'app.js'), appJs);

    // webpack.config.js
    const webpackConfig = `const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = {
  entry: './src/app.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  module: {
    rules: [
      {
        test: /\\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'src'),
    },
    compress: true,
    port: 3000,
    open: true,
  },
};`;

    fs.writeFileSync(path.join(projectPath, 'webpack.config.js'), webpackConfig);

    // .env
    const envContent = `# Whizurai API Configuration
WHIZURAI_API_KEY=your_api_key_here
WHIZURAI_BASE_URL=https://api.whizurai.com`;

    fs.writeFileSync(path.join(projectPath, '.env'), envContent);

    // README.md
    const readme = `# Whizurai Vanilla JavaScript App

A vanilla JavaScript application demonstrating Whizurai integration with modern web technologies.

## Features

- Content generation using Whizurai API
- Modern ES6+ JavaScript
- Responsive design with CSS Grid and Flexbox
- Webpack for bundling and development
- No framework dependencies

## Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Configure your API key in \`.env\`:
   \`\`\`bash
   WHIZURAI_API_KEY=your_api_key_here
   \`\`\`

3. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

4. Or start a simple HTTP server:
   \`\`\`bash
   npm start
   \`\`\`

5. Open http://api.whizurai.com in your browser

## Build for Production

\`\`\`bash
npm run build
\`\`\`

This will create a \`dist\` folder with the bundled application.

## Usage

1. Enter your Whizurai API key when prompted
2. Type your prompt in the text area
3. Select a model and set max tokens
4. Click "Generate Content" to create AI-generated content
5. Copy the result to your clipboard

## Project Structure

\`\`\`
src/
├── index.html    # Main HTML file
├── styles.css    # CSS styles
└── app.js        # JavaScript application logic
\`\`\`

## API Integration

The app uses the Whizurai REST API directly with fetch:

\`\`\`javascript
const response = await fetch(\`\${baseUrl}/v1/generate\`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${apiKey}\`
  },
  body: JSON.stringify({
    prompt,
    model,
    max_tokens: maxTokens
  })
});
\`\`\``;

    fs.writeFileSync(path.join(projectPath, 'README.md'), readme);
  }
}
