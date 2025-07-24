import express from 'express';
import dotenv from 'dotenv';
import DropboxProvider from './dropbox-provider.js';

dotenv.config();
const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello, world!');
});

app.get('/photos', async (req, res) => {
  const accessToken = process.env.DROPBOX_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ error: 'Dropbox access token not configured' });
  }
  const provider = new DropboxProvider(accessToken);
  try {
    const files = await provider.listFiles('');
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});