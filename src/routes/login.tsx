import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, ArrowLeft, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Вход — Ishonch Guard" }] }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function friendlyAuthError(e: unknown): string {
    const message = e instanceof Error ? e.message : "Ошибка";
    if (/invalid login credentials/i.test(message)) {
      return "Email или пароль не подошли. Если аккаунт ещё не создавали, нажмите «Зарегистрироваться». Email должен быть заранее добавлен в allowlist админов.";
    }
    if (/email not confirmed/i.test(message)) {
      return "Email ещё не подтверждён. Проверьте письмо от Supabase и повторите вход.";
    }
    return message;
  }

  useEffect(() => {
    if (user) nav({ to: "/admin" });
  }, [user, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
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
      setErr(friendlyAuthError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="apex-page" style={{ maxWidth: 520 }}>
      <div
        className="apex-card apex-frame apex-stripes"
        style={{ padding: "clamp(24px, 5vw, 40px)" }}
      >
        <div className="flex items-center justify-between gap-3 mb-5 sm:mb-6">
          <span className="apex-mono">Вход</span>
          <span className="apex-status" data-state={loading ? "loading" : "idle"}>
            <span className="apex-status-dot" />
            {loading ? "Проверяем…" : "Защищено"}
          </span>
        </div>

        <div className="flex items-center gap-2.5 mb-6 sm:mb-8">
          <span className="grid h-7 w-7 place-items-center rounded-[4px] bg-[#0B0B0F] text-white">
            <ShieldCheck
              className="h-3.5 w-3.5"
              strokeWidth={2.25}
              aria-hidden="true"
              focusable="false"
            />
          </span>
          <span className="font-display text-[15px] font-extrabold tracking-tight text-[#18181B]">
            Ishonch Guard
          </span>
        </div>

        <p className="label-md mb-3">{mode === "signin" ? "00 — Вход" : "00 — Регистрация"}</p>
        <h1 className="apex-h1 mb-3" style={{ fontSize: "clamp(24px, 5.5vw, 36px)" }}>
          {mode === "signin" ? (
            <>
              Вход в <span className="font-serif-italic text-[#8B8B92]">админку</span>
            </>
          ) : (
            <>
              Регистрация <span className="font-serif-italic text-[#8B8B92]">админа</span>
            </>
          )}
        </h1>
        <p className="apex-lead mb-7 sm:mb-8">
          Вход только для аккаунтов с ролью администратора. Email администратора заранее добавляется
          в allowlist.
        </p>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="email" className="apex-label">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="apex-field"
            />
          </div>
          <div>
            <label htmlFor="password" className="apex-label">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="apex-field"
            />
          </div>

          {err && (
            <p className="apex-error" role="alert">
              {err}
            </p>
          )}
          {msg && (
            <p className="apex-success" role="status">
              {msg}
            </p>
          )}

          <button type="submit" disabled={loading} className="fancy-btn w-full">
            <span className="fancy-points" aria-hidden="true">
              {Array.from({ length: 10 }).map((_, i) => (
                <i key={i} className="fancy-point" />
              ))}
            </span>
            <span className="fancy-inner">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogIn className="h-4 w-4" aria-hidden="true" />
              )}
              {mode === "signin" ? "Войти" : "Создать аккаунт"}
            </span>
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setErr(null);
            setMsg(null);
            setMode(mode === "signin" ? "signup" : "signin");
          }}
          className="mt-5 w-full apex-mono text-[#52525B] hover:text-[#18181B] transition-colors"
        >
          {mode === "signin" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
        </button>

        <div className="mt-7 sm:mt-8 pt-5 border-t border-[#E2E0D8] flex items-center justify-center">
          <Link
            to="/"
            className="apex-mono inline-flex items-center gap-1.5 text-[#71717A] hover:text-[#18181B] transition-colors"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}
