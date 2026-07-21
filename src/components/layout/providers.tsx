"use client";
import { QueryCache, QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { useState } from "react";
import { logger } from "@/lib/logger";

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
            // Сервер алдаа (5xx), холболтгүй/timeout, эрхийн алдаа (401/403) үед
            // дахин оролдохгүй — interceptor алдааны хуудас руу шилжүүлнэ.
            retry: (failureCount, error) => {
              const status = (error as { response?: { status?: number } })?.response?.status;
              if (!status || status >= 500 || status === 401 || status === 403) return false;
              return failureCount < 1;
            },
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
