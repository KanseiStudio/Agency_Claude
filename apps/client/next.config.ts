import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // I pacchetti del monorepo (@kansei/*) sono esposti come sorgente TypeScript.
  // transpilePackages istruisce Next.js a transpilarli con il proprio bundler.
  transpilePackages: ['@kansei/shared', '@kansei/database', '@kansei/auth', '@kansei/storage'],

  // Server Actions: alziamo il limite di body a 25 MB per consentire upload
  // di file di reference dal form brief. Il check di sicurezza vero e proprio
  // (whitelist MIME, validazione size) è in apps/client/src/app/projects/new/actions.ts.
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
