import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // I pacchetti del monorepo (@kansei/*) sono esposti come sorgente TypeScript.
  // transpilePackages istruisce Next.js a transpilarli con il proprio bundler.
  transpilePackages: ['@kansei/shared', '@kansei/database', '@kansei/auth', '@kansei/storage'],

  // Server Actions: alziamo il limite di body a 25 MB. Servirà quando
  // l'admin caricherà deliverable o file di lavoro nei prossimi setup.
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
