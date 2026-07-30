"use client";
import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { landApi } from "@/lib/api";
import { getApiError } from "@/lib/utils";
import type { AU, DroneImage } from "@/types";
import type { DroneOverlay } from "@/components/map/acquisition-map";
import { toast } from "sonner";
import {
  Upload,
  Eye,
  EyeOff,
  Trash2,
  Crosshair,
  Plane,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { ConfirmDialog, type PendingConfirm } from "@/components/ui/confirm-dialog";

const AcquisitionMap = dynamic(
  () => import("@/components/map/acquisition-map").then((m) => m.AcquisitionMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[600px] animate-pulse rounded-xl bg-slate-100 dark:bg-[#252630]" />
    ),
  },
);

/**
 * Дроны зургийн ХАМГИЙН ИХ хэмжээ.
 *
 * Файл нь backend-ээр дамждаггүй ч (шууд файлын систем рүү) хязгааргүй байлгаж
 * болохгүй: хэт том ортофото байршуулалт нь удаан сүлжээн дээр таслагдаж,
 * GeoServer-ийн COG уншилт удааширч, дискний зай тооцоолохгүй өсдөг. Хязгаарыг
 * ТОДОРХОЙ мессежээр урьдчилан хэлэх нь хагас байршсаны дараа унахаас дээр.
 */
const MAX_DRONE_SIZE = 500 * 1024 * 1024;
const MAX_DRONE_SIZE_LABEL = "500 MB";

function formatSize(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatDate(value: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/**
 * Зургийн WGS84 хүрээг буцаана. ХҮЧИНГҮЙ хүрээг null болгоно.
 *
 * Яагаад хатуу шалгадаг: буруу хүрээ (жишээ: тэнхлэг солигдож уртраг нь
 * өргөрөгт орсон) газрын зургийг цагаан болгож, OpenLayers-ийг хязгааргүй
 * хүсэлтийн эргэлтэд оруулж байсан. Хүчингүй бол давхарга НЭМЭХГҮЙ нь
 * зөв — эс тэгвээс бүтэн газрын зураг эвдэрнэ.
 */
function imageBounds(
  img?: DroneImage,
): [number, number, number, number] | null {
  if (
    !img ||
    img.min_x == null ||
    img.min_y == null ||
    img.max_x == null ||
    img.max_y == null
  ) {
    return null;
  }
  const [minX, minY, maxX, maxY] = [img.min_x, img.min_y, img.max_x, img.max_y];
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
  // Уртраг ±180, өргөрөг ±90 дотор байх ёстой
  if (Math.abs(minX) > 180 || Math.abs(maxX) > 180) return null;
  if (Math.abs(minY) > 90 || Math.abs(maxY) > 90) return null;
  // Хүрээ нь бодит талбай эзлэх ёстой (цэг/эргүү хүрээ болохгүй)
  if (minX >= maxX || minY >= maxY) return null;
  return [minX, minY, maxX, maxY];
}

export function LocationTab({
  id,
  aus,
  canEdit,
}: {
  id: string;
  aus?: AU[];
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  // Хүрээ мэдэгдэхгүй зураг дээр "шилжих" дарсан бол refresh дууссаны дараа
  // тэр зураг рүү нүүхийн тулд id-г түр хадгална.
  const focusAfterRefresh = useRef<string | null>(null);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set());
  const [focus, setFocus] = useState<[number, number, number, number] | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);

  const { data: images, isLoading } = useQuery({
    queryKey: ["drone-images", id],
    queryFn: () => landApi.listDroneImages(id),
    enabled: !!id,
  });

  const list = useMemo(() => images ?? [], [images]);

  // Сонгогдсон зургууд → газрын зургийн давхаргууд. Зураг тус бүр өөрийн
  // GeoServer давхаргатай (layer_name).
  //
  // Хүрээ (bbox) МЭДЭГДЭЖ байгаа зургийг л давхарлана: extent нь давхаргыг
  // зургийн гадна зурахгүй байлгах хамгаалалт (acquisition-map-ийн тайлбарыг
  // үзнэ үү). Хүрээгүй зураг дээр "Харах" дарвал focusOnImage нь GeoServer-ийг
  // шинэчилж хүрээг олж авах тул дараа нь өөрөө давхарлагдана.
  const overlays = useMemo<DroneOverlay[]>(
    () =>
      list.flatMap((img) => {
        if (!visibleIds.has(img.id) || !img.layer_name) return [];
        const extent = imageBounds(img);
        if (!extent) return [];
        return [
          {
            id: img.id,
            layerName: img.layer_name,
            extent,
          },
        ];
      }),
    [list, visibleIds],
  );

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setProgress(0);
      // 1. Backend-ээс байршуулах зөвшөөрөл. 2. Файлыг ШУУД файлын систем руу
      // (backend-ээр дамжихгүй). 3. Backend объектыг шалгаж бүртгэнэ.
      const ticket = await landApi.createDroneUploadUrl(id, file.name);
      await landApi.putDroneFileDirect(ticket, file, setProgress);
      // Бүртгэх дуудлага нь GeoServer-т давхаргыг ӨӨРӨӨ нийтэлж, хүрээг
      // буцаадаг — тусад нь refresh дуудах шаардлагагүй (давхар дуудлага байв).
      const created = await landApi.registerDroneImage(
        id,
        ticket.stored_name,
        file.name,
      );
      setProgress(null);
      return created;
    },
    onSuccess: (created) => {
      toast.success(`"${created.original_name}" байршлаа`);
      queryClient.invalidateQueries({ queryKey: ["drone-images", id] });
      // Шинэ зургийг шууд харуулна
      setVisibleIds((prev) => new Set(prev).add(created.id));
      if (!created.published) {
        // Файл хадгалагдсан — зөвхөн GeoServer-т давхарга үүсээгүй.
        // ШАЛТГААНЫГ харуулна: эс тэгвээс зөвхөн серверийн лог дээр үлдэж,
        // хэрэглэгч юу засахаа мэдэхгүй болно.
        toast.warning("GeoServer-т давхарга үүсгэж чадсангүй", {
          description: created.publish_error
            ? `${created.publish_error} — "Шинэчлэх" товчоор дахин оролдоно уу.`
            : 'Шинэчлэх товчийг дарна уу.',
          duration: 15000,
        });
      }
    },
    onError: (err) => {
      setProgress(null);
      toast.error(getApiError(err, "Зураг байршуулахад алдаа гарлаа"));
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => landApi.refreshDroneImages(id),
    onSuccess: (list) => {
      queryClient.invalidateQueries({ queryKey: ["drone-images", id] });
      // Хүрээ мэдэгдэхгүй байсан зураг дээр "шилжих" хүсэлт хүлээгдэж байвал
      // одоо GeoServer-ээс уншсан хүрээгээр нүүнэ.
      const pendingId = focusAfterRefresh.current;
      focusAfterRefresh.current = null;
      if (!pendingId) {
        toast.success("GeoServer шинэчлэгдлээ");
        return;
      }
      const bounds = imageBounds(list.find((img) => img.id === pendingId));
      if (bounds) {
        setFocus(bounds);
        return;
      }
      toast.warning(
        "Зургийн хүрээг GeoServer-ээс уншиж чадсангүй — шилжих боломжгүй.",
      );
    },
    onError: (err) => {
      focusAfterRefresh.current = null;
      toast.error(getApiError(err, "Шинэчлэхэд алдаа гарлаа"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (imageId: string) => landApi.deleteDroneImage(id, imageId),
    onSuccess: (_res, imageId) => {
      toast.success("Устгагдлаа");
      setVisibleIds((prev) => {
        const next = new Set(prev);
        next.delete(imageId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["drone-images", id] });
    },
    onError: (err) => toast.error(getApiError(err, "Устгахад алдаа гарлаа")),
  });

  function pickFile() {
    fileInput.current?.click();
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Нэг дор олон файл оруулахгүй — нэг нэгээр байршуулна.
    e.target.value = "";
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".tif") && !lower.endsWith(".tiff")) {
      toast.error("Зөвхөн GeoTIFF (.tif / .tiff) файл байршуулна");
      return;
    }
    if (file.size > MAX_DRONE_SIZE) {
      toast.error(
        `Зургийн хэмжээ хэтэрсэн — ${formatSize(file.size)}. ` +
          `Дээд хязгаар ${MAX_DRONE_SIZE_LABEL}.`,
        {
          description:
            "Ортофотог жижиглэж хуваах, эсвэл COG болгон шахаж (gdal_translate -co COMPRESS=DEFLATE) оруулна уу.",
          duration: 10000,
        },
      );
      return;
    }
    uploadMutation.mutate(file);
  }

  /**
   * Тухайн зураг рүү газрын зургийг шилжүүлнэ.
   *
   * Хүрээ (bbox) нь GeoServer-ийн мозайкийн индексээс уншигддаг тул зарим
   * зурагт хоосон байж болно (жишээ: refresh бүтэлгүйтсэн). Тэр үед эхлээд
   * GeoServer-ийг шинэчилж хүрээг олж авах гэж оролдоно.
   */
  function focusOnImage(img: DroneImage) {
    const bounds = imageBounds(img);
    if (bounds) {
      // Шинэ массив тул ижил зураг дээр дахин дарахад ч газрын зураг нүүнэ.
      setFocus(bounds);
      return;
    }
    if (refreshMutation.isPending) return;
    focusAfterRefresh.current = img.id;
    refreshMutation.mutate();
  }

  function toggleVisible(img: DroneImage) {
    const willShow = !visibleIds.has(img.id);
    setVisibleIds((prev) => {
      const next = new Set(prev);
      if (willShow) next.add(img.id);
      else next.delete(img.id);
      return next;
    });
    // "Харах" дарахад ҮРГЭЛЖ тухайн зураг рүү шилжинэ ("Нуух" үед шилжихгүй).
    if (willShow) focusOnImage(img);
  }

  const uploading = uploadMutation.isPending;

  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row-reverse">
        {/* Дроны зургийн жагсаалт — газрын зургийн хажууд */}
        <div className="w-full shrink-0 lg:w-72">
          <div className="ap-card overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-[#37394d]">
              <div className="flex min-w-0 items-center gap-2">
                <Plane className="h-4 w-4 shrink-0 text-[#02c0ce]" />
                <p className="truncate text-[12px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Дроны зураг
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                {list.length}
              </span>
            </div>

            {canEdit && (
              <div className="border-b border-slate-100 p-3 dark:border-[#37394d]">
                <input
                  ref={fileInput}
                  type="file"
                  accept=".tif,.tiff,image/tiff"
                  className="hidden"
                  onChange={onFileChosen}
                />
                <button
                  type="button"
                  onClick={pickFile}
                  disabled={uploading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#02c0ce] px-3 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#02a3af] disabled:opacity-60"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploading ? "Байршуулж байна…" : ".tif зураг оруулах"}
                </button>

                {uploading && progress != null && (
                  <div className="mt-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-[#37394d]">
                      <div
                        className="h-full rounded-full bg-[#02c0ce] transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="mt-1 text-center text-[11px] text-slate-400 dark:text-slate-500">
                      {progress}%
                    </p>
                  </div>
                )}

                <p className="mt-2 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                  Нэг файлыг нэг удаад, дээд тал нь {MAX_DRONE_SIZE_LABEL}.
                  Олон зургийг дараалан оруулна.
                </p>

                <button
                  type="button"
                  onClick={() => refreshMutation.mutate()}
                  disabled={refreshMutation.isPending || uploading}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 transition-colors hover:border-slate-300 disabled:opacity-60 dark:border-[#37394d] dark:bg-[#1e1f27] dark:text-slate-300"
                >
                  {refreshMutation.isPending
                    ? "Шинэчилж байна…"
                    : "GeoServer шинэчлэх"}
                </button>
              </div>
            )}

            <div className="max-h-[520px] overflow-y-auto">
              {isLoading ? (
                <div className="space-y-2 p-3">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-[#252630]"
                    />
                  ))}
                </div>
              ) : !list.length ? (
                <p className="px-4 py-8 text-center text-[12px] text-slate-400 dark:text-slate-500">
                  Дроны зураг байршуулаагүй
                </p>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-[#37394d]">
                  {list.map((img) => {
                    const shown = visibleIds.has(img.id);
                    return (
                      <div key={img.id} className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p
                              title={img.original_name}
                              className="truncate text-[12px] font-medium text-slate-700 dark:text-slate-200"
                            >
                              {img.original_name}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                              {formatSize(img.size_bytes)} ·{" "}
                              {formatDate(img.uploaded_at)}
                            </p>
                            {!img.published && (
                              <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                GeoServer-т бүртгэгдээгүй
                              </p>
                            )}
                          </div>
                          {canEdit && (
                            <button
                              title="Устгах"
                              onClick={() =>
                                setPendingConfirm({
                                  title: "Дроны зургийг устгах уу?",
                                  description: `"${img.original_name}" файл болон GeoServer-ийн давхаргаас устна.`,
                                  confirmLabel: "Устгах",
                                  confirmColor: "#f1556c",
                                  onConfirm: () => deleteMutation.mutate(img.id),
                                })
                              }
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-400 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        <div className="mt-2 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleVisible(img)}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                              shown
                                ? "bg-[#02c0ce] text-white hover:bg-[#02a3af]"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-[#37394d] dark:text-slate-300 dark:hover:bg-[#444]"
                            }`}
                          >
                            {shown ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                            {shown ? "Нуух" : "Харах"}
                          </button>
                          {/* Харагдаж байгаа үед дахин тухайн зураг дээр нь буцаж очих */}
                          <button
                            type="button"
                            title="Зураг дээр очих"
                            disabled={refreshMutation.isPending}
                            onClick={() => focusOnImage(img)}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-50 dark:bg-[#37394d] dark:text-slate-400 dark:hover:bg-[#444]"
                          >
                            <Crosshair className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Газрын зураг */}
        <div className="ap-card min-w-0 flex-1 p-5">
          <AcquisitionMap
            acquisitionId={id}
            aus={aus}
            droneOverlays={overlays}
            droneFocus={focus}
          />
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingConfirm}
        title={pendingConfirm?.title ?? ""}
        description={pendingConfirm?.description}
        confirmLabel={pendingConfirm?.confirmLabel}
        confirmColor={pendingConfirm?.confirmColor}
        onConfirm={() => pendingConfirm?.onConfirm()}
        onClose={() => setPendingConfirm(null)}
      />
    </>
  );
}
