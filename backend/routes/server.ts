import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import oauthRouter from './oauth-routes.js';
import providerRouter from './provider-routes.js';
import cloudProviderManager from '../cloud-provider-manager.js';
import envFileManager from '../env-file-manager.js';

// Get current directory and project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
envFileManager.createEnvFile();

const app = express();
const PORT = 3000;
const OAUTH_ROUTE = '/oauth';
const PROVIDER_ROUTE = '/provider';

// Export redirect URI configuration for use in other modules
export const getRedirectUri = (req: Request): string => `${req.protocol}://${req.get('host')}${OAUTH_ROUTE}/`;
export const getStaticRedirectUri = (): string => `http://localhost:${PORT}${OAUTH_ROUTE}/`;

// Add middleware to parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Add CORS headers to allow frontend requests
app.use((req: Request, res: Response, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Serve static files from compiled frontend directory
app.use(express.static(path.join(__dirname, '../../../dist/frontend')));

app.use(OAUTH_ROUTE, oauthRouter);
app.use(PROVIDER_ROUTE, providerRouter);

console.log('redirect URI:', getStaticRedirectUri());

// Home page - serve the frontend HTML
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../../../dist/frontend/index.html'));
});

// Initialize CloudProviderManager before starting the server
(async () => {
  await cloudProviderManager.initialize();

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
})(); 