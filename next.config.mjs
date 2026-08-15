/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
  webpack: (config) => {
    // pdfjs intenta usar el paquete "canvas" de Node cuando corre del lado
    // del servidor; en el navegador dibuja sobre un <canvas> real, así que
    // aquí sobra y solo rompe el empaquetado.
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
};

export default nextConfig;
