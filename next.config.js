const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['mongodb'],
  webpack(config, { dev }) {
    if (dev) {
      // Reduce CPU/memory from file watching
      config.watchOptions = {
        poll: 2000, // check every 2 seconds
        aggregateTimeout: 300, // wait before rebuilding
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  async headers() {
    // L'outil peut être intégré en iframe uniquement par le site AlterEgo
    // (surchargeable via FRAME_ANCESTORS="https://a.fr https://b.fr").
    const frameAncestors =
      process.env.FRAME_ANCESTORS ||
      "'self' https://alteregopatrimoine.com https://*.alteregopatrimoine.com";
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: `frame-ancestors ${frameAncestors};` },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none';" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
