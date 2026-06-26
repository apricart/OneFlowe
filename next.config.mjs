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
    CRON_SECRET: process.env.CRON_SECRET,
    // DB connection pool
    PGPOOL_MAX: process.env.PGPOOL_MAX,
    PGPOOL_CONN_TIMEOUT_MS: process.env.PGPOOL_CONN_TIMEOUT_MS,
    // AWS SES email
    SES_FROM_EMAIL: process.env.SES_FROM_EMAIL,
    SES_CONFIGURATION_SET: process.env.SES_CONFIGURATION_SET,
    // AWS credentials — support both clean names and the typo'd names in .env.local
    AWS_REGION: process.env.AWS_REGION || process.env.NNAWS_REGION || process.env.NAWS_REGION,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || process.env.NNAWS_ACCESS_KEY_ID || process.env.NAWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || process.env.NAWS_SECRET_ACCESS_KEY || process.env.NNAWS_SECRET_ACCESS_KEY,
  },
}

export default nextConfig
