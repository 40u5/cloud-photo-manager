import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import DropboxProvider from './dropbox-provider.js';

dotenv.config();
const app = express();
const PORT = 3000;

// Add middleware to parse form data
app.use(express.urlencoded({ extended: true }));

app.use(express.json());

app.get('/', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Dropbox OAuth Setup</h1>
        <p><a href="/auth/dropbox">Click here to authorize with Dropbox</a></p>
        <p><a href="/photos">View Photos</a></p>
      </body>
    </html>
  `);
});

// Step 1: Show authorization instructions (no redirect needed)
app.get('/auth/dropbox', (req, res) => {
  const APP_KEY = process.env.APP_KEY;
  
  if (!APP_KEY) {
    return res.status(500).json({ error: 'APP_KEY not configured in environment variables' });
  }
  
  const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${APP_KEY}&response_type=code&token_access_type=offline`;
  
  res.send(`
    <html>
      <body>
        <h1>Dropbox Authorization</h1>
        <h2>Step 1: Authorize</h2>
        <p>1. <a href="${authUrl}" target="_blank">Click here to authorize with Dropbox</a></p>
        <p>2. Click "Allow" to authorize your app</p>
        <p>3. Copy the authorization code from the page</p>
        <p>4. Paste it below and click "Get Tokens"</p>
        
        <h2>Step 2: Enter Code</h2>
        <form action="/auth/dropbox/exchange" method="post">
          <input type="text" name="code" placeholder="Paste authorization code here" style="width: 400px; padding: 8px;" required>
          <button type="submit" style="padding: 8px 16px;">Get Tokens</button>
        </form>
        
        <p><a href="/">← Back to Home</a></p>
      </body>
    </html>
  `);
});

// Step 2: Handle code exchange (no redirect_uri needed)
app.post('/auth/dropbox/exchange', async (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).send(`
      <html>
        <body>
          <h1>❌ Error</h1>
          <p>No authorization code provided</p>
          <p><a href="/auth/dropbox">← Try again</a></p>
        </body>
      </html>
    `);
  }
  
  try {
    const APP_KEY = process.env.APP_KEY;
    const APP_SECRET = process.env.APP_SECRET;
    
    if (!APP_KEY || !APP_SECRET) {
      return res.status(500).json({ error: 'APP_KEY or APP_SECRET not configured' });
    }
    
    // Exchange code for tokens (no redirect_uri needed)
    const response = await axios.post('https://api.dropboxapi.com/oauth2/token', 
      new URLSearchParams({
        code: code,
        grant_type: 'authorization_code',
        client_id: APP_KEY,
        client_secret: APP_SECRET
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
      DROPBOX_ACCESS_TOKEN: access_token,
      DROPBOX_REFRESH_TOKEN: refresh_token
    });
    
    // Update process.env for current session
    process.env.DROPBOX_ACCESS_TOKEN = access_token;
    process.env.DROPBOX_REFRESH_TOKEN = refresh_token;
    
    res.send(`
      <html>
        <body>
          <h1>✅ Authorization Successful!</h1>
          <p>Tokens have been saved to your .env file:</p>
          <ul>
            <li><strong>Access Token:</strong> ${access_token.substring(0, 20)}...</li>
            <li><strong>Refresh Token:</strong> ${refresh_token.substring(0, 20)}...</li>
            <li><strong>Expires in:</strong> ${expires_in} seconds</li>
          </ul>
          <p><a href="/">← Back to Home</a></p>
          <p><a href="/photos">View Photos</a></p>
        </body>
      </html>
    `);
    
  } catch (error) {
    console.error('Error exchanging code for tokens:', error.response?.data || error.message);
    
    let errorMessage = 'Failed to exchange code for tokens';
    if (error.response?.data?.error === 'invalid_grant') {
      errorMessage = 'The authorization code has expired or been used already. Please try again with a new code.';
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
app.post('/auth/refresh', async (req, res) => {
  try {
    const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
    const APP_KEY = process.env.APP_KEY;
    const APP_SECRET = process.env.APP_SECRET;
    
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
      DROPBOX_ACCESS_TOKEN: access_token
    });
    
    // Update process.env for current session
    process.env.DROPBOX_ACCESS_TOKEN = access_token;
    
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

app.get('/photos', async (req, res) => {
  let accessToken = process.env.DROPBOX_ACCESS_TOKEN;
  
  // If no access token, try to refresh it
  if (!accessToken && process.env.DROPBOX_REFRESH_TOKEN) {
    try {
      await axios.post(`http://localhost:${PORT}/auth/refresh`);
      accessToken = process.env.DROPBOX_ACCESS_TOKEN;
    } catch (error) {
      console.error('Failed to refresh token:', error.message);
    }
  }
  
  if (!accessToken) {
    return res.status(401).json({ 
      error: 'Dropbox access token not available. Please authorize first.',
      authUrl: `/auth/dropbox`
    });
  }
  
  const provider = new DropboxProvider(accessToken);
  try {
    const files = await provider.listFiles('');
    res.json(files);
  } catch (err) {
    // If token is expired, try to refresh and retry
    if (err.message.includes('invalid_access_token') && process.env.DROPBOX_REFRESH_TOKEN) {
      try {
        await axios.post(`http://localhost:${PORT}/auth/refresh`);
        const newProvider = new DropboxProvider(process.env.DROPBOX_ACCESS_TOKEN);
        const files = await newProvider.listFiles('');
        res.json(files);
      } catch (refreshError) {
        res.status(500).json({ error: refreshError.message });
      }
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});