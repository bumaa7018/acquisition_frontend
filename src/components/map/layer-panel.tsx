"use client";
import { useState } from "react";
import { useTheme } from "next-themes";
import { Eye, EyeOff, Layers, ChevronDown } from "lucide-react";

export interface LayerConfig {
  id: string;
  label: string;
  visible: boolean;
  color: string;
  group?: string;
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

export default function LayerPanel({
  layers,
  groups = [],
  onToggle,
}: LayerPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(groups.map((g) => g.id)),
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
      className="absolute top-3 right-3 z-10 w-56 rounded-xl overflow-hidden"
      style={{
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
        className="w-full flex items-center justify-between px-3 py-2.5 transition-colors"
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
        <div style={{ borderTop: `1px solid ${divClr}` }}>
          <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
            {/* Standalone layers */}
            {standalone.map((layer) => {
              const idx = rowIndex++;
              return (
                <div
                  key={layer.id}
                  className="flex items-center gap-2 px-3 py-2 transition-all"
                  style={{
                    opacity: layer.visible ? 1 : 0.45,
                    borderTop: idx > 0 ? `1px solid ${divClr}` : "none",
                  }}
                >
                  <button
                    onClick={() => onToggle(layer.id)}
                    className="shrink-0 h-3 w-3 rounded-sm"
                    style={{
                      background: layer.color,
                      boxShadow: layer.visible
                        ? `0 0 0 1.5px ${layer.color}50`
                        : "none",
                    }}
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
                            className="shrink-0 h-2.5 w-2.5 rounded-sm"
                            style={{
                              background: child.color,
                              boxShadow: child.visible
                                ? `0 0 0 1.5px ${child.color}50`
                                : "none",
                              opacity: child.visible ? 1 : 0.4,
                            }}
                          />
                          <span
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

          {/* Footer */}
          <div
            className="px-3 py-2 flex justify-between gap-2"
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
    </div>
  );
}
