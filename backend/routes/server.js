import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import oauthRouter from './oauth-routes.js';
import cloudProviderManager from '../cloud-provider-manager.js';

dotenv.config();
const app = express();
const PORT = 3000;

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Add middleware to parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../../frontend')));

app.use('/auth', oauthRouter);

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