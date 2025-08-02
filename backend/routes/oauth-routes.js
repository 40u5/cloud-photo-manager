import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cloudProviderManager from '../cloud-provider-manager.js';

dotenv.config();

const router = express.Router();

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Step 1: Redirect to Dropbox with callback URL
router.get('/dropbox/:index', (req, res) => {
  const { index } = req.params;
  
  // Validate that index is a number
  const indexNum = parseInt(index);
  if (isNaN(indexNum) || indexNum < 0) {
    return res.status(400).json({ error: 'Index must be a positive number' });
  }
  
  // Get the corresponding app key based on index
  const APP_KEY = process.env[`DROPBOX_APP_KEY_${indexNum}`];
  
  if (!APP_KEY) {
    return res.status(500).json({ error: `DROPBOX_APP_KEY_${indexNum} not configured in environment variables` });
  }
  
  // Include redirect_uri for automatic callback
  const redirectUri = `${req.protocol}://${req.get('host')}/`;
  const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${APP_KEY}&response_type=code&token_access_type=offline&redirect_uri=${encodeURIComponent(redirectUri)}&state=${indexNum}`;
  
  // Automatically redirect user to Dropbox
  res.redirect(authUrl);
});

// Step 2: Handle automatic callback from Dropbox at root endpoint
router.get('/', async (req, res) => {
  const { code, error, state } = req.query;
  
  // If no code or error, show the normal home page
  if (!code && !error) {
    return res.sendFile(path.join(__dirname, '../../frontend/index.html'));
  }
  
  // Handle OAuth callback - use dedicated callback page
  if (error || code) {
    return res.sendFile(path.join(__dirname, '../../frontend/oauth-callback.html'));
  }
  
  try {
    // Get the index from state parameter, default to 1 if not provided
    const indexNum = state ? parseInt(state) : 1;
    
    const APP_KEY = process.env[`DROPBOX_APP_KEY_${indexNum}`];
    const APP_SECRET = process.env[`DROPBOX_APP_SECRET_${indexNum}`];
    const redirectUri = `${req.protocol}://${req.get('host')}/`;
    
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
    
    const { access_token, refresh_token, expires_in } = response.data;
    
    // Update .env file using cloud provider manager
    cloudProviderManager.updateEnvVariables('dropbox', indexNum - 1, {
      access_token: access_token,
      refresh_token: refresh_token
    });
    
    // Update process.env for current session
    process.env[`DROPBOX_ACCESS_TOKEN_${indexNum}`] = access_token;
    process.env[`DROPBOX_REFRESH_TOKEN_${indexNum}`] = refresh_token;
    
    res.sendFile(path.join(__dirname, '../../frontend/oauth-callback.html'));
        
  } catch (error) {
    console.error('Error exchanging code for tokens:', error.response?.data || error.message);
    
    let errorMessage = 'Failed to exchange code for tokens';
    if (error.response?.data?.error === 'invalid_grant') {
      errorMessage = 'The authorization code has expired or been used already. Please try again.';
    } else if (error.response?.data?.error === 'redirect_uri_mismatch') {
      errorMessage = 'Redirect URI mismatch. Make sure the redirect URI is registered in your Dropbox app settings.';
    }
    
    res.status(500).sendFile(path.join(__dirname, '../../frontend/oauth-callback.html'));
  }
});



// Endpoint to refresh access token for specific index
router.post('/auth/refresh/:index', async (req, res) => {
  try {
    const { index } = req.params;
    const indexNum = parseInt(index);
    
    if (isNaN(indexNum) || indexNum < 1) {
      return res.status(400).json({ error: 'Index must be a positive number' });
    }
    
    const refreshToken = process.env[`DROPBOX_REFRESH_TOKEN_${indexNum}`];
    const APP_KEY = process.env[`DROPBOX_APP_KEY_${indexNum}`];
    const APP_SECRET = process.env[`DROPBOX_APP_SECRET_${indexNum}`];
    
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
    
    // Update .env file with new access token using cloud provider manager
    cloudProviderManager.updateEnvVariables('dropbox', indexNum - 1, {
      access_token: access_token
    });
    
    // Update process.env for current session
    process.env[`DROPBOX_ACCESS_TOKEN_${indexNum}`] = access_token;
    
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