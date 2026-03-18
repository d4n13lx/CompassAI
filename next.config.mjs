/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",

  // GitHub Pages project site (https://<user>.github.io/<repo>/)
  basePath: "/CompassAI",
  assetPrefix: "/CompassAI/",
  trailingSlash: true
};

export default nextConfig;

