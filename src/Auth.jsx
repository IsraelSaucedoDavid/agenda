import React, { useState } from "react";
import { supabase } from "./supabase";
import { Mail, Lock, Sparkles, Loader2, AlertCircle, X, User } from "lucide-react";

const GoogleIcon = () => (
  <svg className="h-4.5 w-4.5 mr-2" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </svg>
);



export default function Auth({ onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [showTerms, setShowTerms] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleOAuthLogin = async (provider) => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message || `No se pudo iniciar sesión con ${provider}.`);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (isSignUp && !acceptedTerms) {
      setError("Debes aceptar los Términos de Servicio y las Normas de Convivencia para continuar.");
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: displayName.trim(),
              display_name: displayName.trim(),
              accepted_terms: true
            }
          }
        });
        if (error) throw error;
        
        // Si Supabase requiere confirmación de email, data.user estará pero data.session será null
        if (data?.user && !data?.session) {
          setMessage(
            "¡Registro exitoso! Por favor, verifica tu correo electrónico para confirmar tu cuenta."
          );
        } else if (data?.session) {
          onLoginSuccess(data.session.user);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data?.user) {
          onLoginSuccess(data.user);
        }
      }
    } catch (err) {
      setError(err.message || "Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-12 transition-colors duration-200">
      {/* Fondo decorativo con gradiente */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[80%] h-[80%] rounded-full bg-[var(--accent)] opacity-10 blur-[120px] dark:opacity-5"></div>
        <div className="absolute -bottom-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-[var(--accent)] opacity-10 blur-[120px] dark:opacity-5"></div>
      </div>

      <div className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-2xl backdrop-blur-md transition-all duration-300">
        {/* Cabecera */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] mb-4">
            <Sparkles size={24} />
          </div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-[var(--ink)]">
            {isSignUp ? "Crea tu espacio" : "Bienvenido a Órbita"}
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {isSignUp
              ? "Regístrate para sincronizar tus notas en la nube"
              : "Inicia sesión para acceder a tus páginas personales"}
          </p>
        </div>

        {/* Mensajes de feedback */}
        {error && (
          <div className="mt-6 flex items-start gap-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 p-3.5 text-xs text-[var(--danger)] border border-red-200 dark:border-red-900/30">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span className="leading-relaxed font-medium">{error}</span>
          </div>
        )}

        {message && (
          <div className="mt-6 flex items-start gap-2.5 rounded-lg bg-green-50 dark:bg-green-950/20 p-3.5 text-xs text-[var(--accent)] border border-green-200 dark:border-green-900/30">
            <Sparkles size={16} className="mt-0.5 flex-shrink-0" />
            <span className="leading-relaxed font-medium">{message}</span>
          </div>
        )}

        {/* Formulario */}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {isSignUp && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-1.5">
                Tu Nombre
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--muted)]">
                  <User size={16} />
                </span>
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] py-2.5 pl-10 pr-4 text-sm text-[var(--ink)] placeholder-[var(--muted)] outline-none transition duration-200 focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-1.5">
              Correo electrónico
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--muted)]">
                <Mail size={16} />
              </span>
              <input
                type="email"
                required
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] py-2.5 pl-10 pr-4 text-sm text-[var(--ink)] placeholder-[var(--muted)] outline-none transition duration-200 focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--muted)]">
                <Lock size={16} />
              </span>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] py-2.5 pl-10 pr-4 text-sm text-[var(--ink)] placeholder-[var(--muted)] outline-none transition duration-200 focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
          </div>

          {/* Aceptar Términos y Condiciones */}
          {isSignUp && (
            <div className="flex items-start gap-2.5 text-left select-none my-3">
              <input
                id="accept-terms-checkbox"
                type="checkbox"
                required
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[var(--border)] bg-[var(--bg)] cursor-pointer accent-[var(--accent)]"
              />
              <label htmlFor="accept-terms-checkbox" className="text-xs text-[var(--muted)] cursor-pointer leading-relaxed">
                Acepto los{" "}
                <button
                  type="button"
                  onClick={() => setShowTerms(true)}
                  className="text-[var(--accent)] font-semibold hover:underline bg-transparent border-none p-0 inline align-baseline outline-none"
                >
                  Términos de Servicio
                </button>{" "}
                y las{" "}
                <button
                  type="button"
                  onClick={() => setShowRules(true)}
                  className="text-[var(--accent)] font-semibold hover:underline bg-transparent border-none p-0 inline align-baseline outline-none"
                >
                  Normas de Convivencia
                </button>{" "}
                de Órbita.
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white shadow-md transition duration-200 hover:brightness-105 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : isSignUp ? (
              "Registrarse"
            ) : (
              "Iniciar Sesión"
            )}
          </button>
        </form>

        {/* Separador */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--border)]"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[var(--card)] px-3 text-[var(--muted)] font-medium">O</span>
          </div>
        </div>

        <div className="space-y-2.5 mb-6">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleOAuthLogin("google")}
            className="hov flex w-full items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] py-2.5 text-sm font-semibold text-[var(--ink)] shadow-sm outline-none transition duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            <GoogleIcon />
            {isSignUp ? "Registrarse con Google" : "Continuar con Google"}
          </button>
        </div>

        {/* Toggle de Modo */}
        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError(null);
            setMessage(null);
          }}
          className="w-full text-center text-xs font-semibold text-[var(--accent)] hover:underline outline-none"
        >
          {isSignUp
            ? "¿Ya tienes una cuenta? Inicia sesión"
            : "¿No tienes una cuenta? Regístrate gratis"}
        </button>

        {/* Enlaces a Políticas y Normas */}
        <div className="mt-6 flex justify-center gap-4 text-[11px] text-[var(--muted)] border-t border-[var(--border)] pt-4">
          <button onClick={() => setShowTerms(true)} type="button" className="hover:text-[var(--accent)] transition">Términos de Servicio</button>
          <span>•</span>
          <button onClick={() => setShowRules(true)} type="button" className="hover:text-[var(--accent)] transition">Normas de Convivencia</button>
        </div>
      </div>

      {/* Modal de Términos de Servicio */}
      {showTerms && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setShowTerms(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-xl border p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--ink)" }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold">Términos de Servicio</h2>
              <button onClick={() => setShowTerms(false)} className="hov rounded p-1"><X size={16} style={{ color: "var(--muted)" }} /></button>
            </div>
            <div className="max-h-60 overflow-y-auto pr-1 text-xs space-y-3 leading-relaxed" style={{ color: "var(--ink)" }}>
              <p><strong>1. Aceptación de los Términos:</strong> Al registrarte y utilizar Órbita, aceptas cumplir de forma incondicional con estos términos de servicio.</p>
              <p><strong>2. Uso del Servicio:</strong> Órbita es un espacio personal para organizar páginas, calendarios y pendientes. Te comprometes a usar la plataforma únicamente para fines lícitos y no comerciales.</p>
              <p><strong>3. Privacidad y Seguridad:</strong> Tus datos se almacenan en un servidor seguro y de forma local en tu navegador. Eres responsable de mantener la confidencialidad de tus credenciales de inicio de sesión.</p>
              <p><strong>4. Suspensión del Servicio:</strong> Nos reservamos el derecho de suspender o cancelar cuentas de forma temporal o permanente en caso de que se detecten conductas fraudulentas o infracciones a las normas de convivencia.</p>
            </div>
            <button onClick={() => setShowTerms(false)} className="mt-6 w-full rounded-lg py-2.5 text-xs font-semibold text-white shadow-md transition duration-200 hover:brightness-105 active:scale-[0.98]" style={{ background: "var(--accent)" }}>Entendido</button>
          </div>
        </div>
      )}

      {/* Modal de Normas de Convivencia */}
      {showRules && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setShowRules(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-xl border p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150" style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--ink)" }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif text-lg font-bold">Normas de Convivencia</h2>
              <button onClick={() => setShowRules(false)} className="hov rounded p-1"><X size={16} style={{ color: "var(--muted)" }} /></button>
            </div>
            <div className="max-h-60 overflow-y-auto pr-1 text-xs space-y-3 leading-relaxed" style={{ color: "var(--ink)" }}>
              <p><strong>1. Respeto y Tolerancia:</strong> Queda estrictamente prohibido el envío de reportes, tickets o mensajes abusivos, ofensivos, obscenos o amenazantes a través de las herramientas de soporte.</p>
              <p><strong>2. Prohibición de Spam:</strong> No utilices el formulario de soporte ni los campos de la aplicación para hacer publicidad, spam, propagación de malware o enlaces a sitios sospechosos.</p>
              <p><strong>3. Uso Legítimo:</strong> No intentes vulnerar el sistema de base de datos ni manipular el almacenamiento para acceder a perfiles ajenos o alterar el servicio.</p>
              <p><strong>4. Moderación:</strong> Los administradores monitorizan de forma activa los tickets y perfiles. El incumplimiento de cualquiera de estas normas es motivo directo de suspensión de la cuenta.</p>
            </div>
            <button onClick={() => setShowRules(false)} className="mt-6 w-full rounded-lg py-2.5 text-xs font-semibold text-white shadow-md transition duration-200 hover:brightness-105 active:scale-[0.98]" style={{ background: "var(--accent)" }}>Entendido</button>
          </div>
        </div>
      )}
    </div>
  );
}
