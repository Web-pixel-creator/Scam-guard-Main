import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAdminAuthPolicy } from "@/lib/admin-auth.functions";
import {
  ADMIN_TOTP_FRIENDLY_NAME,
  friendlyAdminMfaError,
  isValidTotpCode,
  normalizeTotpCode,
  preferredVerifiedTotpFactor,
  staleIshonchTotpFactors,
} from "@/lib/admin-mfa-flow";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/admin-mfa")({
  head: () => ({
    meta: [{ title: "Подтверждение MFA — Ishonch Guard" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminMfaPage,
});

type MfaPhase =
  | { kind: "loading" }
  | { kind: "challenge"; factorId: string }
  | {
      kind: "enroll";
      factorId: string;
      qrCode: string;
      secret: string;
    }
  | { kind: "ready" }
  | { kind: "error"; message: string };

function AdminMfaPage() {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const getPolicy = useServerFn(getAdminAuthPolicy);
  const { user, loading, signOut } = useAuth();
  const [phase, setPhase] = useState<MfaPhase>({ kind: "loading" });
  const [required, setRequired] = useState(false);
  const [policyLoaded, setPolicyLoaded] = useState(false);
  const [code, setCode] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [secretVisible, setSecretVisible] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const initializationKey = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void nav({ to: "/login", replace: true });
      return;
    }

    const key = `${user.id}:${reloadKey}`;
    if (initializationKey.current === key) return;
    initializationKey.current = key;
    setPhase({ kind: "loading" });
    setFormError(null);
    setCopyMessage(null);
    setSecretVisible(false);

    void (async () => {
      const policy = await getPolicy({ data: undefined as never });
      if (initializationKey.current !== key) return;

      setRequired(policy.requireMfaAal2);
      setPolicyLoaded(true);
      if (!policy.isAdmin) {
        await nav({ to: "/admin", replace: true });
        return;
      }

      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      if (initializationKey.current !== key) return;

      const verifiedTotp = preferredVerifiedTotpFactor(factors.all);
      if (verifiedTotp) {
        setPhase(
          policy.currentAal === "aal2"
            ? { kind: "ready" }
            : { kind: "challenge", factorId: verifiedTotp.id },
        );
        return;
      }

      for (const staleFactor of staleIshonchTotpFactors(factors.all)) {
        const { error: cleanupError } = await supabase.auth.mfa.unenroll({
          factorId: staleFactor.id,
        });
        if (cleanupError) throw cleanupError;
      }

      const { data: enrollment, error: enrollmentError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: ADMIN_TOTP_FRIENDLY_NAME,
        issuer: "Ishonch Guard",
      });
      if (enrollmentError) throw enrollmentError;
      if (initializationKey.current !== key) return;

      setPhase({
        kind: "enroll",
        factorId: enrollment.id,
        qrCode: enrollment.totp.qr_code,
        secret: enrollment.totp.secret,
      });
    })().catch((error: unknown) => {
      if (initializationKey.current !== key) return;
      setPhase({ kind: "error", message: friendlyAdminMfaError(error) });
    });
  }, [getPolicy, loading, nav, reloadKey, user]);

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    if (phase.kind !== "challenge" && phase.kind !== "enroll") return;

    const normalizedCode = normalizeTotpCode(code);
    if (!isValidTotpCode(normalizedCode)) {
      setFormError("Введите все 6 цифр из приложения-аутентификатора.");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: phase.factorId,
        code: normalizedCode,
      });
      if (error) throw error;

      const { data: assurance, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      if (assurance.currentLevel !== "aal2") {
        throw new Error("MFA verification did not upgrade the session");
      }

      setCode("");
      setPhase({ kind: "ready" });
      queryClient.removeQueries({ queryKey: ["admin-auth-policy"] });
      await nav({ to: "/admin", replace: true });
    } catch (error: unknown) {
      setFormError(friendlyAdminMfaError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function removePendingEnrollment(): Promise<void> {
    if (phase.kind !== "enroll") return;
    await supabase.auth.mfa.unenroll({ factorId: phase.factorId });
  }

  async function leaveToAdmin() {
    setLeaving(true);
    try {
      await removePendingEnrollment();
      await nav({ to: "/admin", replace: true });
    } finally {
      setLeaving(false);
    }
  }

  async function exitSession() {
    setLeaving(true);
    try {
      await removePendingEnrollment();
      await signOut();
      await nav({ to: "/login", replace: true });
    } finally {
      setLeaving(false);
    }
  }

  async function copySecret() {
    if (phase.kind !== "enroll") return;
    try {
      await navigator.clipboard.writeText(phase.secret);
      setCopyMessage("Ключ скопирован. Не отправляйте его в чат и никому не показывайте.");
    } catch {
      setCopyMessage("Не удалось скопировать. Покажите ключ и перенесите его вручную.");
    }
  }

  const canReturnToAdmin = policyLoaded && !required;
  const busy = submitting || leaving;

  return (
    <div className="apex-page" style={{ maxWidth: 680 }}>
      <section
        className="apex-card apex-frame apex-stripes"
        style={{ padding: "clamp(24px, 5vw, 42px)" }}
      >
        <div className="mb-6 flex items-center justify-between gap-3">
          <span className="apex-mono">ADMIN / MFA</span>
          <span
            className="apex-status"
            data-state={
              phase.kind === "ready"
                ? "success"
                : phase.kind === "error" || formError
                  ? "error"
                  : phase.kind === "loading" || busy
                    ? "loading"
                    : "idle"
            }
          >
            <span className="apex-status-dot" />
            {phase.kind === "ready"
              ? "AAL2 подтверждён"
              : phase.kind === "loading" || busy
                ? "Проверяем…"
                : "Защищённый вход"}
          </span>
        </div>

        <div className="mb-7 flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-[5px] bg-[#0B0B0F] text-white">
            <KeyRound className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
          </span>
          <div>
            <strong className="block text-[15px] font-extrabold text-[#18181B]">
              Ishonch Guard
            </strong>
            <span className="apex-mono text-[#71717A]">Двухфакторная защита</span>
          </div>
        </div>

        {phase.kind === "loading" && (
          <div className="py-10 text-center" role="status">
            <Loader2
              className="mx-auto mb-4 h-7 w-7 animate-spin text-[#EA580C]"
              aria-hidden="true"
            />
            <h1 className="apex-h1" style={{ fontSize: "clamp(24px, 5vw, 34px)" }}>
              Проверяем <span className="font-serif-italic text-[#8B8B92]">защиту</span>
            </h1>
            <p className="apex-lead mx-auto mt-3">
              Определяем уровень текущей сессии и доступные TOTP-факторы.
            </p>
          </div>
        )}

        {phase.kind === "challenge" && (
          <>
            <p className="label-md mb-3">01 — Подтверждение входа</p>
            <h1 className="apex-h1 mb-3" style={{ fontSize: "clamp(26px, 5vw, 38px)" }}>
              Введите код из{" "}
              <span className="font-serif-italic text-[#8B8B92]">аутентификатора</span>
            </h1>
            <p className="apex-lead mb-7">
              Откройте приложение, в котором настроен Ishonch Guard, и введите текущие 6 цифр.
            </p>
            <TotpForm
              code={code}
              error={formError}
              submitting={submitting}
              onCodeChange={(value) => {
                setCode(normalizeTotpCode(value));
                setFormError(null);
              }}
              onSubmit={verifyCode}
            />
          </>
        )}

        {phase.kind === "enroll" && (
          <>
            <p className="label-md mb-3">01 — Настройка TOTP</p>
            <h1 className="apex-h1 mb-3" style={{ fontSize: "clamp(26px, 5vw, 38px)" }}>
              Подключите второй <span className="font-serif-italic text-[#8B8B92]">фактор</span>
            </h1>
            <p className="apex-lead mb-6">
              Отсканируйте QR-код в Google Authenticator, 1Password, Microsoft Authenticator или
              другом TOTP-приложении.
            </p>

            <div className="mb-6 grid gap-5 border border-[#E2E0D8] bg-white p-4 sm:grid-cols-[220px_1fr] sm:p-5">
              <div className="grid place-items-center border border-[#E2E0D8] bg-white p-2">
                <img
                  src={phase.qrCode}
                  alt="QR-код для настройки TOTP в приложении-аутентификаторе"
                  width={220}
                  height={220}
                  className="h-auto w-full max-w-[220px]"
                />
              </div>
              <div className="min-w-0">
                <p className="apex-label">Если QR нельзя отсканировать</p>
                <p className="mb-4 text-sm leading-6 text-[#52525B]">
                  Введите ключ вручную. Это секрет аккаунта: не отправляйте его в Telegram, email
                  или поддержку.
                </p>
                <button
                  type="button"
                  className="apex-btn-outline mb-3 inline-flex items-center gap-2"
                  onClick={() => setSecretVisible((visible) => !visible)}
                >
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  {secretVisible ? "Скрыть ключ" : "Показать ключ"}
                </button>
                {secretVisible && (
                  <div className="border border-[#E2E0D8] bg-[#F7F6F1] p-3">
                    <code className="block break-all font-mono text-sm text-[#18181B]">
                      {phase.secret}
                    </code>
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#52525B] hover:text-[#18181B]"
                      onClick={() => void copySecret()}
                    >
                      <Copy className="h-4 w-4" aria-hidden="true" /> Скопировать
                    </button>
                  </div>
                )}
                {copyMessage && (
                  <p className="mt-3 text-sm leading-5 text-[#52525B]" role="status">
                    {copyMessage}
                  </p>
                )}
              </div>
            </div>

            <p className="mb-4 text-sm font-bold text-[#18181B]">
              После добавления аккаунта введите первый 6-значный код:
            </p>
            <TotpForm
              code={code}
              error={formError}
              submitting={submitting}
              onCodeChange={(value) => {
                setCode(normalizeTotpCode(value));
                setFormError(null);
              }}
              onSubmit={verifyCode}
            />
          </>
        )}

        {phase.kind === "ready" && (
          <div className="py-6 text-center">
            <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-[#E8F5EE] text-[#087A55]">
              <ShieldCheck className="h-7 w-7" aria-hidden="true" />
            </span>
            <p className="label-md mb-3">02 — Готово</p>
            <h1 className="apex-h1" style={{ fontSize: "clamp(26px, 5vw, 38px)" }}>
              MFA <span className="font-serif-italic text-[#087A55]">подтверждена</span>
            </h1>
            <p className="apex-lead mx-auto mt-3 mb-7">
              Текущая сессия имеет уровень AAL2. Защищённые действия администратора доступны.
            </p>
            <button
              type="button"
              className="fancy-btn w-full"
              onClick={() => void nav({ to: "/admin", replace: true })}
            >
              <span className="fancy-points" aria-hidden="true">
                {Array.from({ length: 10 }).map((_, index) => (
                  <i key={index} className="fancy-point" />
                ))}
              </span>
              <span className="fancy-inner">
                <Check className="h-4 w-4" aria-hidden="true" />
                Перейти в админку
              </span>
            </button>
          </div>
        )}

        {phase.kind === "error" && (
          <div className="py-6 text-center">
            <p className="label-md mb-3">MFA / Ошибка</p>
            <h1 className="apex-h1" style={{ fontSize: "clamp(26px, 5vw, 38px)" }}>
              Не удалось проверить <span className="font-serif-italic text-[#B91C1C]">защиту</span>
            </h1>
            <p className="apex-error mx-auto mt-5 text-left" role="alert">
              {phase.message}
            </p>
            <button
              type="button"
              className="apex-btn-outline mt-6 inline-flex items-center gap-2"
              onClick={() => {
                initializationKey.current = null;
                setPolicyLoaded(false);
                setReloadKey((value) => value + 1);
              }}
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" /> Повторить
            </button>
          </div>
        )}

        {phase.kind !== "loading" && (
          <div className="mt-7 flex flex-col gap-3 border-t border-[#E2E0D8] pt-5 sm:flex-row sm:items-center sm:justify-between">
            {canReturnToAdmin && phase.kind !== "ready" ? (
              <button
                type="button"
                className="apex-btn-outline inline-flex items-center justify-center gap-2"
                disabled={busy}
                onClick={() => void leaveToAdmin()}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Вернуться без включения
              </button>
            ) : (
              <span className="text-sm leading-5 text-[#71717A]">
                Потеряли доступ к приложению? Выйдите и обратитесь ко второму владельцу проекта.
              </span>
            )}
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 text-sm font-bold text-[#52525B] hover:text-[#18181B] disabled:opacity-50"
              disabled={busy}
              onClick={() => void exitSession()}
            >
              {leaving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <LogOut className="h-4 w-4" aria-hidden="true" />
              )}
              Выйти из аккаунта
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function TotpForm({
  code,
  error,
  submitting,
  onCodeChange,
  onSubmit,
}: {
  code: string;
  error: string | null;
  submitting: boolean;
  onCodeChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="admin-mfa-code" className="apex-label">
        Одноразовый код
      </label>
      <input
        id="admin-mfa-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        autoFocus
        value={code}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "admin-mfa-code-error" : undefined}
        className="apex-field text-center font-mono text-xl tracking-[0.35em]"
        placeholder="000000"
        onChange={(event) => onCodeChange(event.target.value)}
      />
      {error && (
        <p id="admin-mfa-code-error" className="apex-error mt-3" role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={submitting} className="fancy-btn mt-5 w-full">
        <span className="fancy-points" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, index) => (
            <i key={index} className="fancy-point" />
          ))}
        </span>
        <span className="fancy-inner">
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          )}
          Подтвердить код
        </span>
      </button>
    </form>
  );
}
