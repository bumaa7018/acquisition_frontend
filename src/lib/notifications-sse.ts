import { authStorage } from "./auth";
import type { AppNotification } from "@/types";

// Мэдэгдлийн бодит цагийн стрийм — fetch-суурьтай SSE клиент.
//
// EventSource биш fetch ашигласан шалтгаан: EventSource Authorization header
// дамжуулж чаддаггүй тул token-ийг query string-д хийхэд хүрдэг — энэ нь
// сервер/прокси логт нууц үлдээдэг. Fetch стриймээр header-тэй холбогдож
// аюулгүй байдлын стандартыг хангана.
//
// Найдвартай байдал:
//  - Тасарвал экспоненциал хүлээлттэй автоматаар дахин холбогдоно
//  - Холболт (дахин) тогтох бүрд onConnect дуудагдана — тасалдлын цонхонд
//    алдагдсан мэдэгдлүүдийг жагсаалт refetch-ээр нөхөж авна (catch-up)
//  - Таб идэвхжих / сүлжээ сэргэхэд хүлээлгүй шууд дахин холбогдоно

const STREAM_URL = "/api/v1/notifications/stream";
const RETRY_MIN_MS = 2_000;
const RETRY_MAX_MS = 30_000;

export type NotificationStreamHandlers = {
  onNotification: (n: AppNotification) => void;
  /** Стрийм (дахин) холбогдох бүрд — алдагдсан мэдэгдлийг нөхөх refetch хийх цэг */
  onConnect?: () => void;
};

export function subscribeNotifications(
  handlers: NotificationStreamHandlers,
): () => void {
  let stopped = false;
  let connecting = false;
  let retryMs = RETRY_MIN_MS;
  let controller: AbortController | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  async function connect() {
    if (stopped || connecting) return;
    connecting = true;
    const token = authStorage.getAccessToken();
    if (!token) {
      connecting = false;
      scheduleRetry();
      return;
    }
    controller = new AbortController();
    try {
      const res = await fetch(STREAM_URL, {
        headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok || !res.body) {
        // 401 → token хуучирсан байж болно: бусад axios дуудлага refresh
        // хийсний дараа дараагийн оролдлого шинэ token-той холбогдоно.
        connecting = false;
        scheduleRetry();
        return;
      }

      retryMs = RETRY_MIN_MS; // амжилттай холболт — хүлээлтийг тэглэнэ
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE фрэймүүд хоосон мөрөөр тусгаарлагдана
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          handleFrame(frame);
        }
      }
    } catch {
      // abort эсвэл сүлжээний алдаа — доор дахин холбогдоно
    }
    connecting = false;
    scheduleRetry();
  }

  function handleFrame(frame: string) {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      // ":"-ээр эхэлсэн мөр — heartbeat comment, алгасна
    }
    if (event === "ready") {
      // Холболт тогтлоо — тасалдлын үед алдагдсаныг нөхөх боломж олгоно
      handlers.onConnect?.();
      return;
    }
    if (event !== "notification" || dataLines.length === 0) return;
    try {
      handlers.onNotification(JSON.parse(dataLines.join("\n")) as AppNotification);
    } catch {
      // эвдэрсэн фрэймийг алгасна
    }
  }

  function scheduleRetry() {
    if (stopped) return;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, retryMs);
    retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
  }

  // Таб идэвхжих / сүлжээ сэргэх үед удаан backoff хүлээлгүй шууд холбогдоно
  const reconnectNow = () => {
    if (stopped || connecting) return;
    if (retryTimer) clearTimeout(retryTimer);
    retryMs = RETRY_MIN_MS;
    connect();
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") reconnectNow();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", reconnectNow);

  connect();

  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("online", reconnectNow);
    if (retryTimer) clearTimeout(retryTimer);
    controller?.abort();
  };
}

// Мэдэгдэл дээр дарахад очих зам — resource_type-аас тогтооно.
// (parcel хуудас acq query param шаарддаг тул acquisition_id-г хамт дамжуулна)
export function notificationLink(n: AppNotification): string | null {
  switch (n.resource_type) {
    case "acquisition":
      return `/acquisition/${n.resource_id}`;
    case "parcel":
      return n.acquisition_id
        ? `/parcel/${n.resource_id}?acq=${n.acquisition_id}`
        : null;
    case "compensation":
      return `/compensation/${n.resource_id}`;
    default:
      return n.acquisition_id ? `/acquisition/${n.acquisition_id}` : null;
  }
}
