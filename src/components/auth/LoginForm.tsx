'use client';

import { useState, useCallback, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export function LoginForm() {
  const router = useRouter();
  const { signIn, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!email.trim()) {
        setError('Digite seu email');
        return;
      }
      if (password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres');
        return;
      }

      const result = await signIn(email.trim(), password);

      if (result.error) {
        setError(result.error);
      } else {
        router.push('/');
        router.refresh();
      }
    },
    [email, password, signIn, router]
  );

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-[#1a1a2e] p-6">
      <h2 className="mb-6 text-center text-lg font-semibold text-white">
        Entrar
      </h2>

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
      <div className="mb-6">
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
            autoComplete="current-password"
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
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar'}
      </button>

      {/* Link to signup */}
      <p className="mt-4 text-center text-xs text-[#a0a0a0]">
        Não tem conta?{' '}
        <Link
          href="/signup"
          className="font-semibold text-[#00d9ff] hover:underline"
        >
          Cadastre-se
        </Link>
      </p>
    </form>
  );
}
