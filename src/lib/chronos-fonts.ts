/**
 * «Он цагийн зураг»-ын фонтууд. @font-face болон классууд нь src/app/fonts.css-д
 * (root layout-аас импортлогдоно), файлууд public/fonts/-д байна. Браузер зөвхөн
 * тухайн фонтыг ашигласан үед (Он цагийн зураг нээгдэхэд) файлыг татна.
 *
 * Өмнө нь next/font/google байсан — dev compile бүрт Google руу сүлжээгээр хандаж
 * гацдаг байсан тул self-hosted болгов (дэлгэрэнгүйг fonts.css-ийн толгойд).
 */
// Unbounded нь variable font (200–900) — Google-ийн static subset зарим хөтөчид OTS-д унадаг.
export const chronosDisplay = { className: "font-chronos-display" } as const;
export const chronosBody = { className: "font-chronos-body" } as const;
export const chronosMono = { className: "font-chronos-mono" } as const;
