import express, { Request, Response } from 'express';
import cloudProviderManager from '../cloud-provider-manager.js';
import { ProviderInfo, AddProviderRequest, RemoveProviderRequest } from '../types.js';

const router = express.Router();

// Provider endpoint to add a new provider
router.post('/add-provider', async (req: Request, res: Response) => {
  try {
    const { providerType, credentials }: AddProviderRequest = req.body;
    
    if (!providerType || !credentials) {
      return res.status(400).json({ error: 'Missing required fields: providerType, credentials' });
    }
        
    // Validate credentials
    if (!credentials.appKey || !credentials.appSecret) {
      return res.status(400).json({ error: 'Missing required credentials: appKey and appSecret' });
    }
    
    // Add the provider to the manager
    await cloudProviderManager.addProvider(providerType.toLowerCase());
    const assignedInstanceIndex = cloudProviderManager.providers[providerType.toLowerCase()].length - 1;
    
    // Write credentials to .env file
    cloudProviderManager.writeEnvVariables(providerType.toLowerCase(), assignedInstanceIndex, {
      appKey: credentials.appKey,
      appSecret: credentials.appSecret,
      refreshToken: credentials.refreshToken,
      accessToken: credentials.accessToken
    });
    
    res.json({ 
      message: 'Provider added successfully',
      providerType: providerType.toLowerCase(),
      instanceIndex: assignedInstanceIndex
    });
    
  } catch (error) {
    console.error('Error adding provider:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Provider endpoint to get all providers
router.get('/providers', async (req: Request, res: Response) => {
  try {
    const providers: ProviderInfo[] = [];
    
    // Get all provider types
    for (const [providerType, instances] of Object.entries(cloudProviderManager.providers)) {
      for (let i = 0; i < instances.length; i++) {
        const provider = instances[i];
        const providerInfo: ProviderInfo = {
          type: providerType,
          instanceIndex: i,
          authenticated: provider.isAuthenticated ? provider.isAuthenticated() : false
        };
        
        // Try to get account info if authenticated
        if (providerInfo.authenticated && provider.getAccountInfo) {
          try {
            providerInfo.accountInfo = await provider.getAccountInfo();
          } catch (error) {
            console.warn(`Failed to get account info for ${providerType} instance ${i}:`, error instanceof Error ? error.message : 'Unknown error');
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
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Provider endpoint to get photos
router.get('/photos', async (req: Request, res: Response) => {
  try {
    // Use the manager to get the first Dropbox provider instance (index 0)
    const provider = cloudProviderManager.getProvider('DROPBOX', 0);
    const files = await provider.listFiles('');
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// Provider endpoint to remove a provider
router.delete('/remove-provider', async (req: Request, res: Response) => {
  try {
    const { providerType, instanceIndex }: RemoveProviderRequest = req.body;
    
    if (!providerType || instanceIndex === undefined) {
      return res.status(400).json({ error: 'At least one of the following fields is missing: providerType, instanceIndex' });
    }
    
    // Validate instance index
    const indexNum = parseInt(instanceIndex.toString());
    if (isNaN(indexNum) || indexNum < 0) {
      return res.status(400).json({ error: 'Instance index must be a non-negative number' });
    }
    
    // Remove the provider from the manager
    cloudProviderManager.removeProvider(providerType.toLowerCase(), indexNum);
    
    res.json({ 
      message: 'Provider removed successfully',
      providerType: providerType.toLowerCase(),
      instanceIndex: indexNum
    });
    
  } catch (error) {
    console.error('Error removing provider:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router; 