// Олон элементийг НЭГ НЭГЭЭР, хүсэлт хооронд зайлуулж боловсруулах гогцоо.
//
// Яагаад: гадаад/дундын сервис (жишээ нь ГУС-ийн /parcel/info/:parcel) руу зэрэг
// олон хүсэлт явуулбал сервис дүүрч, хэсэг хүсэлт унана. Тиймээс дараалуулж,
// хооронд delay тавина. Нэг элемент унасан ч БУСДЫГ үргэлжлүүлж, бүтэлгүйтлийг
// төгсгөлд нэгтгэж буцаана.
//
// UI-аас салангид (React-гүй) — прогресс нь callback-аар, delay нь sleep-ээр
// орж ирдэг тул тестэд хуурамч sleep-ээр шалгагдана.

export type SequentialFailure<T> = { item: T; message: string };

export type SequentialOutcome<T> = {
  total: number;
  ok: number;
  failed: SequentialFailure<T>[];
  /** Гаднаас зогсоох хүсэлт ирж, гогцоо дуусахаасаа өмнө тасалдсан эсэх */
  stopped: boolean;
};

export type SequentialProgress<T> = {
  /** Боловсруулж дууссан элементийн тоо (1-ээс эхэлнэ) */
  done: number;
  total: number;
  item: T;
  ok: number;
  failed: SequentialFailure<T>[];
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runSequentialWithDelay<T>(
  items: readonly T[],
  task: (item: T, index: number) => Promise<unknown>,
  options: {
    /** Хүсэлт ХООРОНД хүлээх хугацаа. Сүүлийн хүсэлтийн дараа хүлээхгүй. */
    delayMs: number;
    /** Гогцоо элемент бүрийн ӨМНӨ дуудаж, true бол тэр даруй тасална. */
    shouldStop?: () => boolean;
    /** Хүсэлт явуулахын өмнө — "одоо аль элемент дээр байна"-г үзүүлэхэд. */
    onStart?: (item: T, index: number) => void;
    /** Элемент бүр (амжилттай ч, унасан ч) дуусахад. */
    onSettled?: (progress: SequentialProgress<T>) => void;
    /** Алдааг хүн уншихаар текст болгох. */
    toMessage?: (error: unknown) => string;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<SequentialOutcome<T>> {
  const { delayMs, shouldStop, onStart, onSettled, sleep = defaultSleep } = options;
  const toMessage = options.toMessage ?? ((error: unknown) => (error instanceof Error ? error.message : String(error)));

  const total = items.length;
  const failed: SequentialFailure<T>[] = [];
  let ok = 0;

  for (let index = 0; index < total; index += 1) {
    if (shouldStop?.()) {
      return { total, ok, failed, stopped: true };
    }

    const item = items[index];
    onStart?.(item, index);
    try {
      await task(item, index);
      ok += 1;
    } catch (error) {
      failed.push({ item, message: toMessage(error) });
    }
    onSettled?.({ done: index + 1, total, item, ok, failed: [...failed] });

    // Зөвхөн ХООРОНД зайлуулна: сүүлийн элементийн дараа, мөн зогсох хүсэлт
    // ирсэн үед хүлээх нь хэрэглэгчийг дэмий хүлээлгэнэ.
    const isLast = index === total - 1;
    if (!isLast && delayMs > 0 && !shouldStop?.()) {
      await sleep(delayMs);
    }
  }

  return { total, ok, failed, stopped: false };
}
