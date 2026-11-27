import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Ocorreu um erro inesperado.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Erro capturado pelo ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendlyHint =
        'Não foi possível concluir a operação no banco de dados. Recarregue a página e tente novamente.';
      if (this.state.errorMessage.includes('Missing or insufficient permissions')) {
        friendlyHint =
          'Permissão insuficiente no Firestore. Confirme se o e-mail do administrador está verificado ou se o UID está cadastrado na coleção "admins".';
      } else if (this.state.errorMessage.includes('Quota exceeded')) {
        friendlyHint =
          'A cota gratuita diária do Firestore foi atingida. Tente novamente amanhã ou verifique o plano no Console do Firebase.';
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-[#FFF0F6] p-6 text-[#3A150B]">
          <div className="w-full max-w-md rounded-2xl border border-[#D81B60]/25 bg-white p-6 text-center shadow-lg">
            <h1 className="font-hand text-3xl font-bold text-[#D81B60]">
              Atenção
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#3A150B]/80">
              {friendlyHint}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex min-h-[42px] items-center justify-center rounded-lg bg-[#D81B60] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#AD1457]"
            >
              Voltar para a loja
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
