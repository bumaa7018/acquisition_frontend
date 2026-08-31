/**
 * Чөлөөлөлтийн ЯВЦЫН хувь — нэрийн ӨМНӨ тавигдах жижиг шошго.
 *
 * Тоог backend бодно (`progress_percent`): эцсийн төлөвт (Нөлөөлөгдсөн гарсан /
 * Татгалзсан / Чөлөөлсөн) шилжсэн нэгж талбарын эзлэх хувь. Чөлөөлөлт
 * "Баталгаажсан" болох нөхцөл нь БҮХ талбар эцсийн төлөвт байх явдал тул 100%
 * нь "бэлэн" гэсэн үг.
 *
 * Дашбоард болон чөлөөлөлтийн жагсаалт ХОЁУЛАА үүнийг ашиглана — хоёр газарт
 * өөр өөр тоо/загвар гарахаас сэргийлнэ.
 */
export function ProgressBadge({
  percent,
  parcelCount,
  finalCount,
  className = "",
}: {
  percent?: number | null;
  /** Тайлбар (title)-д харуулах нийт талбар */
  parcelCount?: number;
  /** Тайлбарт харуулах эцсийн төлөвт шилжсэн талбар */
  finalCount?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percent ?? 0)));
  // Өнгө нь явцын үе шаттай уялдана: эхэлсэн/дунд/дуусах шатанд.
  const color = pct >= 100 ? "#0acf97" : pct >= 50 ? "#02c0ce" : pct > 0 ? "#f9bc0b" : "#94a3b8";
  const title =
    parcelCount != null
      ? `Явц: ${finalCount ?? 0}/${parcelCount} нэгж талбар эцсийн төлөвт (${pct}%)`
      : `Явц: ${pct}%`;

  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${className}`}
      style={{ color, background: `${color}1f` }}
    >
      {pct}%
    </span>
  );
}
