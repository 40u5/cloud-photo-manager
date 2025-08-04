import express from 'express';
import cloudProviderManager from '../cloud-provider-manager.js';
import envFileManager from '../env-file-manager.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { code, state } = req.query;
  
  try {
    // Get the provider type and index from state parameter
    // State format: "providerType:index" (e.g., "dropbox:0")
    const [providerType, indexStr] = state.split(':');
    const indexNum = parseInt(indexStr) || 0;
    
    // Get the provider instance
    let providerInstance;
    try {
      providerInstance = cloudProviderManager.getProvider(providerType.toLowerCase(), indexNum);
    } catch (error) {
      return res.status(404).json({ 
        error: `Provider not found: ${error.message}` 
      });
    }
    
    // Get credentials from environment variables
    const patterns = providerInstance.getEnvVariablePatterns(indexNum);
    const APP_KEY = envFileManager.getValue(patterns.appKey);
    const APP_SECRET = envFileManager.getValue(patterns.appSecret);
    const redirectUri = `${req.protocol}://${req.get('host')}/auth/`;
    
    if (!APP_KEY || !APP_SECRET) {
      return res.status(500).json({ 
        error: `${patterns.appKey} or ${patterns.appSecret} not configured` 
      });
    }
    
    // Exchange code for tokens using provider's method
    const tokenData = await providerInstance.exchangeCodeForToken(code, APP_KEY, APP_SECRET, redirectUri);
    const { access_token, refresh_token } = tokenData;
    
    // Store tokens in variables and update .env file using cloud provider manager
    cloudProviderManager.updateEnvVariables(providerType.toLowerCase(), indexNum, {
      accessToken: access_token,
      refreshToken: refresh_token
    });
    
    // Now authenticate the provider with the new tokens
    try {
      const authenticated = cloudProviderManager.addCredentials(providerType.toLowerCase(), indexNum);
      if (authenticated) {
        console.log(`Successfully authenticated ${providerType} provider instance ${indexNum}`);
      } else {
        console.warn(`Failed to authenticate ${providerType} provider instance ${indexNum}`);
      }
    } catch (error) {
      console.error(`Error authenticating provider instance ${indexNum}:`, error.message);
    }
    
    // Redirect to home page
    res.redirect(`/`);
    
  } catch (error) {
    console.error('Error exchanging code for tokens:', error.response?.data || error.message);
    
    let errorMessage = 'Failed to exchange code for tokens';
    if (error.response?.data?.error === 'invalid_grant') {
      errorMessage = 'The authorization code has expired or been used already. Please try again.';
    } else if (error.response?.data?.error === 'redirect_uri_mismatch') {
      errorMessage = 'Redirect URI mismatch. Make sure the redirect URI is registered.';
    }
    
    res.redirect(`/`);
  }
});

// Endpoint to authorize any provider type
router.get('/authorize', (req, res) => {
  const { providerType, index } = req.query;
  
  let providerError = !providerType ? 'Missing required parameter: providerType': ''
  let indexError = !index ? 'Missing required parameter: index' : '';
  if (!indexError && (isNaN(index) || index < 0)) indexError = 'Index must be a non-negative number';
  if (providerError || indexError) {
    return res.status(400).json({ 
      error: providerError || indexError 
    });
  }
  
  try {
    // Get the provider instance to access its methods
    let providerInstance;
    try {
      providerInstance = cloudProviderManager.getProvider(providerType.toLowerCase(), index);
    } catch (error) {
      // If provider doesn't exist, create a new instance and add it to the manager
      providerInstance = new (cloudProviderManager.getProviderClass(providerType.toLowerCase()))(false);
      // Add the provider to the manager so it can be found in future requests
      cloudProviderManager.providers[providerType.toLowerCase()] = cloudProviderManager.providers[providerType.toLowerCase()] || [];
      cloudProviderManager.providers[providerType.toLowerCase()].push(providerInstance);
    }
    
    // Ensure .env file exists
    envFileManager.createEnvFile();

    // Get the corresponding app key based on index
    const patterns = providerInstance.getEnvVariablePatterns(index);
    const APP_KEY = envFileManager.getValue(patterns.appKey);
    
    if (!APP_KEY) {
      return res.status(500).json({ 
        error: `${patterns.appKey} not configured in environment variables` 
      });
    }
    
    // Include redirect_uri for automatic callback
    const redirectUri = `${req.protocol}://${req.get('host')}/auth/`;
    const state = `${providerType.toLowerCase()}:${index}`;
    
    // Use provider's method to get authorization URL
    const authUrl = providerInstance.getAuthorizationUrl(APP_KEY, redirectUri, state);
    
    // Automatically redirect user to provider's authorization page
    res.redirect(authUrl);
    
  } catch (error) {
    console.error(`Error authorizing ${providerType}:`, error.message);
    res.status(500).json({ 
      error: `Failed to authorize ${providerType}: ${error.message}` 
    });
  }
});

// Endpoint to refresh access token for any provider type
router.post('/refresh', async (req, res) => {
  try {
    const { providerType, index } = req.body;
    
    if (!providerType || index === undefined) {
      return res.status(400).json({ 
        error: 'Missing required parameters: providerType and index must be provided in request body' 
      });
    }
    
    const indexNum = parseInt(index);
    
    if (isNaN(indexNum) || indexNum < 0) {
      return res.status(400).json({ error: 'Index must be a non-negative number' });
    }
    
    // Get the provider instance
    let provider;
    try {
      provider = cloudProviderManager.getProvider(providerType.toLowerCase(), indexNum);
    } catch (error) {
      return res.status(404).json({ 
        error: `Provider not found: ${error.message}` 
      });
    }
    
    // Get credentials from environment variables
    const patterns = provider.getEnvVariablePatterns(indexNum);
    const credentials = {
      appKey: envFileManager.getValue(patterns.appKey),
      appSecret: envFileManager.getValue(patterns.appSecret),
      refreshToken: envFileManager.getValue(patterns.refreshToken)
    };
    
    if (!credentials.refreshToken || !credentials.appKey || !credentials.appSecret) {
      return res.status(400).json({ 
        error: `Missing required environment variables for ${providerType} provider at index ${indexNum}` 
      });
    }
    
    // Use the provider's refresh token method
    const result = await provider.refreshToken(credentials, indexNum);
    
    if (result.success) {
      res.json({
        message: result.message,
        access_token: result.accessToken.substring(0, 20) + '...',
        provider_type: providerType,
        index: indexNum
      });
    } else {
      res.status(400).json({ 
        error: result.error,
        details: result.details 
      });
    }
    
  } catch (error) {
    console.error('Error refreshing token:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to refresh access token',
      details: error.response?.data || error.message 
    });
  }
});

export default router;