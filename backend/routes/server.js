import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import oauthRouter from './oauth-routes.js';
import cloudProviderManager from '../cloud-provider-manager.js';

// Get current directory and project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(path.dirname(__dirname));

const app = express();
const PORT = 3000;

// Add middleware to parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../../frontend')));

app.use('/auth', oauthRouter);






// API endpoint to add a new provider
app.post('/api/add-provider', async (req, res) => {
  try {
    const { providerType, instanceIndex, credentials } = req.body;
    
    if (!providerType || instanceIndex === undefined || !credentials) {
      return res.status(400).json({ error: 'Missing required fields: providerType, instanceIndex, credentials' });
    }
    
    // Validate provider type
    if (providerType.toUpperCase() !== 'DROPBOX') {
      return res.status(400).json({ error: 'Only DROPBOX provider type is currently supported' });
    }
    
    // Validate instance index
    const indexNum = parseInt(instanceIndex);
    if (isNaN(indexNum) || indexNum < 0) {
      return res.status(400).json({ error: 'Instance index must be a non-negative number' });
    }
    
    // Validate credentials
    if (!credentials.appKey || !credentials.appSecret) {
      return res.status(400).json({ error: 'Missing required credentials: appKey and appSecret' });
    }
    
    // Add the provider to the manager
    await cloudProviderManager.addProvider(providerType.toUpperCase(), indexNum, true);
    
    // Write credentials to .env file
    cloudProviderManager.writeEnvVariables(providerType.toUpperCase(), indexNum, {
      appKey: credentials.appKey,
      appSecret: credentials.appSecret,
      refreshToken: credentials.refreshToken,
      accessToken: credentials.accessToken
    });
    
    res.json({ 
      message: 'Provider added successfully',
      providerType: providerType.toUpperCase(),
      instanceIndex: indexNum
    });
    
  } catch (error) {
    console.error('Error adding provider:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get all providers
app.get('/api/providers', async (req, res) => {
  try {
    const providers = [];
    
    // Get all provider types
    for (const [providerType, instances] of Object.entries(cloudProviderManager.providers)) {
      for (let i = 0; i < instances.length; i++) {
        const provider = instances[i];
        const providerInfo = {
          type: providerType,
          instanceIndex: i,
          authenticated: provider.isAuthenticated ? provider.isAuthenticated() : false
        };
        
        // Try to get account info if authenticated
        if (providerInfo.authenticated && provider.getAccountInfo) {
          try {
            providerInfo.accountInfo = await provider.getAccountInfo();
          } catch (error) {
            console.warn(`Failed to get account info for ${providerType} instance ${i}:`, error.message);
            // If getting account info fails, the provider might not be properly authenticated
            providerInfo.authenticated = false;
          }
        }
        
        providers.push(providerInfo);
      }
    }
    
    res.json(providers);
    
  } catch (error) {
    console.error('Error getting providers:', error);
    res.status(500).json({ error: error.message });
  }
});






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

app.get('/photos', async (req, res) => {
  try {
    // Use the manager to get the first Dropbox provider instance (index 0)
    const provider = cloudProviderManager.getProvider('DROPBOX', 0);
    const files = await provider.listFiles('');
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});