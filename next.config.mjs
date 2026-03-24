/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Evita bug do DevTools em dev (SegmentViewNode / React Client Manifest) no Next 15.5+
  experimental: {
    devtoolSegmentExplorer: false
  },
  async redirects() {
    return [{ source: "/moderador", destination: "/admin", permanent: true }];
  }
};

export default nextConfig;
