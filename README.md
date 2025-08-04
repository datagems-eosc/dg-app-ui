# DataGEMS Frontend

A Next.js application for dataset discovery and management ecosystem.

## Features

- Modern React 19 with Next.js 15
- TypeScript support
- Tailwind CSS for styling
- Base path support for subdirectory deployment
- Docker containerization

## Base Path Support

The application supports serving from a subdirectory (e.g., `http://domain.com/myapp/`) through the `NEXT_PUBLIC_BASE_PATH` environment variable.

### Environment Variables

- `NEXT_PUBLIC_BASE_PATH`: The base path for the application (e.g., `/myapp`, `/data-gems`, etc.)
- `NODE_ENV`: Environment mode (`development`, `production`)
- `NEXT_TELEMETRY_DISABLED`: Disable Next.js telemetry (set to `1`)
- `NEXT_PUBLIC_APP_BASE_URL`: Set this to the base URL of your frontend app (e.g., http://localhost:4000). This is used for authentication return/redirect URLs in NextAuth.js.

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Docker Deployment

### Quick Start

Use the provided build script:

```bash
# Build and run with default base path (/myapp)
./build.sh

# Or set a custom base path
NEXT_PUBLIC_BASE_PATH=/data-gems ./build.sh
```

### Manual Docker Commands

```bash
# Build the image
docker build -t data-gems-frontend .

# Run with base path
docker run -d \
  --name data-gems-frontend \
  -p 3000:3000 \
  -e NEXT_PUBLIC_BASE_PATH=/myapp \
  -e NODE_ENV=production \
  -e NEXT_TELEMETRY_DISABLED=1 \
  --restart unless-stopped \
  data-gems-frontend
```

### Docker Compose

```bash
# Start with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f frontend
```

## URL Structure

With `NEXT_PUBLIC_BASE_PATH=/myapp`:

- Home: `http://localhost:3000/myapp/`
- Browse: `http://localhost:3000/myapp/browse`
- Chat: `http://localhost:3000/myapp/chat`
- Collections: `http://localhost:3000/myapp/collections/favorites`
- Settings: `http://localhost:3000/myapp/settings`

## Google Maps Integration

The application now uses Google Maps for location display. To set up Google Maps:

1. **Get a Google Maps API Key:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the **Maps JavaScript API**
   - Create credentials (API Key)
   - Set up billing (required, but Google offers $200/month free credit)

2. **Configure the API Key:**
   - Create a `.env.local` file in the project root
   - Add your API key: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here`
   - Restart your development server

3. **API Key Security:**
   - Restrict the API key to your domain(s) in Google Cloud Console
   - Set HTTP referrer restrictions to prevent unauthorized use

### Environment Variables

Add to your `.env.local` file:
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

## Reverse Proxy Configuration

If using a reverse proxy (nginx, Apache, etc.), ensure it's configured to handle the base path:

### Nginx Example

```nginx
location /myapp/ {
    proxy_pass http://localhost:3000/myapp/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Troubleshooting

1. **Static assets not loading**: Ensure `NEXT_PUBLIC_BASE_PATH` is set correctly
2. **404 errors**: Check that the base path is consistent across all configuration
3. **Build failures**: Ensure all dependencies are installed with `npm ci`

## Architecture

- **App Router**: Uses Next.js 15 App Router for modern routing
- **Server Components**: Leverages React Server Components for better performance
- **Context API**: Uses React Context for state management
- **TypeScript**: Full TypeScript support for type safety

## Keycloak Authentication (NextAuth.js with PKCE)

This project uses [NextAuth.js](https://next-auth.js.org/) with the Keycloak provider and PKCE for secure login.

### Required Environment Variables

Add these to your `frontend/.env.local`:

```
NEXT_PUBLIC_DATAGEMS_API_BASE_URL=https://datagems-dev.scayle.es
KEYCLOAK_CLIENT_ID=dg-app-ui
KEYCLOAK_CLIENT_SECRET="" # Not used for PKCE public client, but required by next-auth types
KEYCLOAK_ISSUER=https://datagems-dev.scayle.es/oauth/realms/dev
```

### Usage

- The login flow uses PKCE (Proof Key for Code Exchange) for enhanced security.
- No client secret is required for public clients, but an empty string is needed for type compatibility.
- The login/logout/session logic is handled by NextAuth.js via `/api/auth/[...nextauth]`.
- Use the `useSession`, `signIn`, and `signOut` hooks from `next-auth/react` in your components for authentication state and actions.

For more details, see the [NextAuth.js Keycloak provider docs](https://next-auth.js.org/providers/keycloak).
