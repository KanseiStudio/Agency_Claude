import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // I pacchetti del monorepo (@kansei/*) sono esposti come sorgente TypeScript.
  // transpilePackages istruisce Next.js a transpilarli con il proprio bundler.
  transpilePackages: ['@kansei/shared', '@kansei/database', '@kansei/auth', '@kansei/storage'],
};

export default nextConfig;
