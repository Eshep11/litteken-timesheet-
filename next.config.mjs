/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB, which a phone photo (even compressed) can exceed.
      // Photos are compressed client-side to ~1600px JPEG before upload,
      // so 4MB gives comfortable headroom without allowing huge payloads.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
