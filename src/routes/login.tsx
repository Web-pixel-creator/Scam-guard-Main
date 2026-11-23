import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle,
  CircleNotch,
  ShieldCheck,
  SignIn,
  WarningCircle,
} from "@phosphor-icons/react";
import { PillButton } from "@/components/viper/kit";
import { supabase } from "@/integrations/supabase/client";
import { getAdminAuthPolicy } from "@/lib/admin-auth.functions";
import { adminSessionDestination } from "@/lib/admin-mfa-flow";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import {
  SIGNUP_PASSWORD_MIN_LENGTH,
  SIGNUP_PASSWORD_PATTERN,
  SIGNUP_PASSWORD_REQUIREMENTS,
} from "@/lib/auth-password-policy";

// Admin-only page, but it carries the public chrome and language switch.
const COPY = {
  ru: {
    error: "Ошибка",
    badCredentials:
      "Email или пароль не подошли. Проверьте данные или обратитесь к администратору проекта.",
    notConfirmed: "Email ещё не подтверждён. Проверьте письмо от Supabase и повторите вход.",
    policyFailed:
      "Вход выполнен, но не удалось проверить политику защиты администратора. Обновите страницу или обратитесь ко второму владельцу проекта.",
    created: "Аккаунт создан. Если включено подтверждение email — проверьте почту.",
    accepted: "Пароль принят. Проверяем роль и уровень защиты сессии…",
    signinTab: "Вход",
    signupTab: "Регистрация",
    checking: "Проверяем…",
    secured: "Защищено",
    signinTitle: "Вход в админку.",
    signupTitle: "Регистрация админа.",
    inviteOnly: "Только по приглашению.",
    lead: "Вход только для приглашённых администраторов. Email должен быть заранее добавлен в список доступа.",
    password: "Пароль",
    passwordRule: SIGNUP_PASSWORD_REQUIREMENTS,
    signin: "Войти",
    signup: "Создать аккаунт",
    toSignup: "Получили приглашение? Создать учётную запись",
    toSignin: "Учётная запись уже создана? Войти",
    home: "На главную",
  },
  uz: {
    error: "Xatolik",
    badCredentials:
      "Email yoki parol to‘g‘ri kelmadi. Ma’lumotlarni tekshiring yoki loyiha administratoriga murojaat qiling.",
    notConfirmed:
      "Email hali tasdiqlanmagan. Supabase’dan kelgan xatni tekshiring va qayta kiring.",
    policyFailed:
      "Kirish bajarildi, lekin administrator himoya siyosatini tekshirib bo‘lmadi. Sahifani yangilang yoki loyihaning ikkinchi egasiga murojaat qiling.",
    created: "Hisob yaratildi. Agar email tasdiqlash yoqilgan bo‘lsa, pochtangizni tekshiring.",
    accepted: "Parol qabul qilindi. Rol va sessiya himoyasi darajasini tekshiryapmiz…",
    signinTab: "Kirish",
    signupTab: "Ro‘yxatdan o‘tish",
    checking: "Tekshirilmoqda…",
    secured: "Himoyalangan",
    signinTitle: "Admin panelga kirish.",
    signupTitle: "Adminni ro‘yxatdan o‘tkazish.",
    inviteOnly: "Faqat taklif bo‘yicha.",
    lead: "Kirish faqat taklif qilingan administratorlar uchun. Email oldindan ruxsat ro‘yxatiga qo‘shilgan bo‘lishi kerak.",
    password: "Parol",
    passwordRule: "Kamida 12 ta belgi: lotin kichik va bosh harfi, raqam va maxsus belgi.",
    signin: "Kirish",
    signup: "Hisob yaratish",
    toSignup: "Taklif oldingizmi? Hisob yarating",
    toSignin: "Hisob allaqachon yaratilganmi? Kirish",
    home: "Bosh sahifa",
  },
  en: {
    error: "Error",
    badCredentials:
      "The email or password did not match. Check them or contact the project administrator.",
    notConfirmed: "The email is not confirmed yet. Check the Supabase email and sign in again.",
    policyFailed:
      "Signed in, but the administrator protection policy could not be checked. Reload the page or contact the second project owner.",
    created: "Account created. If email confirmation is on, check your inbox.",
    accepted: "Password accepted. Checking the role and session protection level…",
    signinTab: "Sign in",
    signupTab: "Sign up",
    checking: "Checking…",
    secured: "Protected",
    signinTitle: "Admin sign-in.",
    signupTitle: "Admin sign-up.",
    inviteOnly: "Invitation only.",
    lead: "Only invited administrators can sign in. The email must already be on the access list.",
    password: "Password",
    passwordRule:
      "At least 12 characters: a lowercase and an uppercase Latin letter, a digit and a special character.",
    signin: "Sign in",
    signup: "Create account",
    toSignup: "Got an invitation? Create an account",
    toSignin: "Already have an account? Sign in",
    home: "Home",
  },
} as const;

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const { lang } = useLang();
  const copy = COPY[lang];
  const getPolicy = useServerFn(getAdminAuthPolicy);
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function friendlyAuthError(e: unknown): string {
    const message = e instanceof Error ? e.message : copy.error;
    if (/invalid login credentials/i.test(message)) return copy.badCredentials;
    if (/email not confirmed/i.test(message)) return copy.notConfirmed;
    return message;
  }

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    void getPolicy({ data: undefined as never })
      .then((policy) => {
        if (!cancelled) {
          void nav({ to: adminSessionDestination(policy), replace: true });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErr(COPY[lang].policyFailed);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [getPolicy, lang, nav, user]);

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
        setMsg(copy.created);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setMsg(copy.accepted);
      }
    } catch (e: unknown) {
      setErr(friendlyAuthError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="vp-home vp-page">
      <div className="vp-shell">
        <div className="vp-formcard vp-formcard--narrow">
          <div className="vp-formcard-head">
            <span className="vp-checker-label">
              {mode === "signin" ? copy.signinTab : copy.signupTab}
            </span>
            <span className="vp-status" data-state={loading ? "loading" : "idle"}>
              <i aria-hidden="true" />
              {loading ? copy.checking : copy.secured}
            </span>
          </div>

          <div className="vp-formcard-body">
            <div className="vp-eyebrow">
              <span aria-hidden="true">
                <ShieldCheck weight="bold" />
              </span>
              Ishonch Guard
            </div>
            <h1 className="vp-page-title vp-page-title--small">
              <span>{mode === "signin" ? copy.signinTitle : copy.signupTitle}</span>
              <span>{copy.inviteOnly}</span>
            </h1>
            <p className="vp-page-lead">{copy.lead}</p>

            <form onSubmit={submit} className="vp-form">
              <div className="vp-field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="vp-input"
                />
              </div>
              <div className="vp-field">
                <label htmlFor="password">{copy.password}</label>
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  minLength={mode === "signin" ? 6 : SIGNUP_PASSWORD_MIN_LENGTH}
                  pattern={mode === "signup" ? SIGNUP_PASSWORD_PATTERN : undefined}
                  title={mode === "signup" ? copy.passwordRule : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="vp-input"
                />
              </div>

              {err && (
                <p className="vp-alert vp-alert--error" role="alert">
                  <WarningCircle weight="fill" aria-hidden="true" />
                  {err}
                </p>
              )}
              {msg && (
                <p className="vp-alert vp-alert--ok" role="status">
                  <CheckCircle weight="fill" aria-hidden="true" />
                  {msg}
                </p>
              )}

              <PillButton
                type="submit"
                disabled={loading}
                className="vp-formcard-submit"
                icon={
                  loading ? (
                    <CircleNotch weight="bold" className="vp-spin" />
                  ) : (
                    <SignIn weight="bold" />
                  )
                }
              >
                {mode === "signin" ? copy.signin : copy.signup}
              </PillButton>
            </form>

            <button
              type="button"
              onClick={() => {
                setErr(null);
                setMsg(null);
                setMode(mode === "signin" ? "signup" : "signin");
              }}
              className="vp-textlink"
            >
              {mode === "signin" ? copy.toSignup : copy.toSignin}
            </button>
          </div>

          <p className="vp-formcard-foot">
            <ArrowLeft weight="bold" aria-hidden="true" />
            <Link to="/">{copy.home}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
