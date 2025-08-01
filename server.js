import express from 'express';
import dotenv from 'dotenv';
import oauthRouter from './routes/oauth-routes.js';
import cloudProviderManager from './cloud-provider-manager.js';

dotenv.config();
const app = express();
const PORT = 3000;

// Add middleware to parse form data
app.use(express.urlencoded({ extended: true }));

app.use(express.json());

app.use('/auth', oauthRouter);

// Home page
app.get('/', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Dropbox OAuth Setup</h1>
        <p><a href="/auth/dropbox">AUTHORIZE</a></p>
        <p><a href="/photos">View Photos</a></p>
      </body>
    </html>
  `);
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