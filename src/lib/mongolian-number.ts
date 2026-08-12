// Тоог монгол хэлний үгээр бичих (гэрээ, акт, захирамжийн төсөлд "2,561 (хоёр мянга
// таван зуун жаран нэг)" гэж бичихэд хэрэглэнэ).
//
// Монгол хэлний тооны нэр хоёр хэлбэртэй:
//   - БИЕ ДААСАН (standalone): гурав, арав, хорь, зуу, мянга — тоо ТЭНД дуусах үед
//   - ХОЛБООСНЫ (linked): гурван, арван, хорин, зуун, мянган — ард нь өөр үг үргэлжлэх үед
// Тиймээс 561 = "таван зуун жаран нэг", харин 500 = "таван зуу".
// Зэрэглэлийн үгийн (мянга/сая) дараа ӨӨР ТОО үргэлжлэх бол бие даасан хэлбэр
// хэвээр байна: 2561 = "хоёр мянга таван зуун жаран нэг". Харин ард нь НЭР үг орвол
// холбоосны хэлбэрт орно: 5,000 төгрөг = "таван мянган төгрөг".

const ONES_STANDALONE = ["", "нэг", "хоёр", "гурав", "дөрөв", "тав", "зургаа", "долоо", "найм", "ес"];
const ONES_LINKED = ["", "нэг", "хоёр", "гурван", "дөрвөн", "таван", "зургаан", "долоон", "найман", "есөн"];
const TENS_STANDALONE = ["", "арав", "хорь", "гуч", "дөч", "тавь", "жар", "дал", "ная", "ер"];
const TENS_LINKED = ["", "арван", "хорин", "гучин", "дөчин", "тавин", "жаран", "далан", "наян", "ерэн"];

const SCALES = [
  { value: 1_000_000_000_000, standalone: "их наяд", linked: "их наяд" },
  { value: 1_000_000_000, standalone: "тэрбум", linked: "тэрбум" },
  { value: 1_000_000, standalone: "сая", linked: "сая" },
  { value: 1_000, standalone: "мянга", linked: "мянган" },
  { value: 1, standalone: "", linked: "" },
];

const MAX_SUPPORTED = 1_000 * SCALES[0].value;

// 0-999 хүртэлх тоог үгээр — hasTrailing нь энэ бүлгийн ард өөр үг (зэрэглэлийн үг,
// доод бүлгийн тоо, эсвэл "төгрөг" гэх мэт нэр) орох эсэхийг илэрхийлнэ; холбоосны
// хэлбэрийг сонгоход шаардлагатай.
function threeDigitWords(n: number, hasTrailing: boolean): string {
  if (n === 0) return "";
  const hundreds = Math.floor(n / 100);
  const rem = n % 100;
  const tens = Math.floor(rem / 10);
  const ones = rem % 10;
  const parts: string[] = [];

  if (hundreds > 0) {
    // "зуу(н)" нь өмнөх тоог үргэлж холбоосны хэлбэрт оруулна: таван зуу, есөн зуун.
    parts.push(ONES_LINKED[hundreds], rem > 0 || hasTrailing ? "зуун" : "зуу");
  }
  if (tens > 0) {
    parts.push((ones > 0 || hasTrailing ? TENS_LINKED : TENS_STANDALONE)[tens]);
  }
  if (ones > 0) {
    parts.push((hasTrailing ? ONES_LINKED : ONES_STANDALONE)[ones]);
  }
  return parts.join(" ");
}

// linked: true — ард нь нэр үг (жишээ "төгрөг") орох тул холбоосны хэлбэрээр төгсгөнө.
// Бүхэл тоо руу дугуйруулна.
export function numberToMongolianWords(input: number, options: { linked?: boolean } = {}): string {
  const numeric = Number(input);
  if (!Number.isFinite(numeric)) return "тэг";
  const n = Math.round(numeric);
  if (n === 0) return "тэг";

  const abs = Math.abs(n);
  // Их наядаас дээш тоог үгээр бичих зэрэглэлийн үг байхгүй — тоогоор буцаана.
  if (abs >= MAX_SUPPORTED) return String(abs);

  const chunks = SCALES.map((scale) => ({ scale, value: 0 }));
  let remaining = abs;
  for (const chunk of chunks) {
    chunk.value = Math.floor(remaining / chunk.scale.value);
    remaining %= chunk.scale.value;
  }

  const words: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const { scale, value } = chunks[i];
    if (value === 0) continue;
    const hasLowerNonZero = chunks.slice(i + 1).some((c) => c.value > 0);
    const isScaled = scale.value > 1;
    // Бүлгийн ард зэрэглэлийн үг, эсвэл доод бүлэг, эсвэл нэр үг орох эсэх.
    words.push(threeDigitWords(value, isScaled || hasLowerNonZero || !!options.linked));
    // Зэрэглэлийн үг: дараа нь тоо орвол бие даасан ("мянга"), зөвхөн нэр үг орвол
    // холбоосны ("мянган") хэлбэрээр.
    if (isScaled) words.push(!hasLowerNonZero && options.linked ? scale.linked : scale.standalone);
  }

  return (n < 0 ? "хасах " : "") + words.filter(Boolean).join(" ");
}

export function amountToMongolianWords(amount: number, unit = "төгрөг"): string {
  const words = numberToMongolianWords(amount, { linked: !!unit });
  return unit ? `${words} ${unit}` : words;
}
