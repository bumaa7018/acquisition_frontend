import { IBM_Plex_Mono, IBM_Plex_Sans, Unbounded } from "next/font/google";

/**
 * «Он цагийн зураг»-ын фонтууд. Root layout-аас (статик) импортлогдоно — газрын зургийн
 * динамик chunk дотор next/font зарлавал Next 14 тусдаа CSS chunk үүсгэж,
 * «Loading CSS chunk failed» алдаа гардаг. preload: false — зөвхөн Он цагийн зураг
 * нээгдэхэд файл татагдана.
 */
// Unbounded нь variable font — тогтмол жин (700) сонговол Google-ийн static subset зарим хөтөчид OTS-д унадаг.
export const chronosDisplay = Unbounded({ subsets: ["latin", "cyrillic"], display: "swap", preload: false });
export const chronosBody = IBM_Plex_Sans({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600"], display: "swap", preload: false });
export const chronosMono = IBM_Plex_Mono({ subsets: ["latin", "cyrillic"], weight: ["400", "600"], display: "swap", preload: false });
