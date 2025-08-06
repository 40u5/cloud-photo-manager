# Cloud Photo Manager Frontend

A modern React frontend for the Cloud Photo Manager application, built with TypeScript and Vite.

## Features

- **Modern React**: Built with React 18 and TypeScript
- **Fast Development**: Uses Vite for lightning-fast development server
- **Type Safety**: Full TypeScript support with strict type checking
- **Responsive Design**: Mobile-friendly UI with modern styling
- **Real-time Updates**: Automatic provider list updates and status messages

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn

### Installation

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173` by default.

### Building for Production

Build the application for production:
```bash
npm run build
```

The built files will be in the `dist` directory.

### Linting

Run the linter to check for code issues:
```bash
npm run lint
```

## Project Structure

```
frontend/
├── src/
│   ├── App.tsx          # Main application component
│   ├── main.tsx         # React entry point
│   ├── types.ts         # TypeScript interfaces
│   └── index.css        # Global styles
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── vite.config.ts       # Vite configuration
└── tsconfig.json        # TypeScript configuration
```

## API Integration

The frontend communicates with the backend API endpoints:

- `GET /provider/providers` - Get list of configured providers
- `POST /provider/add-provider` - Add a new provider
- `DELETE /provider/remove-provider` - Remove a provider
- `GET /oauth/authorize` - OAuth authorization flow

## Features

### Provider Management
- Add Dropbox providers with app credentials
- View current provider status
- Authenticate providers via OAuth
- Remove providers with confirmation

### Status System
- Real-time status messages
- Success, error, and info message types
- Loading states for async operations

### OAuth Integration
- Automatic OAuth callback handling
- Redirect to authorization URLs
- Error handling for failed authorizations

## Development Notes

- The app uses React hooks for state management
- All API calls are handled with proper error handling
- The UI is responsive and works on mobile devices
- TypeScript provides full type safety throughout the application 