/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // Helius Privacy Rings SDK (ESM + WASM) runs in the Node runtime; do not bundle it.
  serverExternalPackages: ["@heliuslabs/spr", "@lightprotocol/hasher.rs", "@phala/dcap-qvl"],
};
export default nextConfig;
