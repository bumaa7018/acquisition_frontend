import { NextRequest } from "next/server";
import { isAuthenticated, unauthorizedResponse } from "@/lib/server/verify-auth";
import { detectBasemapType, parseWmsLayerFromUrl } from "@/components/map/basemap-config";

export const runtime = "nodejs";

/**
 * Суурь зургийн хаягийг ТАНИХ (эх сурвалжийн төрөл + WMS-ийн давхарга).
 *
 * ЯАГААД СЕРВЕР ТАЛ: WMS-ийн GetCapabilities-ийг browser-оос уншиж болдоггүй
 * (дотоод GeoServer нь CORS толгой буцаадаггүй — шалгасан). Сервер тал нь CORS
 * -оос хамаарахгүй тул давхаргын нэрийг өөрөө олж, хэрэглэгчээс асуухаа болино.
 *
 * ХАРИУ нь ЗӨВХӨН танисан төрөл ба давхаргын НЭРС — хүсэлтийн биеийг хэзээ ч
 * дамжуулахгүй (дурын хаяг уншуулах гарц болгохгүйн тулд). Нэвтэрсэн
 * хэрэглэгчид л ажиллана; тохиргоог өөрчлөх нь backend дээр admin:update
 * шаарддаг.
 */

const CAPS_TIMEOUT_MS = 8000;
const MAX_CAPS_BYTES = 4 << 20;
const MAX_LAYERS = 30;

/** GetCapabilities XML-ээс давхаргын нэрсийг гаргаж авна. */
function parseCapabilityLayerNames(xml: string): string[] {
  // <Service><Name>WMS</Name> нь давхарга БИШ тул зөвхөн <Capability> хэсгийг
  // авч үзнэ.
  const capIndex = xml.indexOf("<Capability>");
  const body = capIndex === -1 ? xml : xml.slice(capIndex);
  const names: string[] = [];
  const re = /<(?:[a-z0-9]+:)?Name>([^<]+)<\/(?:[a-z0-9]+:)?Name>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    const value = match[1].trim();
    if (value && !names.includes(value)) names.push(value);
    if (names.length >= MAX_LAYERS) break;
  }
  return names;
}

/** Хаягийг GetCapabilities хүсэлт болгоно (байгаа query-г хэвээр үлдээнэ). */
function capabilitiesUrl(raw: string): string {
  const parsed = new URL(raw);
  parsed.searchParams.set("service", "WMS");
  parsed.searchParams.set("request", "GetCapabilities");
  if (!parsed.searchParams.get("version")) parsed.searchParams.set("version", "1.3.0");
  parsed.searchParams.delete("layers");
  return parsed.toString();
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated(request.headers.get("authorization")))) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => ({}));
  const rawURL = typeof body?.url === "string" ? body.url.trim() : "";
  if (!/^https?:\/\//i.test(rawURL)) {
    return Response.json({ error: "Хаяг http:// эсвэл https://-ээр эхлэх ёстой" }, { status: 400 });
  }

  const type = detectBasemapType(rawURL);
  const layerFromUrl = parseWmsLayerFromUrl(rawURL);

  // Давхаргыг хайх шаардлага зөвхөн WMS-д, хаягт layers= байхгүй үед гарна.
  if (type !== "wms" || layerFromUrl) {
    return Response.json({ type, layers: layerFromUrl ? [layerFromUrl] : [] });
  }

  try {
    const res = await fetch(capabilitiesUrl(rawURL), {
      signal: AbortSignal.timeout(CAPS_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      return Response.json({ type, layers: [] });
    }
    const reader = await res.arrayBuffer();
    if (reader.byteLength > MAX_CAPS_BYTES) {
      return Response.json({ type, layers: [] });
    }
    const xml = new TextDecoder("utf-8").decode(reader);
    return Response.json({ type, layers: parseCapabilityLayerNames(xml) });
  } catch {
    // Хүрч чадсангүй / хугацаа хэтэрсэн — дэлгэц давхаргын нэрийг гараас асууна.
    return Response.json({ type, layers: [] });
  }
}
