import React, { useEffect, useState } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Lock,
  Loader2,
  Eye,
  EyeOff,
  KeyRound,
  UserCheck,
  UserX,
} from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db, getStaffRegistrationAuth } from '../firebase';

interface TeamManagerProps {
  ownerUid: string;
}

interface StaffMember {
  uid: string;
  nome: string;
  email: string;
  ativo: boolean;
}

type Feedback = { type: 'success' | 'error'; text: string } | null;

function readErrorCode(err: unknown): string {
  return typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code: string }).code)
    : '';
}

function mapRegistrationError(err: unknown): string {
  switch (readErrorCode(err)) {
    case 'auth/email-already-in-use':
      return 'Este e-mail já possui conta. Se a pessoa já foi cadastrada, reative-a na lista abaixo.';
    case 'auth/weak-password':
      return 'Senha fraca. Use pelo menos 6 caracteres.';
    case 'auth/invalid-email':
      return 'O formato do e-mail informado é inválido.';
    case 'auth/operation-not-allowed':
      return 'Login por E-mail/Senha não está ativado no Firebase Authentication.';
    case 'permission-denied':
      return 'Sem permissão para gravar na equipe. Publique as regras atualizadas do Firestore (firestore.rules).';
    default:
      return 'Não foi possível cadastrar agora. Verifique a conexão e tente novamente.';
  }
}

export const TeamManager: React.FC<TeamManagerProps> = ({ ownerUid }) => {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    const staffQuery = query(collection(db, 'admins'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      staffQuery,
      (snapshot) => {
        setMembers(
          snapshot.docs.map((d) => {
            const data = d.data();
            return {
              uid: d.id,
              nome: String(data.nome || ''),
              email: String(data.email || ''),
              ativo: data.ativo === true,
            };
          })
        );
        setLoadError('');
        setIsLoading(false);
      },
      () => {
        setLoadError(
          'Não foi possível carregar a equipe. Publique as regras atualizadas do Firestore (firestore.rules).'
        );
        setIsLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const trimmedName = nome.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedName.length < 2) {
      setFeedback({ type: 'error', text: 'Informe o nome da pessoa.' });
      return;
    }
    if (!trimmedEmail) {
      setFeedback({ type: 'error', text: 'Informe o e-mail da pessoa.' });
      return;
    }
    if (senha.length < 6) {
      setFeedback({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres.' });
      return;
    }

    setIsSaving(true);
    const staffAuth = getStaffRegistrationAuth();
    try {
      const credential = await createUserWithEmailAndPassword(staffAuth, trimmedEmail, senha);
      try {
        await updateProfile(credential.user, { displayName: trimmedName });
      } catch {
        // O nome também fica salvo no cadastro da equipe.
      }

      await setDoc(doc(db, 'admins', credential.user.uid), {
        nome: trimmedName,
        email: trimmedEmail,
        ativo: true,
        createdBy: ownerUid,
        createdAt: serverTimestamp(),
      });

      setNome('');
      setEmail('');
      setSenha('');
      setFeedback({
        type: 'success',
        text: `${trimmedName} foi cadastrado(a). Passe o e-mail e a senha para a pessoa entrar em /admin.`,
      });
    } catch (err) {
      setFeedback({ type: 'error', text: mapRegistrationError(err) });
    } finally {
      await signOut(staffAuth).catch(() => undefined);
      setIsSaving(false);
    }
  };

  const handleToggle = async (member: StaffMember) => {
    setBusyUid(member.uid);
    setFeedback(null);
    try {
      await updateDoc(doc(db, 'admins', member.uid), {
        ativo: !member.ativo,
        updatedAt: serverTimestamp(),
      });
      setFeedback({
        type: 'success',
        text: member.ativo
          ? `O acesso de ${member.nome} foi desativado.`
          : `O acesso de ${member.nome} foi reativado.`,
      });
    } catch {
      setFeedback({ type: 'error', text: 'Não foi possível alterar o acesso agora.' });
    } finally {
      setBusyUid(null);
    }
  };

  const handleResetPassword = async (member: StaffMember) => {
    setBusyUid(member.uid);
    setFeedback(null);
    try {
      await sendPasswordResetEmail(auth, member.email);
      setFeedback({
        type: 'success',
        text: `Enviamos um e-mail de redefinição de senha para ${member.email}.`,
      });
    } catch {
      setFeedback({ type: 'error', text: 'Não foi possível enviar o e-mail de redefinição.' });
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FCEEF2] text-[#D81B60]">
          <Users className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-[#3A150B]">Equipe e acessos</h2>
          <p className="text-xs text-[#3A150B]/65">
            Cadastre as pessoas que podem entrar no painel para receber e imprimir os pedidos.
            Elas não acessam produtos nem a equipe.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleRegister}
        className="grid gap-4 rounded-2xl border border-[#D81B60]/15 bg-[#FFF8FB] p-4 sm:grid-cols-2 sm:p-5"
      >
        <div>
          <label htmlFor="team-nome" className="block text-xs font-semibold text-[#3A150B]">
            Nome
          </label>
          <input
            id="team-nome"
            type="text"
            autoComplete="off"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Maria (balcão)"
            maxLength={120}
            className="mt-1 w-full rounded-xl border border-[#3A150B]/15 bg-white px-3 py-2.5 text-sm text-[#3A150B] placeholder:text-[#3A150B]/40 focus:border-[#D81B60] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="team-email" className="block text-xs font-semibold text-[#3A150B]">
            E-mail de acesso
          </label>
          <div className="relative mt-1">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3A150B]/45"
              aria-hidden="true"
            />
            <input
              id="team-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="atendente@email.com"
              className="w-full rounded-xl border border-[#3A150B]/15 bg-white py-2.5 pl-9 pr-3 text-sm text-[#3A150B] placeholder:text-[#3A150B]/40 focus:border-[#D81B60] focus:outline-none"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="team-senha" className="block text-xs font-semibold text-[#3A150B]">
            Senha inicial
          </label>
          <div className="relative mt-1">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3A150B]/45"
              aria-hidden="true"
            />
            <input
              id="team-senha"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo de 6 caracteres"
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

        {feedback && (
          <p
            role={feedback.type === 'error' ? 'alert' : 'status'}
            className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium sm:col-span-2 ${
              feedback.type === 'error'
                ? 'border-[#EF4444]/25 bg-[#FEF2F2] text-[#B91C1C]'
                : 'border-[#16A34A]/25 bg-[#F0FDF4] text-[#15803D]'
            }`}
          >
            {feedback.text}
          </p>
        )}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#D81B60] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#AD1457] disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Cadastrando...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                Cadastrar pessoa
              </>
            )}
          </button>
        </div>
      </form>

      <section aria-label="Pessoas cadastradas">
        <h3 className="mb-3 text-sm font-bold text-[#3A150B]">
          Pessoas cadastradas ({members.length})
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-[#3A150B]/10 bg-[#FFF8FB] p-8 text-sm text-[#3A150B]/75">
            <Loader2 className="h-5 w-5 animate-spin text-[#D81B60]" aria-hidden="true" />
            Carregando equipe...
          </div>
        ) : loadError ? (
          <p
            role="alert"
            className="rounded-xl border border-[#EF4444]/25 bg-[#FEF2F2] px-4 py-3 text-xs font-medium text-[#B91C1C]"
          >
            {loadError}
          </p>
        ) : members.length === 0 ? (
          <div className="rounded-2xl border border-[#3A150B]/10 bg-[#FFF8FB] p-8 text-center text-sm text-[#3A150B]/70">
            Ninguém cadastrado ainda. Use o formulário acima para liberar o primeiro acesso.
          </div>
        ) : (
          <ul className="grid gap-3">
            {members.map((member) => (
              <li
                key={member.uid}
                className="flex flex-col gap-3 rounded-2xl border border-[#3A150B]/10 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#3A150B]">
                    <span className="truncate">{member.nome}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        member.ativo
                          ? 'bg-[#DCFCE7] text-[#15803D]'
                          : 'bg-[#E5E7EB] text-[#4B5563]'
                      }`}
                    >
                      {member.ativo ? 'Ativo' : 'Desativado'}
                    </span>
                  </p>
                  <p className="truncate text-xs text-[#3A150B]/65">{member.email}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleResetPassword(member)}
                    disabled={busyUid === member.uid}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#3A150B]/20 bg-white px-3 py-2 text-xs font-bold text-[#3A150B] transition-colors hover:bg-[#FCEEF2] disabled:opacity-60"
                  >
                    <KeyRound className="h-4 w-4 text-[#D81B60]" aria-hidden="true" />
                    Redefinir senha
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggle(member)}
                    disabled={busyUid === member.uid}
                    className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors disabled:opacity-60 ${
                      member.ativo
                        ? 'border border-[#DC2626]/30 bg-white text-[#B91C1C] hover:bg-[#FEF2F2]'
                        : 'bg-[#16A34A] text-white hover:bg-[#15803D]'
                    }`}
                  >
                    {member.ativo ? (
                      <>
                        <UserX className="h-4 w-4" aria-hidden="true" />
                        Desativar
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4" aria-hidden="true" />
                        Reativar
                      </>
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
