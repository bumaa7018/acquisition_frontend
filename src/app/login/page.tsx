"use client";
import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, Briefcase, Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { authApi } from "@/lib/api";
import { authStorage } from "@/lib/auth";
import { clearPageTabs } from "@/lib/page-tabs";
import { startBoot, getBooting, subscribe } from "@/lib/blocking-loader-state";
import { FullPageLoader } from "@/lib/blocking-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Нэвтрэх талбар нь имэйл байх ШААРДЛАГАГҮЙ: backend нь нэвтрэх нэр эсвэл
// имэйл хоёуланг нь хүлээж авдаг тул "user0101010" гэх мэт энгийн нэр ч
// хүчинтэй. Өмнө нь энд .email() шалгалт байсан нь имэйл биш нэртэй
// хэрэглэгчдийг маягт дээрээ саатуулж байв.
const schema = z.object({
  login: z.string().min(1, "Нэвтрэх нэр оруулна уу"),
  password: z.string().min(4, "Нууц үг хэт богино"),
});
type FormData = z.infer<typeof schema>;

// Нэвтрэх хоёр урсгал. Бүртгэл нь ӨӨР ӨӨР санд байрладаг тул backend дээр ч
// эндпойнт нь тусдаа: дотоод хэрэглэгч authdb-ээс, мэргэжлийн байгууллага
// appdb-ээс шалгагдана. Иймд хэрэглэгч аль талынхаа ялгааг ЭНД сонгоно —
// автоматаар таах гэж оролдвол нэг сангийн нэр нөгөөгийнхийг халхлах эрсдэлтэй.
const TABS = [
  {
    key: "internal" as const,
    label: "Дотоод хэрэглэгч",
    icon: Building2,
    description: "Байгууллагын ажилтан, админ",
    loginLabel: "Нэвтрэх нэр эсвэл имэйл",
    placeholder: "admin эсвэл admin@example.com",
  },
  {
    key: "prof" as const,
    label: "Мэргэжлийн байгууллага",
    icon: Briefcase,
    description: "Үнэлгээний байгууллагын ажилтан",
    loginLabel: "Нэвтрэх нэр",
    placeholder: "Байгууллагаас олгосон нэр",
  },
];

type TabKey = (typeof TABS)[number]["key"];

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  // Амжилттай нэвтэрсний дараа самбар ачаалагдтал бүтэн дэлгэцийн loader —
  // самбарын layout мөн адил loader-ыг эхний уншилт дуустал үргэлжлүүлнэ.
  const booting = useSyncExternalStore(subscribe, getBooting, () => false);
  const [tab, setTab] = useState<TabKey>("internal");
  const activeIndex = Math.max(
    0,
    TABS.findIndex((t) => t.key === tab),
  );
  const active = TABS[activeIndex];
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  // Таб солиход маягтыг цэвэрлэнэ: нэг талын нэр/нууц үг нөгөө тал руу
  // санамсаргүй илгээгдэж, ойлгомжгүй "буруу нэр" алдаа гаргахаас сэргийлнэ.
  const switchTab = (key: TabKey) => {
    if (key === tab) return;
    setTab(key);
    reset();
    setShowPassword(false);
  };

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res =
        tab === "prof"
          ? await authApi.loginProf(data.login, data.password)
          : await authApi.login(data.login, data.password);
      // Шинэ нэвтрэлт бүр цэвэр табаар эхэлнэ.
      clearPageTabs();
      authStorage.setTokens(res.access_token, res.refresh_token);
      // Cookie тохирсоныг навигацаас ӨМНӨ баталгаажуулна — эхний map/файл
      // хүсэлт cookie-гүй явж 401 болох race-аас сэргийлнэ.
      await authStorage.startSession(res.access_token);
      const me = await authApi.me();
      authStorage.setUser(me);
      toast.success("Амжилттай нэвтэрлээ");
      // loading-ийг буцааж унтраахгүй — хуудас солигдтол товч идэвхгүй үлдэнэ.
      startBoot();
      router.push("/");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })
        ?.response?.data?.error;
      toast.error(msg ?? "Нэвтрэх үед алдаа гарлаа");
      setLoading(false);
    }
  };

  return (
    <>
      {booting && <FullPageLoader />}
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="login-enter flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg">
              <Building2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white">
                Газрын Мэдээллийн Систем
              </h1>
              <p className="text-slate-400 mt-1">Удирдлагын самбарт нэвтрэх</p>
            </div>
          </div>

          <Card className="login-enter login-enter-delay border-slate-700 bg-slate-800/50 backdrop-blur shadow-2xl">
            <CardHeader className="space-y-4">
              {/* Таб — role="tablist" нь дэлгэц уншигчид хоёр сонголт болохыг
                хэлнэ. Гар (сумтай товчлуур) шаардлагагүй: зөвхөн хоёр товч. */}
              <div
                role="tablist"
                aria-label="Нэвтрэх төрөл"
                className="relative grid grid-cols-2 gap-1 rounded-lg bg-slate-900/60 p-1"
              >
                {/* Идэвхтэй табын ард гулсдаг тэмдэглэгээ. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-1 left-1 rounded-md bg-primary shadow transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
                  style={{
                    width: "calc((100% - 0.5rem - 0.25rem) / 2)",
                    transform: `translateX(calc(${activeIndex} * (100% + 0.25rem)))`,
                  }}
                />
                {TABS.map((t) => {
                  const Icon = t.icon;
                  const selected = t.key === tab;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => switchTab(t.key)}
                      disabled={loading}
                      className={cn(
                        "relative z-10 flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-300",
                        selected
                          ? "text-primary-foreground"
                          : "text-slate-400 hover:text-slate-200",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>
              <div key={tab} className="login-tab-content">
                <CardTitle className="text-white">{active.label}</CardTitle>
                <CardDescription className="text-slate-400">
                  {active.description}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Хүсэлт явж байхад талбар, таб өөрчлөгдөхгүй. */}
                <fieldset
                  key={tab}
                  disabled={loading}
                  className="login-tab-content space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="login" className="text-slate-300">
                      {active.loginLabel}
                    </Label>
                    <Input
                      id="login"
                      type="text"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="username"
                      placeholder={active.placeholder}
                      className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                      {...register("login")}
                    />
                    {errors.login && (
                      <p className="text-xs text-red-400">
                        {errors.login.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-slate-300">
                      Нууц үг
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="bg-slate-700 border-slate-600 pr-10 text-white placeholder:text-slate-500"
                        {...register("password")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={
                          showPassword ? "Нууц үгийг нуух" : "Нууц үгийг харуулах"
                        }
                        title={showPassword ? "Нуух" : "Харуулах"}
                        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:text-white"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-xs text-red-400">
                        {errors.password.message}
                      </p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {loading ? "Нэвтэрч байна..." : "Нэвтрэх"}
                  </Button>
                </fieldset>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
