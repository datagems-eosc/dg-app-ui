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
pnpm install

# Start development server
pnpm run dev

# Build for production
pnpm run build

# Start production server
pnpm start
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
3. **Build failures**: Ensure all dependencies are installed with `pnpm install --frozen-lockfile`

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

### Token Refresh Configuration

The application is configured to automatically refresh access tokens before they expire:

- **Session Duration**: 30 days (configured in NextAuth session maxAge)
- **Token Refresh**: Automatic refresh 30 seconds before expiration
- **Refresh Scope**: Includes `offline_access` scope to ensure refresh tokens are provided
- **Error Handling**: Automatic re-authentication on refresh failures
- **Client-side Refresh**: Session refetch every 5 minutes and on window focus

### Usage

- The login flow uses PKCE (Proof Key for Code Exchange) for enhanced security.
- No client secret is required for public clients, but an empty string is needed for type compatibility.
- The login/logout/session logic is handled by NextAuth.js via `/api/auth/[...nextauth]`.
- Use the `useSession`, `signIn`, and `signOut` hooks from `next-auth/react` in your components for authentication state and actions.

For more details, see the [NextAuth.js Keycloak provider docs](https://next-auth.js.org/providers/keycloak).

## Prerequisites

- **Node.js**: Version 20.x or higher (see `.nvmrc` for the exact version)
- **Package Manager**: This project uses `pnpm` (v10). Corepack is enabled, so `pnpm` will be automatically used.

## Package Manager

This project uses `pnpm` as the package manager. The project is configured to use Corepack, which automatically manages the correct `pnpm` version.

```bash
# Enable Corepack (if not already enabled)
corepack enable

# Install dependencies
pnpm install

# Install with frozen lockfile (for CI/production)
pnpm install --frozen-lockfile
```

## Code Quality & Git Hooks

This repository includes enterprise-grade code quality tooling with automated pre-commit checks:

### Pre-commit Hooks

Git hooks are managed by Husky and automatically run before each commit:

1. **Lint-staged**: Runs Biome linter and formatter on staged files
2. **Biome Check**: Validates code quality and formatting across the entire codebase
3. **TypeScript Type Check**: Ensures all TypeScript types are correct
4. **Tests**: Runs the test suite

All checks must pass before a commit is allowed. If any check fails, the commit is blocked with detailed error messages.

### Commit Message Format

Commit messages must follow this format:

```
DG-XX | Your commit message
```

**Rules:**
- Must start with task number: `DG-XX` where `XX` is a number
- Followed by a pipe symbol: `|`
- Then your commit message (minimum 3 characters)

**Valid examples:**
- `DG-59 | Add user authentication`
- `DG-123 | Fix dataset loading issue`
- `DG-1 | Update documentation`

The commit-msg hook will automatically validate your commit message format.

### Available Scripts

```bash
# Development
pnpm run dev              # Start development server with Turbopack
pnpm run build           # Build for production
pnpm start               # Start production server

# Code Quality
pnpm run lint            # Run Next.js ESLint
pnpm run lint:biome      # Run Biome linter and auto-fix issues
pnpm run lint:biome:check # Run Biome linter (check only, no fixes)
pnpm run format          # Format code with Prettier
pnpm run format:check    # Check code formatting
pnpm run type-check      # Run TypeScript type checking
pnpm test                # Run test suite
pnpm run test:coverage   # Run tests with coverage
```

## CI/CD

The repository includes GitHub Actions workflows for continuous integration:

### CI Workflow

Automatically runs on push and pull requests to `main`, `develop`, and `staging` branches:

- **Lint with Biome**: Validates code quality and formatting
- **Type Check**: Ensures TypeScript types are correct
- **Tests**: Runs the test suite with coverage
- **Security Audit**: Checks for known vulnerabilities in dependencies

All checks must pass before code can be merged.

## Docker Configuration

### Port Configuration

The Docker Compose setup supports custom port configuration via the `FRONTEND_PORT` environment variable:

```bash
# Use default port 3000
docker-compose up -d

# Use custom port (e.g., 4000)
FRONTEND_PORT=4000 docker-compose up -d
```

The port mapping and healthcheck URL will automatically adjust based on the `FRONTEND_PORT` variable.

### Docker Build Requirements

- **Base Image**: Node.js 20 Alpine
- **Package Manager**: pnpm (automatically enabled via Corepack)
- **Lock File**: Uses `pnpm-lock.yaml` (not `package-lock.json`)

## Getting Started

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dg-app-ui
   ```

2. **Install dependencies**
   ```bash
   corepack enable
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local  # If .env.example exists
   # Or create .env.local with required variables (see Keycloak Authentication section)
   ```

4. **Start development server**
   ```bash
   pnpm run dev
   ```

5. **Verify pre-commit hooks**
   ```bash
   # Hooks are automatically installed via `pnpm install` (runs `husky install`)
   # Test by making a commit with invalid message format
   git commit -m "test"  # Should fail
   git commit -m "DG-1 | test"  # Should pass (if other checks pass)
   ```

## Project Structure

- `src/app/` - Next.js App Router pages and API routes
- `src/components/` - React components
- `src/contexts/` - React Context providers
- `src/hooks/` - Custom React hooks
- `src/lib/` - Utility functions and services
- `src/types/` - TypeScript type definitions
- `.github/workflows/` - GitHub Actions workflows
- `.husky/` - Git hooks configuration
- `cypress/` - End-to-end tests
- `tests/` - Unit and integration tests
