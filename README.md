# Apricart OneFlowe system

*Automatically synced with your [v0.app](https://v0.app) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/tahas-projects-df7a2678/v0-apricart-one-flowe-system)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/projects/LsHE4sxac76)

## Overview

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Deployment

Your project is live at:

**[https://vercel.com/tahas-projects-df7a2678/v0-apricart-one-flowe-system](https://vercel.com/tahas-projects-df7a2678/v0-apricart-one-flowe-system)**

## Build your app

Continue building your app on:

**[https://v0.app/chat/projects/LsHE4sxac76](https://v0.app/chat/projects/LsHE4sxac76)**

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

## Database Setup and Seeding

### Environment Configuration

1. Create a `.env.local` file in the project root (copy from `.env.example` if available)
2. Set your database connection URL:
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/database_name
   ```
3. Set your JWT secrets:
   ```
   JWT_SECRET=your-super-secret-jwt-key
   REFRESH_TOKEN_SECRET=your-super-secret-refresh-key
   ```
4. Set super admin credentials:
   ```
   SUPER_ADMIN_EMAIL=admin@example.com
   SUPER_ADMIN_PASSWORD=your-secure-password
   ```

### Running Migrations

After setting up your database, run the migrations:

```bash
npm run db:migrate
```

### Seeding Super Admin User

To seed a super admin user, run:

```bash
npm run db:seed
```

The seed script will create a SUPER_ADMIN role and user if they don't already exist, using the credentials from your `.env.local` file.

Make sure your PostgreSQL server is running and the database exists before running the seed script.