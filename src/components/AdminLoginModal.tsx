import React, { useState } from 'react';
import { X, Lock, Mail, Eye, EyeOff, Loader2 } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const mapAuthError = (err: unknown): string => {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code: string }).code)
        : '';

    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'E-mail ou senha incorretos. Verifique os dados e tente novamente.';
      case 'auth/invalid-email':
        return 'O formato do e-mail informado é inválido.';
      case 'auth/too-many-requests':
        return 'Muitas tentativas seguidas. Aguarde alguns instantes e tente novamente.';
      case 'auth/operation-not-allowed':
        return 'Login por E-mail/Senha não está ativado no Firebase Authentication. Ative o provedor E-mail/Senha no Console do Firebase.';
      default:
        return 'Não foi possível entrar. Verifique sua conexão e as configurações do Firebase Auth.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim() || !password) {
      setErrorMsg('Preencha o e-mail e a senha de acesso.');
      return;
    }

    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setEmail('');
      setPassword('');
      onLoginSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#260E09]/65 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-login-title"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[#D81B60]/20 bg-[#FFFDFD] p-6 shadow-2xl sm:p-7">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3.5 top-3.5 flex h-9 w-9 items-center justify-center rounded-lg text-[#3A150B]/60 transition-colors hover:bg-[#FCEEF2] hover:text-[#3A150B]"
          aria-label="Fechar login do painel"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2.5 text-[#D81B60]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FCEEF2]">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="admin-login-title" className="font-hand text-2xl font-bold text-[#3A150B]">
              Acesso ao Painel
            </h2>
            <p className="text-xs text-[#3A150B]/65">
              Entre com seu e-mail e senha de administrador ou equipe
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="admin-email" className="block text-xs font-semibold text-[#3A150B]">
              E-mail
            </label>
            <div className="relative mt-1">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3A150B]/45"
                aria-hidden="true"
              />
              <input
                id="admin-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                className="w-full rounded-xl border border-[#3A150B]/15 bg-white py-2.5 pl-9 pr-3 text-sm text-[#3A150B] placeholder:text-[#3A150B]/40 focus:border-[#D81B60] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-xs font-semibold text-[#3A150B]">
              Senha
            </label>
            <div className="relative mt-1">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3A150B]/45"
                aria-hidden="true"
              />
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[#3A150B]/15 bg-white py-2.5 pl-9 pr-10 text-sm text-[#3A150B] placeholder:text-[#3A150B]/40 focus:border-[#D81B60] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[#3A150B]/50 hover:text-[#3A150B]"
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <p
              role="alert"
              className="rounded-xl border border-[#EF4444]/25 bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]"
            >
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#D81B60] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#AD1457] disabled:cursor-not-allowed disabled:opacity-65"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Entrando...
              </>
            ) : (
              'Entrar no Painel'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
