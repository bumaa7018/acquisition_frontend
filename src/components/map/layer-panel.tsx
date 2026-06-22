"use client";
import { useState } from "react";
import { useTheme } from "next-themes";
import { Eye, EyeOff, Layers, ChevronDown } from "lucide-react";

export interface LayerConfig {
  id: string;
  label: string;
  visible: boolean;
  color: string;
}

interface LayerPanelProps {
  layers: LayerConfig[];
  onToggle: (id: string) => void;
}

export default function LayerPanel({ layers, onToggle }: LayerPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const visibleCount = layers.filter((l) => l.visible).length;

  const bg = dark ? "rgba(30,31,39,0.95)" : "rgba(255,255,255,0.93)";
  const border = dark ? "rgba(55,57,77,0.8)" : "rgba(0,0,0,0.07)";
  const divClr = dark ? "rgba(55,57,77,0.6)" : "rgba(0,0,0,0.06)";
  const hover = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";
  const lblClr = dark ? "#aab8c5" : "#334155";
  const subClr = dark ? "#8391a2" : "#94a3b8";

  return (
    <div
      className="absolute top-3 right-3 z-10 w-52 rounded-xl overflow-hidden"
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
        style={{ ":hover": { background: hover } } as React.CSSProperties}
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

      {/* Layer list */}
      {!collapsed && (
        <div style={{ borderTop: `1px solid ${divClr}` }}>
          {layers.map((layer, i) => (
            <button
              key={layer.id}
              onClick={() => onToggle(layer.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all"
              style={{
                opacity: layer.visible ? 1 : 0.4,
                borderTop: i > 0 ? `1px solid ${divClr}` : "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = hover)}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{
                  background: layer.color,
                  boxShadow: layer.visible
                    ? `0 0 0 1.5px ${layer.color}50`
                    : "none",
                }}
              />
              <span
                className="flex-1 text-[11.5px] font-medium truncate leading-tight"
                style={{ color: lblClr }}
              >
                {layer.label}
              </span>
              {layer.visible ? (
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

          {/* Footer */}
          <div
            className="px-3 py-2 flex justify-between gap-2"
            style={{ borderTop: `1px solid ${divClr}` }}
          >
            <button
              onClick={() =>
                layers.forEach((l) => !l.visible && onToggle(l.id))
              }
              className="text-[10px] font-semibold hover:underline transition-colors"
              style={{ color: "#02c0ce" }}
            >
              Бүгдийг нэмэх
            </button>
            <button
              onClick={() => layers.forEach((l) => l.visible && onToggle(l.id))}
              className="text-[10px] font-semibold hover:underline transition-colors"
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
