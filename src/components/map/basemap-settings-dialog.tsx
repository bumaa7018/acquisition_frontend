"use client";

// Суурь зургийн хаягийг ГАРААС тохируулах цонх (төлөвлөгөөний 2.6.1).
//
// Хэрэглэгчээс ЗӨВХӨН ХАЯГ авна — эх сурвалжийн төрлийг (tile / растер WMS /
// тогтмол зураг) хаягийн бүтцээр өөрөө таньж, шаардлагатай нэмэлт мэдээллийг
// (WMS-ийн давхаргын нэр, зургийн хүрээ) зөвхөн хаягаас олдохгүй үед л асууна.
//
// Хадгалсны дараа тохиргоо СИСТЕМИЙН хэмжээнд хэрэгжинэ (бүх хэрэглэгч, бүх
// газрын зураг) — зураг дахин ачаалахгүйгээр суурь давхарга солигдоно.

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Map as MapIcon, RotateCcw, X } from "lucide-react";
import { settingsApi } from "@/lib/api";
import { authHeaders } from "@/lib/template-values";
import { getApiError } from "@/lib/utils";
import {
  detectBasemapType,
  parseWmsLayerFromUrl,
  setBasemapSetting,
  validateBasemapInput,
  type BasemapSetting,
} from "./basemap-config";
import { BASEMAP_QUERY_KEY } from "./use-basemap-sync";

export default function BasemapSettingsDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: current, isLoading } = useQuery({
    queryKey: BASEMAP_QUERY_KEY,
    queryFn: () => settingsApi.getBasemap(),
  });

  const [url, setUrl] = useState("");
  const [layer, setLayer] = useState("");
  const [extent, setExtent] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Цонхыг эцэг элементээс ГАРГАЖ body дээр рендерлэнэ (доорх portal-ыг үз).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Хадгалагдсан тохиргоог маягтад буулгана (байхгүй бол хоосон = үндсэн зураг).
  useEffect(() => {
    if (!current) return;
    setUrl(current.url ?? "");
    setLayer(current.layer ?? "");
    setExtent(current.extent?.length === 4 ? current.extent.join(", ") : "");
  }, [current]);

  const trimmedUrl = url.trim();
  const type = useMemo(() => detectBasemapType(trimmedUrl), [trimmedUrl]);
  // WMS-ийн давхаргын нэр хаяг дотроо байвал (GetMap хаягийг бүтнээр хуулахад)
  // хэрэглэгчээс дахин асуухгүй.
  const layerFromUrl = useMemo(() => parseWmsLayerFromUrl(trimmedUrl), [trimmedUrl]);

  /*
   * WMS-ийн давхаргыг ӨӨРӨӨ таних. Хаягт `layers=` байхгүй үед GetCapabilities
   * -аас нэрсийг уншина — тэр хүсэлтийг СЕРВЕР тал хийнэ (дотоод GeoServer нь
   * CORS толгой буцаадаггүй тул browser уншиж чадахгүй).
   *
   * Олдвол ЭХНИЙ давхаргыг шууд сонгоно: хэрэглэгч зөвхөн хаяг тавиад
   * хадгалахад л ажиллана. Олдохгүй бол доорх нүд гарч гараас асууна.
   */
  const [probing, setProbing] = useState(false);
  const [probedLayers, setProbedLayers] = useState<string[]>([]);
  useEffect(() => {
    if (!trimmedUrl || type !== "wms" || layerFromUrl) {
      setProbedLayers([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setProbing(true);
      try {
        const res = await fetch("/api/basemap/probe", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ url: trimmedUrl }),
        });
        const data = (await res.json().catch(() => ({}))) as { layers?: string[] };
        if (cancelled) return;
        const found = Array.isArray(data.layers) ? data.layers.filter(Boolean) : [];
        setProbedLayers(found);
        // Хэрэглэгч өөрөө бичээгүй бол эхний давхаргыг автоматаар сонгоно.
        if (found.length > 0) setLayer((prev) => prev || found[0]);
      } catch {
        if (!cancelled) setProbedLayers([]);
      } finally {
        if (!cancelled) setProbing(false);
      }
    }, 500); // хаяг бичиж байхад хүсэлт бөөгнөрөхгүй
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedUrl, type, layerFromUrl]);

  // Давхарга ХААНААС ч олдоогүй үед л гараас асууна.
  const needLayer = !!trimmedUrl && type === "wms" && !layerFromUrl && !layer.trim();
  const needExtent = !!trimmedUrl && type === "image";

  const parseExtent = (): number[] =>
    extent
      .split(/[,\s]+/)
      .map((v) => v.trim())
      .filter(Boolean)
      .map(Number);

  const buildPayload = (): BasemapSetting => ({
    type,
    url: trimmedUrl,
    // Хаяг хоосон бол унтраалттай — үндсэн суурь зураг хэрэглэгдэнэ.
    enabled: !!trimmedUrl,
    layer: type === "wms" ? layerFromUrl || layer.trim() || undefined : undefined,
    extent: needExtent ? parseExtent() : undefined,
  });

  const saveMutation = useMutation({
    mutationFn: () => settingsApi.saveBasemap(buildPayload()),
    onSuccess: (saved) => {
      toast.success(
        saved?.enabled ? "Суурь зураг солигдлоо" : "Үндсэн суурь зураг хэрэглэгдэнэ",
      );
      // Модул дахь санг ШУУД шинэчилнэ — нээлттэй газрын зургууд тэр дороо солигдоно.
      setBasemapSetting(saved ?? null);
      void queryClient.invalidateQueries({ queryKey: BASEMAP_QUERY_KEY });
      onClose();
    },
    onError: (err) => toast.error(getApiError(err, "Хадгалахад алдаа гарлаа")),
  });

  const resetMutation = useMutation({
    mutationFn: () => settingsApi.resetBasemap(),
    onSuccess: () => {
      toast.success("Үндсэн суурь зураг рүү буцлаа");
      setBasemapSetting(null);
      setUrl("");
      setLayer("");
      setExtent("");
      void queryClient.invalidateQueries({ queryKey: BASEMAP_QUERY_KEY });
      onClose();
    },
    onError: (err) => toast.error(getApiError(err, "Устгахад алдаа гарлаа")),
  });

  const handleSubmit = () => {
    const message = validateBasemapInput({
      type,
      url: trimmedUrl,
      layer: layerFromUrl || layer,
      extent: needExtent ? parseExtent() : undefined,
    });
    setError(message);
    if (message) return;
    saveMutation.mutate();
  };

  const busy = saveMutation.isPending || resetMutation.isPending;
  const inputCls =
    "h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition-all focus:border-[#02c0ce] focus:ring-2 focus:ring-[#02c0ce]/15 dark:border-white/[0.08] dark:bg-[#1e1f27] dark:text-slate-200";

  /*
   * ЯАГААД PORTAL: энэ цонх давхаргын панелийн (LayerPanel) дотор бүтцийн
   * хувьд байрладаг ба тэр панель `backdrop-filter`-тэй. CSS-ийн дүрмээр
   * filter/backdrop-filter нь `position: fixed` ХҮҮГИЙН харьцах хүрээг өөр
   * дээрээ авдаг тул цонх дэлгэцийн биш, ПАНЕЛИЙН хүрээнд тавигдаж,
   * панелийн `overflow: hidden`-д тайрагддаг байв. body дээр рендерлэснээр
   * цонх бүтэн харагдана.
   */
  const dialog = (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 dark:border-white/[0.06] dark:bg-[#1e1f27]">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-[#37394d]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#02c0ce]/10">
              <MapIcon className="h-4 w-4 text-[#02c0ce]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold leading-tight text-slate-800 dark:text-white">
                Суурь зургийн тохиргоо
              </p>
              <p className="mt-0.5 text-[11px] leading-tight text-slate-400 dark:text-slate-500">
                Бүх хэрэглэгчийн газрын зурагт хэрэгжинэ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-[#252630]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Зөвхөн ЭНЭ хэсэг гүйнэ — толгой ба доод товчнууд үргэлж харагдана */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Газрын зургийн хаяг
            </label>
            <input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              placeholder="https://tile.example.mn/imagery/{z}/{y}/{x}.png"
              className={inputCls}
            />
            <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
              Хоосон бол үндсэн суурь зураг хэрэглэгдэнэ. Тайлын ({"{z}/{x}/{y}"}), WMS болон
              зургийн хаяг аль нь ч байж болно — хаягаас өөрөө тодорхойлно.
            </p>
          </div>

          {/* Автоматаар танисан давхарга — GetCapabilities-аас */}
          {type === "wms" && !layerFromUrl && (probing || probedLayers.length > 0) && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 dark:border-white/[0.06] dark:bg-[#191b22]">
              {probing ? (
                <p className="flex items-center gap-1.5 text-[11.5px] text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> Давхаргыг таниж байна…
                </p>
              ) : (
                <>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    Автоматаар танисан давхарга (өөрийг сонгож болно):
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {probedLayers.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => {
                          setLayer(name);
                          setError(null);
                        }}
                        className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-medium transition-colors ${
                          layer === name
                            ? "bg-[#02c0ce]/15 text-[#02c0ce]"
                            : "bg-white text-slate-500 hover:bg-slate-200 dark:bg-[#252630] dark:text-slate-400"
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Хаанаас ч олдоогүй бол л гараас асууна */}
          {needLayer && (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                WMS давхаргын нэр <span className="text-red-400">*</span>
              </label>
              <input
                value={layer}
                onChange={(e) => {
                  setLayer(e.target.value);
                  setError(null);
                }}
                placeholder="ж: imagery:ortho_2026"
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                Хаягт <span className="font-mono">layers=</span> байвал энэ хэсэг гарахгүй.
              </p>
            </div>
          )}

          {needExtent && (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Зургийн хүрээ — minLon, minLat, maxLon, maxLat <span className="text-red-400">*</span>
              </label>
              <input
                value={extent}
                onChange={(e) => {
                  setExtent(e.target.value);
                  setError(null);
                }}
                placeholder="106.75, 47.85, 106.95, 47.95"
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                Тогтмол зургийг газрын зураг дээр ХААНА тавихыг зөвхөн хүрээ тодорхойлно.
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400">
              {error}
            </p>
          )}

          {isLoading && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500">Тохиргоо уншиж байна…</p>
          )}
          {current?.updated_at && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Сүүлд шинэчилсэн: {new Date(current.updated_at).toLocaleString("mn-MN")}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 px-5 py-4 dark:border-[#37394d]">
          <button
            onClick={() => resetMutation.mutate()}
            disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-[#252630]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Үндсэн зураг рүү буцаах
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={busy}
              className="h-9 rounded-xl px-4 text-[13px] font-medium text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-[#252630]"
            >
              Болих
            </button>
            <button
              onClick={handleSubmit}
              disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#02c0ce] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#02c0ce]/90 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Хадгалах
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(dialog, document.body);
}
