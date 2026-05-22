import type { NextConfig } from "next";
import path from "path";

// Pin Turbopack root to this app directory. Without this, Next.js walks up and
// picks C:\Users\junio\package-lock.json (a sibling "pnl" project in $HOME),
// which breaks CSS resolution for `@import "tailwindcss"`.
const projectRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
