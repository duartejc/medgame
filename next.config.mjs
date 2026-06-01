/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cloudflare Pages: não precisa de adapter, roda Node.js direto
  // Apenas certifique-se de que as APIs rodam no mesmo servidor
};

export default nextConfig;
