"use client";
import { useQuery } from "@tanstack/react-query";
import { authApi, landApi } from "@/lib/api";

// Нэвтэрсэн хэрэглэгчийн ХЭЛТЭСТ холбогдсон ерөнхий ангилал.
//
// Ерөнхий ангилал бүр «хариуцсан алба»-тай (acquisition_category.department_id,
// Тохиргоо → Чөлөөлөлтийн ангилал). Хэрэглэгчийн хэлтэс (/users/me →
// employee.department_id) аль нэг ерөнхий ангилалд холбогдсон бол хяналтын
// самбар ба чөлөөлөлтийн жагсаалт тэр ангиллаар АНХДАГЧААР шүүгдэнэ.
//
// `ready` — хоёр хүсэлт дууссан (амжилтгүй ч) эсэх. Анхдагч шүүлт тодорхой
// болохоос өмнө өгөгдөл татвал эхлээд шүүлтгүй, дараа нь шүүлттэй гэж ХОЁР
// удаа дуудагдаж анивчина — дуудагч `ready` хүртэл хүлээнэ.
// Хэлтэсгүй / холбогдсон ангилалгүй бол categoryId = 0.
export function useDepartmentGeneralCategory(enabled = true) {
  const me = useQuery({
    queryKey: ["users-me"],
    queryFn: () => authApi.me(),
    staleTime: Infinity,
    enabled,
  });
  const categories = useQuery({
    queryKey: ["acquisition-categories"],
    queryFn: () => landApi.listCategories(),
    staleTime: Infinity,
    enabled,
  });

  const settled = (q: { isSuccess: boolean; isError: boolean }) => q.isSuccess || q.isError;
  const ready = !enabled || (settled(me) && settled(categories));

  const departmentId = me.data?.employee?.department_id;
  const category = departmentId
    ? (categories.data ?? [])
        .filter((c) => c.parent_id == null && c.department_id != null)
        .sort((a, b) => a.sort_order - b.sort_order)
        .find((c) => String(c.department_id) === String(departmentId))
    : undefined;

  return { categoryId: category?.id ?? 0, ready };
}
