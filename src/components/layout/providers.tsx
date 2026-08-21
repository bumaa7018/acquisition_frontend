"use client";
import { QueryCache, QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";
import { authStorage } from "@/lib/auth";

// axios interceptor нь HTTP хүсэлт бүрийг логлодог, гэхдээ query/mutation-ий
// `onError` бичээгүй компонент query-г interceptor-ийн лог дараа юу болсныг
// (аль query/mutation амжилтгүй болсныг) харуулахгүй. Эндхийн global cache-ийн
// onError нь component бүр өөрөө onError бичсэн эсэхээс үл хамааран query/mutation
// бүрийн алдааг барьж, "логгүй үйлдэл байхгүй" гэдгийг баталгаажуулна.
//
// MutationCache-ийн onError-ийн 2 дахь аргумент нь variables — өөрөөр хэлбэл
// хэрэглэгчийн илгээсэн жинхэнэ form өгөгдөл (нууц үг г.м. агуулж болзошгүй).
// Тиймээс энд ЗӨВХӨН mutationKey-г л ашиглана, variables-г хэзээ ч логлохгүй.
function logQueryError(error: unknown, query: { queryKey?: unknown }) {
  const status = (error as { response?: { status?: number } })?.response?.status;
  logger.error("query failed", { key: query.queryKey, status });
}

function logMutationError(
  error: unknown,
  _variables: unknown,
  _context: unknown,
  mutation: { options: { mutationKey?: unknown } },
) {
  const status = (error as { response?: { status?: number } })?.response?.status;
  logger.error("mutation failed", { key: mutation.options?.mutationKey, status });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: logQueryError }),
        mutationCache: new MutationCache({ onError: logMutationError }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Алдаа гарахад хэрэглэгчийг алдааны хуудас руу ШИДЭХЭЭ больсон тул
            // (lib/api.ts — зөвхөн toast) түр зуурын алдаа өөрөө сэргэх ёстой:
            //   - 401/403: эрхийн алдаа, дахин оролдох нь дэмий
            //   - бусад 4xx: нэг удаа
            //   - 5xx / холболтгүй / timeout: түр зуурын байж болох тул 2 хүртэл
            retry: (failureCount, error) => {
              const status = (error as { response?: { status?: number } })?.response?.status;
              if (status === 401 || status === 403) return false;
              if (typeof status === "number" && status < 500) return failureCount < 1;
              return failureCount < 2;
            },
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  // Session cookie-г апп ачаалах бүрд синк хийнэ. ЯАГААД ЗААВАЛ: `/api/files`
  // болон `/api/geoserver` proxy нь httpOnly `gov_sess` cookie-гоор эрх шалгадаг
  // (`<img>`/`<a>`/OpenLayers WMS-POST/XYZ tile нь Authorization header зөөж
  // чадахгүй тул). Аль хэдийн нэвтэрсэн (localStorage-д токентой ч cookie-гүй)
  // хэрэглэгч дахин login хийхгүйгээр map/файл ажиллуулахын тулд энд синк хийнэ.
  // Токен байхгүй бол юу ч хийхгүй.
  useEffect(() => {
    const token = authStorage.getAccessToken();
    if (token) void authStorage.startSession(token);
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster richColors position="top-right" closeButton />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
