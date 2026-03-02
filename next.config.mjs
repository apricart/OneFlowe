/** @type {import('next').NextConfig} */
const nextConfig = {
  // Security: Remove X-Powered-By header
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ignoreBuildErrors: false,
  },
  images: {
    // Enabled for better performance (WebP, resizing)
    unoptimized: false,
  },
  // Performance optimizations
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  // Enable compression
  compress: true,
  // Optimize bundle — split into smaller chunks to prevent ChunkLoadError timeouts
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        maxInitialRequests: 25,
        minSize: 20000,
        cacheGroups: {
          reactVendor: {
            test: /[\\/]node_modules[\\/](react|react-dom|next|scheduler)[\\/]/,
            name: 'react-vendor',
            priority: 40,
            chunks: 'all',
          },
          uiVendor: {
            test: /[\\/]node_modules[\\/](@radix-ui|framer-motion|lucide-react|class-variance-authority|clsx|tailwind-merge|cmdk|vaul|sonner)[\\/]/,
            name: 'ui-vendor',
            priority: 30,
            chunks: 'all',
          },
          dataVendor: {
            test: /[\\/]node_modules[\\/](swr|recharts|date-fns|xlsx|jspdf|drizzle-orm|d3-.*)[\\/]/,
            name: 'data-vendor',
            priority: 20,
            chunks: 'all',
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
            chunks: 'all',
          },
        },
      }
    }
    return config
  },
  // Environment variables for AWS Amplify serverless functions
  env: {
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL,
    SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
  },
}

export default nextConfig