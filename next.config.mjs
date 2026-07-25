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
      // Санамж: copy-webpack-plugin-ээр хуулсан файлууд ч webpack-ийн
      // compilation.assets-д бүртгэгдэж, Next-ийн production Terser
      // minimizer-т "энгийн .js" гэж таарч ордог. Cesium-ий Workers/*.js нь
      // Cesium-ийн ӨӨРИЙН build-аас гарсан, аль хэдийн бэлтгэгдсэн ESM chunk
      // (import/export агуулсан) тул Terser-ээр дахин parse хийлгэвэл
      // "cannot be used outside of module code" syntax error өгдөг (зөвхөн
      // `next build`/Docker-д илэрдэг — dev нь minify хийдэггүй тул мэдрэгддэггүй).
      // info.minimized:true гэж тэмдэглэснээр Terser эдгээр asset-ыг алгасна.
      config.plugins.push(
        new CopyPlugin({
          patterns: [
            { from: path.join(CESIUM_SRC, "Workers"), to: path.resolve(process.cwd(), "public/cesium/Workers"), info: { minimized: true } },
            { from: path.join(CESIUM_SRC, "ThirdParty"), to: path.resolve(process.cwd(), "public/cesium/ThirdParty"), info: { minimized: true } },
            { from: path.join(CESIUM_SRC, "Assets"), to: path.resolve(process.cwd(), "public/cesium/Assets"), info: { minimized: true } },
            { from: path.join(CESIUM_SRC, "Widgets"), to: path.resolve(process.cwd(), "public/cesium/Widgets"), info: { minimized: true } },
          ],
        }),
      );
    }
    return config;
  },
};
export default nextConfig;
