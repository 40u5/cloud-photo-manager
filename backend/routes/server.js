import express from 'express';
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
const OAUTH_ROUTE = '/auth';
const PROVIDER_ROUTE = '/provider';

// Export redirect URI configuration for use in other modules
export const getRedirectUri = (req) => `${req.protocol}://${req.get('host')}${OAUTH_ROUTE}/`;
export const getStaticRedirectUri = () => `http://localhost:${PORT}${OAUTH_ROUTE}/`;

// Add middleware to parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());


// Add CORS headers to allow frontend requests
app.use((req, res, next) => {
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

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../../frontend')));

app.use(OAUTH_ROUTE, oauthRouter);
app.use(PROVIDER_ROUTE, providerRouter);

console.log('redirect URI:', getStaticRedirectUri());

// Home page - serve the frontend HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// Initialize CloudProviderManager before starting the server
(async () => {
  await cloudProviderManager.initialize();

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
})();

