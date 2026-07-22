const ONES = ["", "нэг", "хоёр", "гурав", "дөрөв", "тав", "зургаа", "долоо", "найм", "ес"];
const TENS_STANDALONE = ["", "арав", "хорь", "гуч", "дөч", "тавь", "жар", "дал", "ная", "ер"];
const TENS_LINKED = ["", "арван", "хорин", "гучин", "дөчин", "тавин", "жаран", "далан", "наян", "ерэн"];

const SCALES = [
  { value: 1_000_000_000_000, standalone: "их наяд", linked: "их наяд" },
  { value: 1_000_000_000, standalone: "тэрбум", linked: "тэрбум" },
  { value: 1_000_000, standalone: "сая", linked: "сая" },
  { value: 1_000, standalone: "мянга", linked: "мянган" },
  { value: 1, standalone: "", linked: "" },
];

// 0-999 хүртэлх тоог үгээр — outerHasTrailing нь энэ гурван оронтой бүлгийн ард
// өөр үг (жишээ нь мянга/сая гэсэн үлгэр үг, эсвэл доод бүлэг) орох эсэхийг илэрхийлнэ;
// энэ нь "зуу/зуун", "тавь/тавин" зэрэг холбох хэлбэрийг сонгоход шаардлагатай.
function threeDigitWords(n: number, outerHasTrailing: boolean): string {
  if (n === 0) return "";
  const hundreds = Math.floor(n / 100);
  const rem = n % 100;
  const tens = Math.floor(rem / 10);
  const ones = rem % 10;
  const parts: string[] = [];

  if (hundreds > 0) {
    const hundredHasTrailing = rem > 0 || outerHasTrailing;
    parts.push(ONES[hundreds], hundredHasTrailing ? "зуун" : "зуу");
  }
  if (tens > 0) {
    const tenHasTrailing = ones > 0 || outerHasTrailing;
    parts.push((tenHasTrailing ? TENS_LINKED : TENS_STANDALONE)[tens]);
  }
  if (ones > 0) {
    parts.push(ONES[ones]);
  }
  return parts.join(" ");
}

// Тоог монгол хэлний үгээр бичнэ (жишээ: 123456789 → "нэг зуун хорин гурван сая...").
// Мөнгөн дүнг гэрээ/актад бичихэд ашиглана; бүхэл тоо руу дугуйруулна.
export function numberToMongolianWords(input: number): string {
  const n = Math.round(input);
  if (n === 0) return "тэг";
  const abs = Math.abs(n);

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
    const chunkWords = threeDigitWords(value, hasLowerNonZero || scale.value > 1);
    words.push(chunkWords);
    if (scale.value > 1) words.push(hasLowerNonZero ? scale.linked : scale.standalone);
  }

  return (n < 0 ? "хасах " : "") + words.join(" ");
}

export function amountToMongolianWords(amount: number, unit = "төгрөг"): string {
  const words = numberToMongolianWords(amount);
  return unit ? `${words} ${unit}` : words;
}
