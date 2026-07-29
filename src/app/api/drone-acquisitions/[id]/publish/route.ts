import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated, unauthorizedResponse } from "@/lib/server/verify-auth";
import { resolveImageUrl } from "@/lib/utils";

// Publishes a drone_acquisitions row's stored .tif to GeoServer as a coverage
// layer, and PATCHes geoserver_layer/status back onto the row — this is the
// REST-admin half of the upload flow that intentionally does NOT live in the
// Go backend (see acquisition_backend's drone_acquisitions service comment).
// NEXT_GS_URL is the same GeoServer instance src/lib/geoserver.ts already
// proxies WMS/WFS reads through. GS_ADMIN_USER/GS_ADMIN_PASSWORD are
// server-only env vars, never sent to the browser — optional: this
// deployment's GeoServer REST API doesn't enforce auth, so they're only
// attached when actually set (leave GS_ADMIN_PASSWORD unset to skip Basic
// Auth entirely rather than sending an empty/garbage credential).

const BACKEND = process.env.NEXT_API_URL ?? "http://localhost:8080";
const GS_URL = process.env.NEXT_GS_URL ?? "http://localhost:8600";
const GS_WORKSPACE = process.env.GS_WORKSPACE ?? "land";
const GS_ADMIN_USER = process.env.GS_ADMIN_USER ?? "";
const GS_ADMIN_PASSWORD = process.env.GS_ADMIN_PASSWORD ?? "";

interface DroneAcquisitionRow {
  id: number;
  tif_path?: string;
  geoserver_layer?: string;
}

function gsAuthHeaders(): Record<string, string> {
  if (!GS_ADMIN_USER && !GS_ADMIN_PASSWORD) return {};
  const token = Buffer.from(`${GS_ADMIN_USER}:${GS_ADMIN_PASSWORD}`).toString("base64");
  return { Authorization: `Basic ${token}` };
}

// storeNameFromTifPath derives a coverage-store name from the backend's
// stored .tif path (e.g. "drone-tif/<uuid>.tif" -> "drone_<uuid>") — every
// upload gets a fresh uuid filename from the Go backend, so this is unique
// per publish without the route having to mint/track its own ids.
function storeNameFromTifPath(tifPath: string): string {
  const base = tifPath.split("/").pop() ?? tifPath;
  return "drone_" + base.replace(/\.tif+$/i, "");
}

function storeNameFromLayer(layer: string): string {
  const idx = layer.indexOf(":");
  return idx === -1 ? layer : layer.slice(idx + 1);
}

async function getAcquisition(id: string, authorization: string): Promise<DroneAcquisitionRow> {
  const res = await fetch(`${BACKEND}/api/v1/drone-acquisitions/${id}`, {
    headers: { Authorization: authorization },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`drone acquisition ${id} not found (${res.status})`);
  const json = await res.json();
  return json.data as DroneAcquisitionRow;
}

async function patchAcquisition(id: string, authorization: string, body: Record<string, unknown>) {
  const res = await fetch(`${BACKEND}/api/v1/drone-acquisitions/${id}`, {
    method: "PUT",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`failed to update drone acquisition ${id} (${res.status})`);
  return res.json();
}

async function deleteCoverageStore(storeName: string) {
  await fetch(
    `${GS_URL}/geoserver/rest/workspaces/${GS_WORKSPACE}/coveragestores/${storeName}?purge=all&recurse=true`,
    { method: "DELETE", headers: gsAuthHeaders() },
  ).catch(() => {});
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authorization = request.headers.get("authorization");
  if (!(await isAuthenticated(authorization))) return unauthorizedResponse();

  const { id } = await params;

  try {
    const acq = await getAcquisition(id, authorization!);
    if (!acq.tif_path) {
      return NextResponse.json({ error: "tif_path байхгүй тул нийтлэх боломжгүй" }, { status: 400 });
    }

    const tifUrl = resolveImageUrl(acq.tif_path);
    const tifRes = await fetch(tifUrl!);
    if (!tifRes.ok) {
      throw new Error(`failed to fetch .tif from ${tifUrl} (${tifRes.status})`);
    }
    const tifBytes = await tifRes.arrayBuffer();

    const storeName = storeNameFromTifPath(acq.tif_path);
    const publishUrl =
      `${GS_URL}/geoserver/rest/workspaces/${GS_WORKSPACE}/coveragestores/${storeName}/file.geotiff` +
      `?configure=first&coverageName=${storeName}`;

    const gsRes = await fetch(publishUrl, {
      method: "PUT",
      headers: { ...gsAuthHeaders(), "Content-Type": "image/tiff" },
      body: tifBytes,
    });

    if (!gsRes.ok) {
      const detail = await gsRes.text().catch(() => "");
      await patchAcquisition(id, authorization!, { status: "failed" }).catch(() => {});
      return NextResponse.json(
        { error: `GeoServer publish алдаа (${gsRes.status}): ${detail.slice(0, 500)}` },
        { status: 502 },
      );
    }

    const layerName = `${GS_WORKSPACE}:${storeName}`;

    if (acq.geoserver_layer && acq.geoserver_layer !== layerName) {
      await deleteCoverageStore(storeNameFromLayer(acq.geoserver_layer));
    }

    const updated = await patchAcquisition(id, authorization!, {
      geoserver_layer: layerName,
      status: "ready",
    });

    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await patchAcquisition(id, authorization!, { status: "failed" }).catch(() => {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authorization = request.headers.get("authorization");
  if (!(await isAuthenticated(authorization))) return unauthorizedResponse();

  const { id } = await params;

  try {
    const acq = await getAcquisition(id, authorization!);
    if (acq.geoserver_layer) {
      await deleteCoverageStore(storeNameFromLayer(acq.geoserver_layer));
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
