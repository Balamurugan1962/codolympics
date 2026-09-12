import type { NextConfig } from "next";

const config: NextConfig = {
  // The contest hall has no internet. Nothing may be fetched at runtime from
  // anywhere but this server, so no remote images, fonts or scripts.
  images: { unoptimized: true },
  // Monaco ships its own workers; leave them out of Next's bundling.
  serverExternalPackages: ["postgres"],
};

export default config;
