// Node-ийн ESM resolve hook — тестээс src/-ийн TypeScript модулиудыг шууд import
// хийхэд Next-ийн дүрмээр (өргөтгөлгүй зам, "@/..." alias) бичигдсэн import-ууд
// ажиллах боломж болгоно. Node өөрөө өргөтгөлгүй .ts-г олдоггүй тул өргөтгөлүүдийг
// туршиж, "@/" -ийг <root>/src/ болгоно.

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.cwd();
const EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".mjs", "/index.ts", "/index.tsx"];

function firstExisting(basePath) {
  if (path.extname(basePath) && existsSync(basePath)) return basePath;
  for (const ext of EXTENSIONS) {
    const candidate = `${basePath}${ext}`;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const resolved = firstExisting(path.join(ROOT, "src", specifier.slice(2)));
    if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true, format: undefined };
  }

  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const parentPath = context.parentURL?.startsWith("file:") ? fileURLToPath(context.parentURL) : null;
    if (parentPath && !path.extname(specifier)) {
      const resolved = firstExisting(path.resolve(path.dirname(parentPath), specifier));
      if (resolved) return { url: pathToFileURL(resolved).href, shortCircuit: true, format: undefined };
    }
  }

  return next(specifier, context);
}
