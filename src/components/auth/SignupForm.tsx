'use client';

import { useState, useCallback, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export function SignupForm() {
  const router = useRouter();
  const { signUp, isLoading } = useAuthStore();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!fullName.trim()) {
        setError('Digite seu nome completo');
        return;
      }
      if (!email.trim()) {
        setError('Digite seu email');
        return;
      }
      if (password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres');
        return;
      }
      if (password !== confirmPassword) {
        setError('As senhas não coincidem');
        return;
      }

      const result = await signUp(email.trim(), password, fullName.trim());

      if (result.error) {
        setError(result.error);
      } else {
        // Supabase may require email confirmation
        setSuccess(true);
        // Try to redirect; if email confirmation required, show success message
        router.push('/');
        router.refresh();
      }
    },
    [fullName, email, password, confirmPassword, signUp, router]
  );

  if (success) {
    return (
      <div className="rounded-2xl bg-[#1a1a2e] p-6 text-center">
        <div className="mb-4 text-4xl">✉️</div>
        <h2 className="mb-2 text-lg font-semibold text-white">
          Verifique seu email
        </h2>
        <p className="text-sm text-[#a0a0a0]">
          Enviamos um link de confirmação para{' '}
          <span className="text-[#00d9ff]">{email}</span>. Clique no link para
          ativar sua conta.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-semibold text-[#e94560] hover:underline"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-[#1a1a2e] p-6">
      <h2 className="mb-6 text-center text-lg font-semibold text-white">
        Criar conta
      </h2>

      {/* Full Name */}
      <div className="mb-4">
        <label
          htmlFor="full-name"
          className="mb-1.5 block text-xs font-medium text-[#a0a0a0]"
        >
          Nome completo
        </label>
        <input
          id="full-name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Dr. João Silva"
          className="h-11 w-full rounded-xl bg-[#252a4a] px-4 text-sm text-white placeholder:text-[#666] outline-none focus:ring-1 focus:ring-[#e94560]/50"
          autoComplete="name"
          disabled={isLoading}
        />
      </div>

      {/* Email */}
      <div className="mb-4">
        <label
          htmlFor="email"
          className="mb-1.5 block text-xs font-medium text-[#a0a0a0]"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          className="h-11 w-full rounded-xl bg-[#252a4a] px-4 text-sm text-white placeholder:text-[#666] outline-none focus:ring-1 focus:ring-[#e94560]/50"
          autoComplete="email"
          disabled={isLoading}
        />
      </div>

      {/* Password */}
      <div className="mb-4">
        <label
          htmlFor="password"
          className="mb-1.5 block text-xs font-medium text-[#a0a0a0]"
        >
          Senha
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            className="h-11 w-full rounded-xl bg-[#252a4a] px-4 pr-10 text-sm text-white placeholder:text-[#666] outline-none focus:ring-1 focus:ring-[#e94560]/50"
            autoComplete="new-password"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] hover:text-[#a0a0a0] transition-colors"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Confirm Password */}
      <div className="mb-6">
        <label
          htmlFor="confirm-password"
          className="mb-1.5 block text-xs font-medium text-[#a0a0a0]"
        >
          Confirmar senha
        </label>
        <div className="relative">
          <input
            id="confirm-password"
            type={showConfirm ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••"
            className="h-11 w-full rounded-xl bg-[#252a4a] px-4 pr-10 text-sm text-white placeholder:text-[#666] outline-none focus:ring-1 focus:ring-[#e94560]/50"
            autoComplete="new-password"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] hover:text-[#a0a0a0] transition-colors"
            aria-label={showConfirm ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {showConfirm ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg bg-[#e94560]/10 px-4 py-2.5 text-center text-xs text-[#e94560]"
        >
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading}
        className="flex h-11 w-full items-center justify-center rounded-xl bg-[#e94560] text-sm font-semibold text-white transition-colors hover:bg-[#e94560]/80 disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          'Criar conta'
        )}
      </button>

      {/* Link to login */}
      <p className="mt-4 text-center text-xs text-[#a0a0a0]">
        Já tem conta?{' '}
        <Link
          href="/login"
          className="font-semibold text-[#00d9ff] hover:underline"
        >
          Faça login
        </Link>
      </p>
    </form>
  );
}
