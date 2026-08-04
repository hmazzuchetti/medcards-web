import { LoginForm } from '@/components/auth/LoginForm';

export const metadata = {
  title: 'Entrar — MedCards',
};

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#16213e] px-4">
      <div className="w-full max-w-[360px]">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[#e94560]">MedCards</h1>
          <p className="mt-2 text-sm text-[#a0a0a0]">
            Flashcards de medicina com repetição espaçada
          </p>
        </div>

        <LoginForm />
      </div>
    </div>
  );
}
