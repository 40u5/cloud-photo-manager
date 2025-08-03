import express from 'express';
import axios from 'axios';
import path from 'path';
import cloudProviderManager from '../cloud-provider-manager.js';
import envFileManager from '../env-file-manager.js';

const router = express.Router();

router.get('/dropbox/:index', (req, res) => {
  const { index } = req.params;
    
  // Validate that index is a number
  const indexNum = parseInt(index);
  if (isNaN(indexNum) || indexNum < 0) {
    return res.status(400).json({ error: 'Index must be a non-negative number' });
  }
  
  envFileManager.createEnvFile();
  // Get the corresponding app key based on index (0-based)
  const APP_KEY = envFileManager.getValue(`DROPBOX_APP_KEY_${indexNum}`);
  
  if (!APP_KEY) {
    return res.status(500).json({ error: `DROPBOX_APP_KEY_${indexNum} not configured in environment variables` });
  }
  
  // Include redirect_uri for automatic callback
  const redirectUri = `${req.protocol}://${req.get('host')}/auth/`;
  const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${APP_KEY}&response_type=code&token_access_type=offline&redirect_uri=${encodeURIComponent(redirectUri)}&state=${indexNum}`;
  
  // Automatically redirect user to Dropbox
  res.redirect(authUrl);
});

router.get('/', async (req, res) => {
  const { code, error, state } = req.query;
  
  // If no code or error, show the normal home page
  if (!code && !error) {
    return res.sendFile(path.join(__dirname, '../../frontend/index.html'));
  }
  
  try {
    // Get the index from state parameter, default to 0 if not provided
    const indexNum = state ? parseInt(state) : 0;
    
    const APP_KEY = envFileManager.getValue(`DROPBOX_APP_KEY_${indexNum}`);
    const APP_SECRET = envFileManager.getValue(`DROPBOX_APP_SECRET_${indexNum}`);
    const redirectUri = `${req.protocol}://${req.get('host')}/auth/`;
    
    if (!APP_KEY || !APP_SECRET) {
      return res.status(500).json({ error: `DROPBOX_APP_KEY_${indexNum} or DROPBOX_APP_SECRET_${indexNum} not configured` });
    }
    
    // Exchange code for tokens (include redirect_uri since we used it)
    const response = await axios.post('https://api.dropboxapi.com/oauth2/token', 
      new URLSearchParams({
        code: code,
        grant_type: 'authorization_code',
        client_id: APP_KEY,
        client_secret: APP_SECRET,
        redirect_uri: redirectUri  // Must match the one used in authorization
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const { access_token, refresh_token} = response.data;
    
    // Store tokens in variables and update .env file using cloud provider manager (0-based indexing)
    cloudProviderManager.updateEnvVariables('DROPBOX', indexNum, {
      accessToken: access_token,
      refreshToken: refresh_token
    });
    
    // Now authenticate the provider with the new tokens
    try {
      const authenticated = cloudProviderManager.addCredentials('DROPBOX', indexNum);
      if (authenticated) {
        console.log(`Successfully authenticated Dropbox provider instance ${indexNum}`);
      } else {
        console.warn(`Failed to authenticate Dropbox provider instance ${indexNum}`);
      }
    } catch (error) {
      console.error(`Error authenticating provider instance ${indexNum}:`, error.message);
    }
    
    // Redirect to home page with success parameter
    res.redirect(`/?auth_success=true`);
    
  } catch (error) {
    console.error('Error exchanging code for tokens:', error.response?.data || error.message);
    
    let errorMessage = 'Failed to exchange code for tokens';
    if (error.response?.data?.error === 'invalid_grant') {
      errorMessage = 'The authorization code has expired or been used already. Please try again.';
    } else if (error.response?.data?.error === 'redirect_uri_mismatch') {
      errorMessage = 'Redirect URI mismatch. Make sure the redirect URI is registered.';
    }
    
    // Redirect to home page with error parameter
    res.redirect(`/?auth_error=${encodeURIComponent(errorMessage)}`);
  }
});

// Endpoint to refresh access token for specific index
router.post('/refresh/:index', async (req, res) => {
  try {
    const { index } = req.params;
    const indexNum = parseInt(index);
    
    if (isNaN(indexNum) || indexNum < 0) {
      return res.status(400).json({ error: 'Index must be a non-negative number' });
    }
    
    const refreshToken = envFileManager.getValue(`DROPBOX_REFRESH_TOKEN_${indexNum}`);
    const APP_KEY = envFileManager.getValue(`DROPBOX_APP_KEY_${indexNum}`);
    const APP_SECRET = envFileManager.getValue(`DROPBOX_APP_SECRET_${indexNum}`);
    
    if (!refreshToken || !APP_KEY || !APP_SECRET) {
      return res.status(400).json({ error: `Missing required environment variables for index ${indexNum}` });
    }
    
    const response = await axios.post('https://api.dropboxapi.com/oauth2/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: APP_KEY,
        client_secret: APP_SECRET
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const { access_token, expires_in } = response.data;
    
    // Store new access token in variables and update .env file using cloud provider manager (0-based indexing)
    cloudProviderManager.updateEnvVariables('DROPBOX', indexNum, {
      accessToken: access_token
    });
    
    res.json({
      message: 'Access token refreshed successfully',
      access_token: access_token.substring(0, 20) + '...',
      expires_in
    });
    
  } catch (error) {
    console.error('Error refreshing token:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to refresh access token',
      details: error.response?.data || error.message 
    });
  }
});

export default router;