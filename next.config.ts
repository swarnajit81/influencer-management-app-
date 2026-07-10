import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Wraps App Router client navigations in document.startViewTransition()
    // so route changes cross-fade instead of snapping. Styled in globals.css.
    viewTransition: true,
  },
};

export default nextConfig;
