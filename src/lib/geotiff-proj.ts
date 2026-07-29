import proj4 from "proj4";
import { register, getProjectionCodeLookup, setProjectionCodeLookup } from "ol/proj/proj4";

let registered = false;

// Drone-processed GeoTIFFs are usually left in whatever local UTM zone the flight was
// planned in (Mongolia spans EPSG:32646-32650), not the map's EPSG:3857. OpenLayers only
// knows 4326/3857 out of the box, so any other EPSG code needs a proj4 definition before
// it can reproject the raster onto the map. UTM defs follow a fixed formula from the zone
// number, so we compute them instead of hardcoding one zone or hitting an external service.
function utmDefFromCode(code: string): string | null {
  const match = /^EPSG:(326|327)(\d{2})$/.exec(code);
  if (!match) return null;
  const south = match[1] === "327";
  const zone = Number(match[2]);
  return `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs${south ? " +south" : ""}`;
}

export function ensureGeoTiffProjections() {
  if (registered) return;
  registered = true;
  register(proj4);

  const fallbackLookup = getProjectionCodeLookup();
  setProjectionCodeLookup(async (code) => {
    const utmDef = utmDefFromCode(code);
    if (utmDef) return utmDef;
    return fallbackLookup(code);
  });
}
