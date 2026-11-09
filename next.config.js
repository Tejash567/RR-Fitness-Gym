/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",

  basePath: "/RR-Fitness-Gym",
  assetPrefix: "/RR-Fitness-Gym/",

  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
