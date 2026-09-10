"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { useTheme } from "next-themes";
import { Eye, EyeOff, Layers, ChevronDown, Settings2 } from "lucide-react";
import { hasPermission } from "@/lib/role-utils";
import BasemapSettingsDialog from "./basemap-settings-dialog";
import { getBasemapSetting, subscribeBasemap, type BasemapSetting } from "./basemap-config";
import type { LayerHatch } from "./layer-config";

export interface LayerConfig {
  id: string;
  label: string;
  visible: boolean;
  color: string;
  group?: string;
  /**
   * Давхарга зурган дээр ТОРЛОСОН/ЦЭГЭН будагддаг бол тэр хэлбэр (SLD-тэй
   * ижил). Байвал өнгөт дөрвөлжин нь дүүрэн бус, ижил хэлбэрээр зурагдана.
   */
  hatch?: LayerHatch;
}

export interface LayerGroupConfig {
  id: string;
  label: string;
  color: string;
}

interface LayerPanelProps {
  layers: LayerConfig[];
  groups?: LayerGroupConfig[];
  onToggle: (id: string) => void;
}

/**
 * ӨНГӨТ ДӨРВӨЛЖИНГИЙН ДҮҮРГЭЛТ.
 *
 * Торлосон/цэгэн давхаргад (ГУС-ийн кодуудаар задарсан дэд давхаргууд)
 * дөрвөлжин нь ЗУРГАН ДЭЭРХТЭЙ ижил харагдана: бүдэг дүүргэлт + тор/цэг +
 * өнгөт хүрээ (гадна хилийн зураас). Дүүрэн өнгөөр үзүүлбэл самбар зурагтай
 * зөрж, хэрэглэгч "тайлбар нь дүүрэн, зураг нь торлосон" гэж төөрөгддөг.
 *
 * Хэлбэр нь SLD-ийн `shape://<нэр>`-тэй тохирно. Зураасны/цэгийн үе 3.5px —
 * дөрвөлжин 12px тул үүнээс сийрэг бол 1-2 зураас таарч, хэлбэр уншигдахгүй.
 */
function swatchStyle(color: string, hatch: LayerConfig["hatch"], visible: boolean): CSSProperties {
  const glow = visible ? `0 0 0 1.5px ${color}50` : "";
  if (!hatch) {
    return { background: color, boxShadow: glow || "none" };
  }
  const line = (angle: number) =>
    `repeating-linear-gradient(${angle}deg, ${color} 0 1px, transparent 1px 3.5px)`;
  const pattern: Record<NonNullable<LayerConfig["hatch"]>, string[]> = {
    slash: [line(45)],
    backslash: [line(-45)],
    times: [line(45), line(-45)],
    plus: [line(0), line(90)],
    vertline: [line(90)],
    horline: [line(0)],
    // ЦЭГЭН: 3.5px тор дээр 1px радиустай цэг (SLD-ийн shape://dot-ын эквивалент)
    dot: [`radial-gradient(${color} 0.9px, transparent 1px)`],
  };
  return {
    backgroundColor: `${color}26`,
    backgroundImage: pattern[hatch].join(","),
    backgroundSize: hatch === "dot" ? "3.5px 3.5px" : undefined,
    boxShadow: [`inset 0 0 0 1px ${color}`, glow].filter(Boolean).join(", "),
  };
}

export default function LayerPanel({
  layers,
  groups = [],
  onToggle,
}: LayerPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  // СУУРЬ зургийн тохиргоо — зөвхөн admin:update эрхтэй хэрэглэгч солино.
  const [basemapOpen, setBasemapOpen] = useState(false);
  const [basemap, setBasemap] = useState<BasemapSetting | null>(() => getBasemapSetting());
  const [canEditBasemap, setCanEditBasemap] = useState(false);
  useEffect(() => {
    // Эрхийг ЗӨВХӨН browser дээр шалгана (SSR-д токен байхгүй тул зөрөх бөгөөс
    // hydration warning гарна).
    setCanEditBasemap(hasPermission("admin:update"));
    setBasemap(getBasemapSetting());
    return subscribeBasemap(setBasemap);
  }, []);
  // Анхнаасаа ЗӨВХӨН асаалттай хүүтэй хэсэг нээлттэй. Шалтгаан: "Шинэ
  // зөвшилцсөн зураг" нь 9 дэд төрөлтэй ба бүгд унтраалттай — бүх хэсгийг
  // нээлттэй байлгавал самбар хэрэглэгчийн харах давхаргуудыг доош түлхэнэ.
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () =>
      new Set(
        groups
          .filter((g) => layers.some((l) => l.group === g.id && l.visible))
          .map((g) => g.id),
      ),
  );
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  const bg = dark ? "rgba(30,31,39,0.95)" : "rgba(255,255,255,0.93)";
  const border = dark ? "rgba(55,57,77,0.8)" : "rgba(0,0,0,0.07)";
  const divClr = dark ? "rgba(55,57,77,0.6)" : "rgba(0,0,0,0.06)";
  const hover = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
  const lblClr = dark ? "#aab8c5" : "#334155";
  const subClr = dark ? "#8391a2" : "#94a3b8";

  const toggleGroup = (gid: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(gid) ? next.delete(gid) : next.add(gid);
      return next;
    });

  const groupVisible = (gid: string) =>
    layers.filter((l) => l.group === gid).some((l) => l.visible);

  const toggleAllInGroup = (gid: string) => {
    const inGroup = layers.filter((l) => l.group === gid);
    const anyVisible = inGroup.some((l) => l.visible);
    inGroup.forEach((l) => {
      if (anyVisible ? l.visible : !l.visible) onToggle(l.id);
    });
  };

  const standaloneLayer = (l: LayerConfig) => !l.group;
  const standalone = layers.filter(standaloneLayer);
  const visibleCount = layers.filter((l) => l.visible).length;

  let rowIndex = 0;

  return (
    <div
      className="absolute top-3 right-3 z-10 flex w-56 flex-col rounded-xl overflow-hidden"
      style={{
        // Газрын зургийн өндрөөс ХЭТРЭХГҮЙ (доод мөрүүд тасарч харагдахгүй
        // болохоос сэргийлнэ). Дотор нь зөвхөн давхаргын жагсаалт гүйнэ.
        maxHeight: "calc(100% - 24px)",
        background: bg,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: dark
          ? "0 4px 24px rgba(0,0,0,.45)"
          : "0 4px 24px rgba(0,0,0,.15)",
        border: `1px solid ${border}`,
      }}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full shrink-0 flex items-center justify-between px-3 py-2.5 transition-colors"
        onMouseEnter={(e) => (e.currentTarget.style.background = hover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-6 w-6 items-center justify-center rounded-md"
            style={{ background: "#02c0ce20" }}
          >
            <Layers className="h-3.5 w-3.5" style={{ color: "#02c0ce" }} />
          </div>
          <span
            className="text-[12px] font-bold uppercase tracking-wider"
            style={{ color: lblClr }}
          >
            Давхаргууд
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white"
            style={{ background: "#02c0ce" }}
          >
            {visibleCount}/{layers.length}
          </span>
          <ChevronDown
            className="h-3.5 w-3.5 transition-transform"
            style={{
              color: subClr,
              transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
            }}
          />
        </div>
      </button>

      {!collapsed && (
        <div className="flex min-h-0 flex-1 flex-col" style={{ borderTop: `1px solid ${divClr}` }}>
          {/* Зөвхөн ЭНЭ хэсэг гүйнэ. min-h-0 байхгүй бол flex хүү нь агуулгаараа
              тэлж, панель газрын зургаас гарч доод мөрүүд харагдахгүй болно. */}
          <div className="min-h-0 flex-1 overflow-y-auto" style={{ maxHeight: 260 }}>
            {/* Standalone layers */}
            {standalone.map((layer) => {
              const idx = rowIndex++;
              return (
                <div
                  key={layer.id}
                  style={{
                    opacity: layer.visible ? 1 : 0.45,
                    borderTop: idx > 0 ? `1px solid ${divClr}` : "none",
                  }}
                >
                  <div className="flex items-center gap-2 px-3 py-2 transition-all">
                  <button
                    onClick={() => onToggle(layer.id)}
                    className="shrink-0 h-3 w-3 rounded-sm"
                    style={swatchStyle(layer.color, layer.hatch, layer.visible)}
                  />
                  <button
                    className="flex-1 text-left text-[11.5px] font-medium truncate leading-tight"
                    style={{ color: lblClr }}
                    onClick={() => onToggle(layer.id)}
                  >
                    {layer.label}
                  </button>
                  <button
                    onClick={() => onToggle(layer.id)}
                    className="shrink-0"
                  >
                    {layer.visible ? (
                      <Eye className="h-3 w-3" style={{ color: "#02c0ce" }} />
                    ) : (
                      <EyeOff className="h-3 w-3" style={{ color: subClr }} />
                    )}
                  </button>
                  </div>
                </div>
              );
            })}

            {/* Groups */}
            {groups.map((group) => {
              const isExpanded = expandedGroups.has(group.id);
              const anyVis = groupVisible(group.id);
              const children = layers.filter((l) => l.group === group.id);
              const idx = rowIndex++;

              return (
                <div
                  key={group.id}
                  style={{
                    borderTop: idx > 0 ? `1px solid ${divClr}` : "none",
                  }}
                >
                  {/* Group header row */}
                  <div
                    className="flex items-center gap-2 px-3 py-2"
                    style={{ opacity: anyVis ? 1 : 0.5 }}
                  >
                    {/* Color bar — toggle all */}
                    <button
                      onClick={() => toggleAllInGroup(group.id)}
                      className="shrink-0 h-3 w-3 rounded-sm"
                      style={{
                        background: group.color,
                        boxShadow: anyVis
                          ? `0 0 0 1.5px ${group.color}50`
                          : "none",
                      }}
                    />
                    {/* Label — expand/collapse */}
                    <button
                      className="flex-1 text-left text-[11.5px] font-semibold truncate leading-tight"
                      style={{ color: lblClr }}
                      onClick={() => toggleGroup(group.id)}
                    >
                      {group.label}
                    </button>
                    {/* Eye — toggle all */}
                    <button
                      onClick={() => toggleAllInGroup(group.id)}
                      className="shrink-0"
                    >
                      {anyVis ? (
                        <Eye className="h-3 w-3" style={{ color: "#02c0ce" }} />
                      ) : (
                        <EyeOff className="h-3 w-3" style={{ color: subClr }} />
                      )}
                    </button>
                    {/* Chevron — expand */}
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className="shrink-0"
                    >
                      <ChevronDown
                        className="h-3 w-3 transition-transform"
                        style={{
                          color: subClr,
                          transform: isExpanded
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                        }}
                      />
                    </button>
                  </div>

                  {/* Children */}
                  {isExpanded && (
                    <div style={{ borderTop: `1px solid ${divClr}` }}>
                      {children.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => onToggle(child.id)}
                          className="w-full flex items-center gap-2 pl-7 pr-3 py-1.5 transition-all"
                          style={{
                            background: child.visible
                              ? `${child.color}14`
                              : "transparent",
                            opacity: child.visible ? 1 : 0.5,
                          }}
                          onMouseEnter={(e) => {
                            if (!child.visible)
                              e.currentTarget.style.background = hover;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = child.visible
                              ? `${child.color}14`
                              : "transparent";
                          }}
                        >
                          <span
                            className="shrink-0 h-3 w-3 rounded-sm"
                            style={{
                              ...swatchStyle(child.color, child.hatch, child.visible),
                              opacity: child.visible ? 1 : 0.4,
                            }}
                          />
                          <span
                            // Нэр урт бол таслагдана — бүтнээр нь hover-оор харуулна.
                            title={child.label}
                            className="flex-1 text-left text-[11px] font-medium truncate"
                            style={{
                              color: child.visible
                                ? dark
                                  ? "#d1d5db"
                                  : "#1e293b"
                                : subClr,
                            }}
                          >
                            {child.label}
                          </span>
                          {child.visible ? (
                            <Eye
                              className="h-3 w-3 shrink-0"
                              style={{ color: "#02c0ce" }}
                            />
                          ) : (
                            <EyeOff
                              className="h-3 w-3 shrink-0"
                              style={{ color: subClr }}
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Суурь зураг — одоогийн эх сурвалж ба (эрхтэй бол) тохиргооны товч.
              shrink-0: жагсаалт урт байсан ч энэ мөр агшиж алга болохгүй. */}
          <div
            className="shrink-0 px-3 py-2 flex items-center gap-2"
            style={{ borderTop: `1px solid ${divClr}` }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: subClr }}>
                Суурь зураг
              </p>
              <p className="truncate text-[11px]" style={{ color: lblClr }} title={basemap?.url || undefined}>
                {basemap?.enabled
                  ? basemap.name || basemap.url
                  : "Үндсэн суурь зураг (хиймэл дагуул)"}
              </p>
            </div>
            {canEditBasemap && (
              <button
                onClick={() => setBasemapOpen(true)}
                title="Суурь зургийн хаягийг тохируулах"
                className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md transition-colors"
                style={{ background: "#02c0ce20" }}
              >
                <Settings2 className="h-3.5 w-3.5" style={{ color: "#02c0ce" }} />
              </button>
            )}
          </div>

          {/* Footer */}
          <div
            className="shrink-0 px-3 py-2 flex justify-between gap-2"
            style={{ borderTop: `1px solid ${divClr}` }}
          >
            <button
              onClick={() =>
                layers.forEach((l) => !l.visible && onToggle(l.id))
              }
              className="text-[10px] font-semibold hover:underline"
              style={{ color: "#02c0ce" }}
            >
              Бүгдийг нэмэх
            </button>
            <button
              onClick={() => layers.forEach((l) => l.visible && onToggle(l.id))}
              className="text-[10px] font-semibold hover:underline"
              style={{ color: subClr }}
            >
              Бүгдийг хасах
            </button>
          </div>
        </div>
      )}

      {basemapOpen && <BasemapSettingsDialog onClose={() => setBasemapOpen(false)} />}
    </div>
  );
}
