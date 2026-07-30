import React, { useState } from "react";
import { supabase } from "./supabase";
import { Mail, Lock, Sparkles, Loader2, AlertCircle } from "lucide-react";

const GoogleIcon = () => (
  <svg className="h-4.5 w-4.5 mr-2" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </svg>
);

const MicrosoftIcon = () => (
  <svg className="h-4.5 w-4.5 mr-2" viewBox="0 0 23 23" fill="currentColor">
    <rect x="0" y="0" width="10.5" height="10.5" fill="#F25022" />
    <rect x="11.5" y="0" width="10.5" height="10.5" fill="#7FBA00" />
    <rect x="0" y="11.5" width="10.5" height="10.5" fill="#00A4EF" />
    <rect x="11.5" y="11.5" width="10.5" height="10.5" fill="#FFB900" />
  </svg>
);

export default function Auth({ onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

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

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
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
            {isSignUp ? "Crea tu espacio" : "Bienvenido a Espacio"}
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

        {/* Botones de OAuth */}
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
          <button
            type="button"
            disabled={loading}
            onClick={() => handleOAuthLogin("azure")}
            className="hov flex w-full items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--card)] py-2.5 text-sm font-semibold text-[var(--ink)] shadow-sm outline-none transition duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            <MicrosoftIcon />
            {isSignUp ? "Registrarse con Microsoft" : "Continuar con Microsoft"}
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
      </div>
    </div>
  );
}
