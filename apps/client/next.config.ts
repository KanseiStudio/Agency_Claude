import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // I pacchetti del monorepo (@kansei/*) sono esposti come sorgente TypeScript.
  // transpilePackages istruisce Next.js a transpilarli con il proprio bundler,
  // gestendo le estensioni TS/JS, ESM/CJS interop e tree-shaking.
  transpilePackages: ['@kansei/shared', '@kansei/database'],
};

export default nextConfig;
