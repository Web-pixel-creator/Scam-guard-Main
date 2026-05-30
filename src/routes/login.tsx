import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, ArrowLeft, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Вход — Ishonch Guard" }] }),
  component: LoginPage,
});

const FIELD_CLS =
  "rounded-[4px] border-[#E2E0D8] bg-white text-[#18181B] placeholder:text-[#A1A1AA] focus-visible:border-[#0B0B0F]/40 focus-visible:ring-[3px] focus-visible:ring-[#0B0B0F]/6 shadow-none";

function LoginPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (user) nav({ to: "/admin" }); }, [user, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null); setMsg(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/admin" },
        });
        if (error) throw error;
        setMsg("Аккаунт создан. Если включено подтверждение email — проверьте почту.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav({ to: "/admin" });
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-[520px] mx-auto px-4 sm:px-6 py-16">
      <div className="apex-frame apex-stripes border border-[#E2E0D8] rounded-[6px] bg-white/65 p-7 sm:p-10">
        <div className="flex items-start justify-between gap-4 mb-6">
          <span className="apex-mono">SYS · AUTH</span>
          <span className="apex-status" data-state={loading ? "loading" : "idle"}>
            <span className="apex-status-dot" />
            {loading ? "VERIFYING" : "SECURE"}
          </span>
        </div>

        <div className="flex items-center gap-2.5 mb-8">
          <span className="grid h-7 w-7 place-items-center rounded-[4px] bg-[#0B0B0F] text-white">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} />
          </span>
          <span className="font-display text-[15px] font-extrabold tracking-tight text-[#18181B]">Ishonch Guard</span>
        </div>

        <p className="label-md mb-3">{mode === "signin" ? "00 — Вход" : "00 — Регистрация"}</p>
        <h1 className="font-sans font-medium text-[28px] md:text-[34px] tracking-[-0.04em] leading-[1.1] text-[#18181B] mb-3">
          {mode === "signin"
            ? <>Вход в <span className="font-serif-italic text-[#8B8B92]">админку</span></>
            : <>Регистрация <span className="font-serif-italic text-[#8B8B92]">админа</span></>}
        </h1>
        <p className="text-[14px] text-[#52525B] leading-[1.6] mb-8">
          Первый зарегистрированный пользователь становится администратором.
        </p>

        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="apex-mono text-[#52525B]">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={FIELD_CLS} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="apex-mono text-[#52525B]">Пароль</Label>
            <Input id="password" type="password" required minLength={6}
              value={password} onChange={(e) => setPassword(e.target.value)} className={FIELD_CLS} />
          </div>

          {err && <p className="apex-mono text-[#DC2626]" role="alert">! {err}</p>}
          {msg && <p className="apex-mono text-emerald-700">✓ {msg}</p>}

          <button type="submit" disabled={loading} className="fancy-btn w-full">
            <span className="fancy-points" aria-hidden="true">
              {Array.from({ length: 10 }).map((_, i) => (<i key={i} className="fancy-point" />))}
            </span>
            <span className="fancy-inner">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              {mode === "signin" ? "Войти" : "Создать аккаунт"}
            </span>
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setErr(null); setMsg(null); setMode(mode === "signin" ? "signup" : "signin"); }}
          className="mt-5 w-full apex-mono text-[#52525B] hover:text-[#18181B] transition-colors"
        >
          {mode === "signin" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
        </button>

        <div className="mt-8 pt-5 border-t border-[#E2E0D8] flex items-center justify-center">
          <Link to="/" className="apex-mono inline-flex items-center gap-1.5 text-[#71717A] hover:text-[#18181B] transition-colors">
            <ArrowLeft className="h-3 w-3" />
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
