import type { NextConfig } from "next";

import fs from 'node:fs';
import path from 'node:path';

// Unique version per build (e.g., "20261126-162900" or Git SHA)
const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
  process.env.GITHUB_SHA?.slice(0, 7) ||
  new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

// Stamp public/sw.js from sw.template.js on every build/start
const templatePath = path.join(process.cwd(), 'sw.template.js');
const outputSwPath = path.join(process.cwd(), 'public', 'sw.js');

if (fs.existsSync(templatePath)) {
  const swSource = fs.readFileSync(templatePath, 'utf8').replaceAll('__BUILD_ID__', buildId);
  fs.writeFileSync(outputSwPath, swSource, 'utf8');
  console.log(`✓ Generated public/sw.js (dits-shell-${buildId})`);
} else {
  console.warn('⚠ sw.template.js not found at:', templatePath);
}

const nextConfig: NextConfig = {
  /* config options here */
  // cacheComponents: true,
  // partialPrefetching: true,
  output: 'export',
  basePath: '/dits',
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
};

export default nextConfig;
