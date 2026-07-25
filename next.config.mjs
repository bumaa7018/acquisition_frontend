import path from "node:path";
import CopyPlugin from "copy-webpack-plugin";

// Docker сүлжээнд: NEXT_API_URL=http://api:8080, NEXT_GS_URL=http://geoserver:8080
// Локал хөгжүүлэлтэд:  NEXT_API_URL=http://localhost:8080, NEXT_GS_URL=http://localhost:8600
const API_URL = process.env.NEXT_API_URL ?? "http://localhost:8080";
const GS_URL = process.env.NEXT_GS_URL ?? "http://localhost:8600";

const CESIUM_SRC = path.resolve(process.cwd(), "node_modules/cesium/Build/Cesium");

/** @type {import('next').NextConfig} */
const nextConfig = {
  httpAgentOptions: { keepAlive: false },
  experimental: {
    serverComponentsExternalPackages: ['exceljs'],
  },
  // standalone зөвхөн production-д хэрэгтэй, dev-д disc идэх тул хасав
  ...(process.env.NODE_ENV === "production" && { output: "standalone" }),
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: `${API_URL}/api/v1/:path*` },
    ];
  },
  // 3D турш: CesiumJS-ийн static asset-уудыг (Workers/Assets/Widgets/ThirdParty)
  // public/cesium руу хуулж, CESIUM_BASE_URL-аар клиент талд ачаалуулна
  webpack(config, { isServer }) {
    if (!isServer) {
      config.plugins.push(
        new CopyPlugin({
          patterns: [
            { from: path.join(CESIUM_SRC, "Workers"), to: path.resolve(process.cwd(), "public/cesium/Workers") },
            { from: path.join(CESIUM_SRC, "ThirdParty"), to: path.resolve(process.cwd(), "public/cesium/ThirdParty") },
            { from: path.join(CESIUM_SRC, "Assets"), to: path.resolve(process.cwd(), "public/cesium/Assets") },
            { from: path.join(CESIUM_SRC, "Widgets"), to: path.resolve(process.cwd(), "public/cesium/Widgets") },
          ],
        }),
      );
    }
    return config;
  },
};
export default nextConfig;
