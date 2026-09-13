import type { NextConfig } from "next";

const config: NextConfig = {
  /*
   * The contest is served over the hall's LAN, so every machine reaches this
   * by IP rather than by localhost. `next dev` blocks cross-origin requests for
   * its own dev assets, and a LAN IP is a different hostname — the page then
   * renders but never hydrates, which looks like a field being "missing"
   * rather than like an error.
   *
   * Each `*` stands for one label of the hostname, so these cover the private
   * ranges. Development only: `next start` has no such restriction.
   */
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],

  /*
   * A second instance can be run against a scratch database without disturbing
   * the one that is serving the contest — `NEXT_DIST_DIR=.next-scratch next dev
   * -p 3100` — because two servers sharing one build directory fight over it.
   * Unset everywhere except that case, so the normal build is untouched.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // The contest hall has no internet. Nothing may be fetched at runtime from
  // anywhere but this server, so no remote images, fonts or scripts.
  images: { unoptimized: true },
  // Monaco ships its own workers; leave them out of Next's bundling.
  serverExternalPackages: ["postgres"],
};

export default config;
