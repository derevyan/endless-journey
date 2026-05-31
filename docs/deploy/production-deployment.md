# Production Deployment Guide

This guide explains how to run the Journey Builder application in production mode using Turborepo.

## Quick Start

```bash
# 1. Build all packages
pnpm build

# 2. Start infrastructure services
cd service/docker && docker-compose up -d && cd ../..

# 3. Initialize database
pnpm db:push
pnpm db:seed

# 4. Run in production mode
pnpm preview
```

## What `pnpm preview` Does

The `pnpm preview` command uses Turborepo to run both applications in production mode simultaneously:

- **Web App** (`@journey/web`): Runs `vite preview` on port **3000**
  - Serves the optimized production build from `apps/web/dist/`
  - Uses Vite's preview server for testing the production build

- **API Server** (`@journey/api`): Runs `tsx src/index.ts` on port **3001**
  - Executes TypeScript directly using tsx (TypeScript execution engine)
  - Production-ready with proper ESM support

## Turborepo Configuration

The `preview` task is configured in [`turbo.json`](../../turbo.json):

```json
{
  "preview": {
    "dependsOn": ["build"],
    "cache": false,
    "persistent": true
  }
}
```

- `dependsOn: ["build"]` - Automatically runs build first if needed
- `cache: false` - Don't cache preview results (it's a long-running process)
- `persistent: true` - Keep the processes running

## Infrastructure Services

The Docker Compose setup provides:

- **PostgreSQL** (port 5432) - Database
- **Redis** (port 6379) - Queue management for BullMQ
- **MinIO** (port 9000) - S3-compatible storage for media uploads

Start services:
```bash
cd service/docker
docker-compose up -d
```

Stop services:
```bash
cd service/docker
docker-compose down
```

## Environment Variables

### API (.env in apps/api/)
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `AWS_*` - S3/MinIO credentials for uploads
- `BETTER_AUTH_SECRET` - Authentication secret

### Web (.env in apps/web/)
- `VITE_API_URL` - API server URL (default: http://localhost:3001)

## Production Deployment

For actual production deployment (not just local preview):

### 1. Static File Hosting (Web App)

The web app build outputs to `apps/web/dist/`. Deploy this to:
- **Nginx** or **Apache** for self-hosted
- **Vercel**, **Netlify**, or **Cloudflare Pages** for managed hosting
- **S3 + CloudFront** for AWS hosting

Example Nginx configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/apps/web/dist;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 2. API Server

The API server can be deployed using:
- **PM2** for process management
- **systemd** service for Linux systems
- **Docker** with a custom Dockerfile
- **Cloud platforms** (AWS ECS, Google Cloud Run, Railway, Render)

Example PM2 ecosystem file:
```javascript
module.exports = {
  apps: [{
    name: 'journey-api',
    script: './apps/api/dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
}
```

### 3. Database & Services

For production, use managed services:
- **PostgreSQL**: AWS RDS, Google Cloud SQL, Supabase, Neon
- **Redis**: AWS ElastiCache, Upstash, Redis Cloud
- **Object Storage**: AWS S3, Google Cloud Storage, Cloudflare R2

## Turborepo Benefits

- **Parallel execution**: Web and API preview run simultaneously
- **Smart caching**: Only rebuilds changed packages
- **Dependency-aware**: Builds packages in correct order
- **Monorepo orchestration**: Single command runs all apps

## Troubleshooting

### Port Already in Use

If ports 3000 or 3001 are in use:
```bash
# Find and kill processes
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### Database Connection Errors

Ensure PostgreSQL is running:
```bash
docker ps | grep journey-postgres
```

Check connection string in `apps/api/.env`:
```bash
DATABASE_URL=postgresql://journey:journey_dev@localhost:5432/journey
```

### Build Errors

Clear Turborepo cache and rebuild:
```bash
rm -rf node_modules/.cache/turbo
pnpm build
```

## Scripts Reference

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all packages in dependency order |
| `pnpm preview` | Run both web + API in production mode |
| `pnpm dev` | Run both web + API in development mode |
| `pnpm typecheck` | Type check all packages |
| `pnpm test` | Run all tests |

## Architecture

See [Architecture Documentation](../../README.md#architecture) for details on:
- Monorepo structure
- Package dependencies
- Store architecture
- Node plugin system
