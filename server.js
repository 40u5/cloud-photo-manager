import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import DropboxProvider from './dropbox-provider.js';
import oauthRouter from './oauth-routes.js';

dotenv.config();
const app = express();
const PORT = 3000;

// Add middleware to parse form data
app.use(express.urlencoded({ extended: true }));

app.use(express.json());

app.use('/', oauthRouter);

// Home page
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