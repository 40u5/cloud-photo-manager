import express from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const router = express.Router();

// Step 1: Redirect to Dropbox with callback URL
router.get('/auth/dropbox', (req, res) => {
  const APP_KEY = process.env.DROPBOX_APP_KEY_1;
  
  if (!APP_KEY) {
    return res.status(500).json({ error: 'DROPBOX_APP_KEY_1 not configured in environment variables' });
  }
  
  // Include redirect_uri for automatic callback
  const redirectUri = `${req.protocol}://${req.get('host')}/`;
  const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${APP_KEY}&response_type=code&token_access_type=offline&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  // Automatically redirect user to Dropbox
  res.redirect(authUrl);
});

// Step 2: Handle automatic callback from Dropbox at root endpoint
router.get('/', async (req, res) => {
  const { code, error } = req.query;
  
  // If no code or error, show the normal home page
  if (!code && !error) {
    return res.send(`
      <html>
        <body>
          <h1>Dropbox OAuth App</h1>
          <p><a href="/auth/dropbox">Click here to authorize with Dropbox</a></p>
          <p><a href="/photos">View Photos</a></p>
        </body>
      </html>
    `);
  }
  
  // Handle OAuth callback
  if (error) {
    return res.status(400).send(`
      <html>
        <body>
          <h1>❌ Authorization Failed</h1>
          <p>Error: ${error}</p>
          <p><a href="/auth/dropbox">← Try again</a></p>
        </body>
      </html>
    `);
  }
  
  if (!code) {
    return res.status(400).send(`
      <html>
        <body>
          <h1>❌ Error</h1>
          <p>No authorization code received</p>
          <p><a href="/auth/dropbox">← Try again</a></p>
        </body>
      </html>
    `);
  }
  
  try {
    const APP_KEY = process.env.DROPBOX_APP_KEY_1;
    const APP_SECRET = process.env.DROPBOX_APP_SECRET_1;
    const redirectUri = `${req.protocol}://${req.get('host')}/`;
    
    if (!APP_KEY || !APP_SECRET) {
      return res.status(500).json({ error: 'DROPBOX_APP_KEY_1 or DROPBOX_APP_SECRET_1 not configured' });
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
    
    // Update .env file
    await updateEnvFile({
      DROPBOX_ACCESS_TOKEN_1: access_token,
      DROPBOX_REFRESH_TOKEN_1: refresh_token
    });
    
    // Update process.env for current session
    process.env.DROPBOX_ACCESS_TOKEN_1 = access_token;
    process.env.DROPBOX_REFRESH_TOKEN_1 = refresh_token;
    
    res.send(`
      <html>
        <head>
          <meta http-equiv="refresh" content="2;url=/">
        </head>
        <body>
          <h1>✅ Authorization Successful!</h1>
          <p>Redirecting to home page in 2 seconds...</p>
          <p><a href="/">Click here if you're not redirected automatically</a></p>
        </body>
      </html>
    `);
        
  } catch (error) {
    console.error('Error exchanging code for tokens:', error.response?.data || error.message);
    
    let errorMessage = 'Failed to exchange code for tokens';
    if (error.response?.data?.error === 'invalid_grant') {
      errorMessage = 'The authorization code has expired or been used already. Please try again.';
    } else if (error.response?.data?.error === 'redirect_uri_mismatch') {
      errorMessage = 'Redirect URI mismatch. Make sure the redirect URI is registered in your Dropbox app settings.';
    }
    
    res.status(500).send(`
      <html>
        <body>
          <h1>❌ Error</h1>
          <p>${errorMessage}</p>
          <p><strong>Details:</strong> ${error.response?.data?.error_description || error.message}</p>
          <p><a href="/auth/dropbox">← Try again</a></p>
        </body>
      </html>
    `);
  }
});

// Function to update .env file
async function updateEnvFile(newVars) {
  const envPath = path.resolve('.env');
  let envContent = '';
  
  // Read existing .env file if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Parse existing variables
  const envVars = {};
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  });
  
  // Update with new variables
  Object.assign(envVars, newVars);
  
  // Reconstruct .env content
  const newEnvContent = Object.entries(envVars)
    .filter(([key, value]) => key && value)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  // Write back to .env file
  fs.writeFileSync(envPath, newEnvContent);
  console.log('✅ .env file updated with new tokens');
}

// Endpoint to refresh access token
router.post('/auth/refresh', async (req, res) => {
  try {
    const refreshToken = process.env.DROPBOX_REFRESH_TOKEN_1;
    const APP_KEY = process.env.DROPBOX_APP_KEY_1;
    const APP_SECRET = process.env.DROPBOX_APP_SECRET_1;
    
    if (!refreshToken || !APP_KEY || !APP_SECRET) {
      return res.status(400).json({ error: 'Missing required environment variables' });
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
    
    // Update .env file with new access token
    await updateEnvFile({
      DROPBOX_ACCESS_TOKEN_1: access_token
    });
    
    // Update process.env for current session
    process.env.DROPBOX_ACCESS_TOKEN_1 = access_token;
    
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