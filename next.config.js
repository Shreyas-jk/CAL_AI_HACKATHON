/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-parse is a server-only dep
  experimental: { serverComponentsExternalPackages: ["pdf-parse"] },
};
module.exports = nextConfig;
