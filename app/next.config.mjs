/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  transpilePackages: ["@twokeys/sdk"],
  eslint: { ignoreDuringBuilds: true },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Solana/Anchor libraries reference Node built-ins that are not needed in the browser.
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, os: false, crypto: false };
    }
    // Optional native deps pulled in transitively by wallet libraries.
    config.externals = [...(config.externals || []), "pino-pretty", "encoding"];
    return config;
  },
  async redirects() {
    return [{ source: "/seller/new", destination: "/offer/new", permanent: false }];
  },
  async headers() {
    return [
      {
        // The widget is meant to be embedded by third-party marketplaces.
        source: "/widget.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=300" },
        ],
      },
    ];
  },
};

export default nextConfig;
