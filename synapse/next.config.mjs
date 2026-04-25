/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
  // pdf-parse and mammoth pull in Node-only deps; mark them external for the server bundle.
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "pdf-parse", "mammoth"];
    }
    return config;
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
