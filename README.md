# Cloud Photo Manager

A web application for managing photos across multiple cloud storage providers.

## Project Structure

### Backend
- `backend/` - Server-side code
  - `routes/` - Express routes and server setup
    - `server.js` - Main server file
    - `oauth-routes.js` - OAuth authentication routes
  - `cloud-provider-manager.js` - Manages multiple cloud provider instances
  - `cloud-provider.js` - Abstract base class for cloud providers
  - `dropbox-provider.js` - Dropbox-specific implementation
  - `env-file-manager.js` - Environment variable management
  - `package.json` - Node.js dependencies

### Frontend
- `frontend/` - Client-side code
  - `index.html` - Main application page
  - `oauth-callback.html` - OAuth callback page
  - `styles/` - CSS files
    - `main.css` - Main stylesheet
  - `js/` - JavaScript files
    - `main.js` - Main application logic
    - `oauth-callback.js` - OAuth callback handling

## Features

- OAuth authentication with Dropbox
- Multiple cloud provider support
- Photo gallery with thumbnails
- Modern, responsive UI
- Environment variable management

## Setup

1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Configure environment variables in `.env` file:
   ```
   DROPBOX_APP_KEY_0=your_dropbox_app_key
   DROPBOX_APP_SECRET_0=your_dropbox_app_secret
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open http://localhost:3000 in your browser

## Architecture

The application follows a clean separation between frontend and backend:

- **Backend**: Handles API requests, OAuth flow, and cloud provider interactions
- **Frontend**: Provides the user interface and handles client-side interactions
- **Static Files**: CSS and JavaScript are served from the frontend directory
- **OAuth Flow**: Uses dedicated callback pages for better user experience

## File Organization

### CSS Separation
- All styles are now in `frontend/styles/main.css`
- Modern, responsive design with CSS Grid and Flexbox
- Consistent styling across all pages

### JavaScript Separation
- Main application logic in `frontend/js/main.js`
- OAuth callback handling in `frontend/js/oauth-callback.js`
- Clean separation of concerns

### Import Fixes
- All backend imports now use correct relative paths
- Frontend files are served as static assets
- Proper ES6 module imports throughout 
