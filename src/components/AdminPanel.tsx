import React, { useState, useRef, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import {
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Upload,
  Check,
  X,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  Link2,
  BellRing,
  Printer,
  CheckCircle2,
  MessageCircle,
  Package,
  ClipboardList,
  Volume2,
  Clock,
  MapPin,
  Store,
  ExternalLink,
} from 'lucide-react';
import { User, signOut, sendEmailVerification } from 'firebase/auth';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { Order, OrderItem, OrderStatus, Product, ProductCategory } from '../data/products';
import { formatBRL } from './CartDrawer';

interface AdminPanelProps {
  user: User;
  products: Product[];
  onRequestPrintOrder: (order: Order) => void;
}

type AdminTab = 'produtos' | 'pedidos';
type OrderFilter = 'todos' | OrderStatus;

const CATEGORY_OPTIONS: Exclude<ProductCategory, 'Todos'>[] = [
  'Bolos',
  'Doces',
  'Cupcakes & Potes',
];

const AUTO_PRINT_STORAGE_KEY = 'delicia-esther:auto-print';
const MAX_IMAGE_WIDTH = 600;
const JPEG_QUALITY = 0.7;
const MAX_BASE64_LENGTH = 450000;

function compressImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo inválido ou corrompido.'));
      img.onload = () => {
        const scale = img.width > MAX_IMAGE_WIDTH ? MAX_IMAGE_WIDTH / img.width : 1;
        const targetWidth = Math.max(1, Math.round(img.width * scale));
        const targetHeight = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível inicializar o Canvas no navegador.'));
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        let dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        if (dataUrl.length > MAX_BASE64_LENGTH) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.52);
        }
        if (dataUrl.length > MAX_BASE64_LENGTH) {
          reject(
            new Error(
              'A imagem comprimida ainda ficou grande demais para o Firestore. Tente outra foto ou cole um link.'
            )
          );
          return;
        }

        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function buildCustomerWhatsappHref(order: Order): string {
  const digits = order.clienteWhatsapp.replace(/\D/g, '');
  const normalizedPhone =
    digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;

  const statusText =
    order.status === 'concluido'
      ? 'está pronto / concluído!'
      : order.status === 'em_preparo'
        ? 'já está em preparo com muito carinho!'
        : 'foi recebido e confirmado!';

  const message = `Olá, *${order.clienteNome}*! Aqui é da *Delícia da Esther — Bolos e Doces*. Seu pedido *#${order.numeroPedido}* (no valor de ${formatBRL(order.total)}) ${statusText}`;

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  user,
  products,
  onRequestPrintOrder,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('pedidos');

  // Product form states
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState<Exclude<ProductCategory, 'Todos'>>('Bolos');
  const [porcao, setPorcao] = useState('');
  const [descricao, setDescricao] = useState('');
  const [preco, setPreco] = useState('');
  const [compressedBase64, setCompressedBase64] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  // Real-time Orders states
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('todos');
  const [autoPrintEnabled, setAutoPrintEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(AUTO_PRINT_STORAGE_KEY) !== 'false';
  });
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [orderActionMessage, setOrderActionMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const voiceAudioUrlRef = useRef<string | null>(null);
  const voiceFetchPromiseRef = useRef<Promise<string | null> | null>(null);
  const autoPrintEnabledRef = useRef(autoPrintEnabled);
  const hasInitialOrdersSnapshotRef = useRef(false);
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const autoPrintedOrderIdsRef = useRef<Set<string>>(new Set());
  const autoPrintedLocalTimesRef = useRef<Map<string, number>>(new Map());

  const printQueueRef = useRef<Order[]>([]);
  const isPrintingRef = useRef(false);
  const onRequestPrintOrderRef = useRef(onRequestPrintOrder);
  onRequestPrintOrderRef.current = onRequestPrintOrder;

  useEffect(() => {
    autoPrintEnabledRef.current = autoPrintEnabled;
    window.localStorage.setItem(AUTO_PRINT_STORAGE_KEY, String(autoPrintEnabled));
  }, [autoPrintEnabled]);

  const loadCommercialVoiceUrl = useCallback(async (): Promise<string | null> => {
    if (voiceAudioUrlRef.current) {
      return voiceAudioUrlRef.current;
    }
    if (voiceFetchPromiseRef.current) {
      return voiceFetchPromiseRef.current;
    }

    voiceFetchPromiseRef.current = (async () => {
      try {
        const res = await fetch('/api/voice-alert');
        if (!res.ok) return null;
        const blob = await res.blob();
        if (!blob.size) return null;
        const objectUrl = URL.createObjectURL(blob);
        voiceAudioUrlRef.current = objectUrl;
        return objectUrl;
      } catch {
        return null;
      } finally {
        voiceFetchPromiseRef.current = null;
      }
    })();

    return voiceFetchPromiseRef.current;
  }, []);

  useEffect(() => {
    void loadCommercialVoiceUrl();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const warmVoices = () => {
        window.speechSynthesis.getVoices();
      };
      warmVoices();
      window.speechSynthesis.addEventListener?.('voiceschanged', warmVoices);
      return () => {
        window.speechSynthesis.removeEventListener?.('voiceschanged', warmVoices);
        if (voiceAudioUrlRef.current) {
          URL.revokeObjectURL(voiceAudioUrlRef.current);
          voiceAudioUrlRef.current = null;
        }
      };
    }
    return () => {
      if (voiceAudioUrlRef.current) {
        URL.revokeObjectURL(voiceAudioUrlRef.current);
        voiceAudioUrlRef.current = null;
      }
    };
  }, [loadCommercialVoiceUrl]);

  const speakBrowserFallback = useCallback(() => {
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

      const synth = window.speechSynthesis;
      const voices = synth.getVoices();
      const ptBrVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('pt-br'));
      const ptVoices =
        ptBrVoices.length > 0
          ? ptBrVoices
          : voices.filter((v) => v.lang.toLowerCase().startsWith('pt'));

      const femaleRegex =
        /maria|francisca|thalita|hel[oô]|luciana|vit[oó]ria|camila|fernanda|raquel|joana|alice|let[ií]cia|isabela|sofia|female|mulher|feminina|google portugu[eê]s/i;
      const maleRegex =
        /\b(daniel|ant[oô]nio|ricardo|felipe|f[aá]bio|humberto|tiago|nicolau|duarte|cristiano|male|homem)\b/i;

      const selectedVoice =
        ptVoices.find((v) => femaleRegex.test(v.name)) ||
        ptVoices.find((v) => !maleRegex.test(v.name)) ||
        ptVoices[0] ||
        null;

      const utterance = new SpeechSynthesisUtterance('Pedido online!');
      utterance.lang = 'pt-BR';
      utterance.rate = 1.02;
      utterance.volume = 1;

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.pitch = femaleRegex.test(selectedVoice.name) ? 1.15 : 1.3;
      } else {
        utterance.pitch = 1.3;
      }

      synth.cancel();
      synth.speak(utterance);
    } catch {
      // Ignore speech synthesis restriction errors safely
    }
  }, []);

  const playOrderBellChime = useCallback(() => {
    void (async () => {
      try {
        const audioUrl = await loadCommercialVoiceUrl();
        if (audioUrl) {
          const audio = new Audio(audioUrl);
          audio.volume = 1;
          await audio.play();
          return;
        }
      } catch {
        // Fallback to browser TTS below
      }
      speakBrowserFallback();
    })();
  }, [loadCommercialVoiceUrl, speakBrowserFallback]);

  // Prints queued receipts one at a time so each new order gets its own coupon,
  // even when several orders arrive in the same Firestore snapshot.
  const processPrintQueue = useCallback(() => {
    if (isPrintingRef.current) return;
    const nextOrder = printQueueRef.current.shift();
    if (!nextOrder) return;

    isPrintingRef.current = true;
    flushSync(() => onRequestPrintOrderRef.current(nextOrder));

    const finishPrint = () => {
      if (!isPrintingRef.current) return;
      isPrintingRef.current = false;
      window.setTimeout(processPrintQueue, 400);
    };

    window.addEventListener('afterprint', finishPrint, { once: true });
    window.requestAnimationFrame(() => {
      window.print();
      const supportsAfterPrint = 'onafterprint' in window;
      if (!supportsAfterPrint) {
        setTimeout(finishPrint, 1500);
      }
    });
  }, []);

  const triggerPrintReceipt = useCallback(
    (order: Order) => {
      printQueueRef.current.push(order);
      processPrintQueue();
    },
    [processPrintQueue]
  );

  const handleTestPrint = useCallback(() => {
    const nowMs = Date.now();
    triggerPrintReceipt({
      id: 'teste-impressao',
      numeroPedido: 'TESTE-01',
      clienteNome: 'Teste de Impressora 80mm',
      clienteWhatsapp: '(69) 99262-2250',
      modoEntrega: 'retirada',
      endereco: '',
      formaPagamento: 'Pix',
      itens: [
        {
          nome: 'Bolo de Teste (Cupom Térmico 80mm)',
          sabor: 'Chocolate Gourmet',
          quantidade: 1,
          preco: 1.0,
          observacao: 'Teste rápido de impressão em 1 clique',
        },
      ],
      subtotal: 1.0,
      taxaEntrega: 0,
      total: 1.0,
      observacoes: 'Impressão de teste realizada pelo Painel do Administrador.',
      status: 'em_preparo',
      createdAtMs: nowMs,
    });
  }, [triggerPrintReceipt]);

  // Real-time onSnapshot listener on Firestore collection 'pedidos'
  useEffect(() => {
    if (!user.emailVerified) {
      setIsLoadingOrders(false);
      return;
    }

    const pedidosQuery = query(collection(db, 'pedidos'), orderBy('createdAt', 'desc'));
    const unsubscribeOrders = onSnapshot(
      pedidosQuery,
      (snapshot) => {
        const parsedOrders: Order[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const rawStatus = String(data.status || 'novo');
          const status: OrderStatus =
            rawStatus === 'em_preparo' || rawStatus === 'concluido' ? rawStatus : 'novo';

          const rawItens = Array.isArray(data.itens) ? data.itens : [];
          const itens: OrderItem[] = rawItens.map((item: Record<string, unknown>) => ({
            nome: String(item.nome || 'Produto'),
            sabor: item.sabor ? String(item.sabor) : undefined,
            quantidade: Number(item.quantidade || 1),
            preco: Number(item.preco || 0),
            observacao: item.observacao ? String(item.observacao) : undefined,
          }));

          const createdAtTimestamp = data.createdAt as { toMillis?: () => number } | undefined;
          const createdAtMs =
            createdAtTimestamp && typeof createdAtTimestamp.toMillis === 'function'
              ? createdAtTimestamp.toMillis()
              : Date.now();

          const autoPrintedTimestamp = data.autoPrintedAt as { toMillis?: () => number } | undefined;
          const autoPrintedAtMs =
            autoPrintedTimestamp && typeof autoPrintedTimestamp.toMillis === 'function'
              ? autoPrintedTimestamp.toMillis()
              : autoPrintedLocalTimesRef.current.get(docSnap.id);

          const rawPayment = String(data.formaPagamento || 'Pix');
          const formaPagamento: Order['formaPagamento'] =
            rawPayment === 'Cartão na entrega' || rawPayment === 'Dinheiro'
              ? rawPayment
              : 'Pix';

          return {
            id: docSnap.id,
            numeroPedido: String(data.numeroPedido || docSnap.id.slice(0, 6).toUpperCase()),
            clienteNome: String(data.clienteNome || 'Cliente'),
            clienteWhatsapp: String(data.clienteWhatsapp || ''),
            modoEntrega: data.modoEntrega === 'retirada' ? 'retirada' : 'entrega',
            endereco: String(data.endereco || ''),
            formaPagamento,
            itens,
            subtotal: Number(data.subtotal || 0),
            taxaEntrega: Number(data.taxaEntrega || 0),
            total: Number(data.total || 0),
            observacoes: data.observacoes ? String(data.observacoes) : undefined,
            status,
            autoPrintedAtMs,
            createdAtMs,
          };
        });

        setOrders(parsedOrders);
        setIsLoadingOrders(false);

        if (!hasInitialOrdersSnapshotRef.current) {
          hasInitialOrdersSnapshotRef.current = true;
          parsedOrders.forEach((order) => seenOrderIdsRef.current.add(order.id));
          return;
        }

        const newlyArrivedNewOrders = parsedOrders.filter(
          (order) => !seenOrderIdsRef.current.has(order.id) && order.status === 'novo'
        );

        parsedOrders.forEach((order) => seenOrderIdsRef.current.add(order.id));

        if (newlyArrivedNewOrders.length > 0) {
          playOrderBellChime();

          if (autoPrintEnabledRef.current) {
            const ordersToPrint = newlyArrivedNewOrders
              .filter((o) => !autoPrintedOrderIdsRef.current.has(o.id) && !o.autoPrintedAtMs)
              .sort((a, b) => a.createdAtMs - b.createdAtMs);

            ordersToPrint.forEach((o) => {
              const printedNowMs = Date.now();
              autoPrintedOrderIdsRef.current.add(o.id);
              autoPrintedLocalTimesRef.current.set(o.id, printedNowMs);
              void updateDoc(doc(db, 'pedidos', o.id), {
                status: 'em_preparo',
                autoPrintedAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              }).catch((err) => {
                try {
                  handleFirestoreError(err, OperationType.UPDATE, `pedidos/${o.id}`);
                } catch (wrapped) {
                  setFatalError(wrapped as Error);
                }
              });

              triggerPrintReceipt({
                ...o,
                status: 'em_preparo',
                autoPrintedAtMs: printedNowMs,
              });
            });
          }
        }
      },
      (error) => {
        setIsLoadingOrders(false);
        try {
          handleFirestoreError(error, OperationType.LIST, 'pedidos');
        } catch (wrapped) {
          setFatalError(wrapped as Error);
        }
      }
    );

    return () => unsubscribeOrders();
  }, [user.emailVerified, playOrderBellChime, triggerPrintReceipt]);

  if (fatalError) {
    throw fatalError;
  }

  const effectiveImage = compressedBase64 || imageUrlInput.trim() || editingProduct?.image || '';
  const pendingOrders = orders.filter((o) => o.status === 'novo');
  const filteredOrders =
    orderFilter === 'todos' ? orders : orders.filter((o) => o.status === orderFilter);

  const handleUpdateOrderStatus = async (order: Order, nextStatus: OrderStatus) => {
    setUpdatingOrderId(order.id);
    setOrderActionMessage(null);
    try {
      await updateDoc(doc(db, 'pedidos', order.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      setOrderActionMessage(
        nextStatus === 'concluido'
          ? `Pedido #${order.numeroPedido} marcado como concluído!`
          : `Pedido #${order.numeroPedido} movido para em preparo.`
      );
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, `pedidos/${order.id}`);
      } catch (wrapped) {
        setFatalError(wrapped as Error);
      }
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const resetForm = () => {
    setEditingProduct(null);
    setNome('');
    setCategoria('Bolos');
    setPorcao('');
    setDescricao('');
    setPreco('');
    setCompressedBase64('');
    setImageUrlInput('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectEdit = (product: Product) => {
    setEditingProduct(product);
    setNome(product.name);
    setCategoria(product.category);
    setPorcao(product.portion || '');
    setDescricao(product.description);
    setPreco(String(product.price));
    if (product.image.startsWith('data:image/')) {
      setCompressedBase64(product.image);
      setImageUrlInput('');
    } else {
      setCompressedBase64('');
      setImageUrlInput(product.image);
    }
    setStatusMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatusMessage({ type: 'error', text: 'Selecione apenas arquivos de imagem (JPG, PNG, WEBP).' });
      return;
    }

    setIsCompressing(true);
    setStatusMessage(null);
    try {
      const base64 = await compressImageToBase64(file);
      setCompressedBase64(base64);
      setImageUrlInput('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar imagem.';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsCompressing(false);
    }
  };

  const handleUrlInputChange = (value: string) => {
    setImageUrlInput(value);
    if (value.trim()) {
      setCompressedBase64('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const trimmedNome = nome.trim();
    const trimmedDesc = descricao.trim();
    const trimmedPorcao = porcao.trim();
    const numericPreco = Number(preco.replace(',', '.'));
    const finalImage = compressedBase64 || imageUrlInput.trim() || editingProduct?.image || '';

    if (trimmedNome.length < 2 || trimmedNome.length > 120) {
      setStatusMessage({ type: 'error', text: 'O nome deve ter entre 2 e 120 caracteres.' });
      return;
    }
    if (trimmedDesc.length < 2 || trimmedDesc.length > 600) {
      setStatusMessage({ type: 'error', text: 'A descrição deve ter entre 2 e 600 caracteres.' });
      return;
    }
    if (!Number.isFinite(numericPreco) || numericPreco <= 0 || numericPreco > 100000) {
      setStatusMessage({ type: 'error', text: 'Informe um preço válido maior que R$ 0,00.' });
      return;
    }
    if (!finalImage) {
      setStatusMessage({
        type: 'error',
        text: 'Escolha uma foto do computador/celular ou cole o link (URL) de uma imagem.',
      });
      return;
    }
    if (finalImage.length > MAX_BASE64_LENGTH) {
      setStatusMessage({
        type: 'error',
        text: 'A imagem ou URL excede o tamanho máximo permitido para salvar no Firestore.',
      });
      return;
    }

    setIsSaving(true);
    try {
      if (editingProduct) {
        const docRef = doc(db, 'produtos', editingProduct.id);
        const updatePayload: Record<string, unknown> = {
          nome: trimmedNome,
          descricao: trimmedDesc,
          preco: numericPreco,
          imagemUrl: finalImage,
          categoria,
          updatedAt: serverTimestamp(),
        };
        if (trimmedPorcao) {
          updatePayload.porcao = trimmedPorcao.slice(0, 80);
        }

        try {
          await updateDoc(docRef, updatePayload);
        } catch (err) {
          try {
            handleFirestoreError(err, OperationType.UPDATE, `produtos/${editingProduct.id}`);
          } catch (wrapped) {
            setFatalError(wrapped as Error);
            return;
          }
        }
        setStatusMessage({ type: 'success', text: `"${trimmedNome}" atualizado com sucesso!` });
      } else {
        const createPayload: Record<string, unknown> = {
          nome: trimmedNome,
          descricao: trimmedDesc,
          preco: numericPreco,
          imagemUrl: finalImage,
          categoria,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (trimmedPorcao) {
          createPayload.porcao = trimmedPorcao.slice(0, 80);
        }

        try {
          await addDoc(collection(db, 'produtos'), createPayload);
        } catch (err) {
          try {
            handleFirestoreError(err, OperationType.CREATE, 'produtos');
          } catch (wrapped) {
            setFatalError(wrapped as Error);
            return;
          }
        }
        setStatusMessage({ type: 'success', text: `"${trimmedNome}" cadastrado na vitrine!` });
      }

      resetForm();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (product: Product) => {
    try {
      await deleteDoc(doc(db, 'produtos', product.id));
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.DELETE, `produtos/${product.id}`);
      } catch (wrapped) {
        setFatalError(wrapped as Error);
        return;
      }
    }

    if (editingProduct?.id === product.id) {
      resetForm();
    }
    setConfirmDeleteId(null);
    setStatusMessage({ type: 'success', text: `"${product.name}" foi excluído da vitrine.` });
  };

  const handleSendVerification = async () => {
    try {
      await sendEmailVerification(user);
      setVerificationSent(true);
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Não foi possível enviar o e-mail de verificação agora. Tente novamente em instantes.',
      });
    }
  };

  const handleReloadVerification = async () => {
    setIsCheckingVerification(true);
    try {
      await user.reload();
      await user.getIdToken(true);
      window.location.reload();
    } finally {
      setIsCheckingVerification(false);
    }
  };

  const approxKb = compressedBase64 ? Math.round((compressedBase64.length * 0.75) / 1024) : null;

  return (
    <div
      id="painel-admin"
      className="min-h-screen bg-[#FFF8FB] text-[#3A150B]"
      aria-label="Painel Administrativo"
    >
      {/* Clean Sticky Top Bar */}
      <header className="sticky top-0 z-30 border-b border-[#D81B60]/15 bg-white shadow-sm">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-3 px-4 py-3.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          {/* 1. Title: Painel Administrativo */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FCEEF2] text-[#D81B60]">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold leading-tight text-[#3A150B] sm:text-xl">
                  Painel Administrativo
                </h1>
                <p className="text-[11px] text-[#3A150B]/65">
                  Conectado como <strong>{user.email}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* 2. Tabs: Pedidos / Notificações | Gerenciar Produtos */}
          <nav
            aria-label="Seções do painel administrativo"
            className="flex flex-wrap items-center gap-2"
          >
            <button
              type="button"
              onClick={() => setActiveTab('pedidos')}
              className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors sm:text-sm ${
                activeTab === 'pedidos'
                  ? 'bg-[#D81B60] text-white shadow-sm'
                  : 'border border-[#3A150B]/15 bg-[#FFF8FB] text-[#3A150B] hover:bg-[#FCEEF2]'
              }`}
            >
              <ClipboardList className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Pedidos Online</span>
              {pendingOrders.length > 0 && (
                <span
                  className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-extrabold tabular-nums ${
                    activeTab === 'pedidos'
                      ? 'bg-white text-[#D81B60]'
                      : 'bg-[#DC2626] text-white'
                  }`}
                >
                  {pendingOrders.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('produtos')}
              className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors sm:text-sm ${
                activeTab === 'produtos'
                  ? 'bg-[#D81B60] text-white shadow-sm'
                  : 'border border-[#3A150B]/15 bg-[#FFF8FB] text-[#3A150B] hover:bg-[#FCEEF2]'
              }`}
            >
              <Package className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Gerenciar Produtos ({products.length})</span>
            </button>
          </nav>

          {/* 3. Actions: Ver Loja (new tab) + Sair (Logout) */}
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="/?vitrine=1"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[#D81B60]/30 bg-[#FFF8FB] px-3.5 py-2 text-xs font-bold text-[#D81B60] transition-colors hover:bg-[#FCEEF2] whitespace-nowrap"
            >
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
              Ver Loja
            </a>

            <button
              type="button"
              onClick={() => signOut(auth)}
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[#3A150B]/20 bg-white px-3.5 py-2 text-xs font-bold text-[#3A150B] transition-colors hover:bg-[#FEF2F2] hover:border-[#DC2626]/35 hover:text-[#B91C1C] whitespace-nowrap"
            >
              <LogOut className="h-4 w-4 text-[#D81B60]" aria-hidden="true" />
              Sair (Logout)
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[#D81B60]/20 bg-white p-5 shadow-sm sm:p-7">
          {/* Email verification notice if unverified */}
          {!user.emailVerified && (
            <div className="mb-6 flex flex-col gap-3 rounded-xl border border-[#F59E0B]/40 bg-[#FFFBEB] p-4 text-xs text-[#92400E] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D97706]" aria-hidden="true" />
                <div>
                  <p className="font-bold">E-mail ainda não verificado</p>
                  <p className="mt-0.5">
                    Para acessar os pedidos e gravar produtos com segurança, verifique seu e-mail{' '}
                    <strong>{user.email}</strong> e depois recarregue.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSendVerification}
                  disabled={verificationSent}
                  className="rounded-lg bg-[#D97706] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#B45309] disabled:opacity-60 whitespace-nowrap"
                >
                  {verificationSent ? 'E-mail enviado!' : 'Enviar verificação'}
                </button>
                <button
                  type="button"
                  onClick={handleReloadVerification}
                  disabled={isCheckingVerification}
                  className="rounded-lg border border-[#D97706]/40 bg-white px-3 py-2 text-xs font-semibold text-[#92400E] hover:bg-[#FEF3C7] whitespace-nowrap"
                >
                  {isCheckingVerification ? 'Verificando...' : 'Já verifiquei'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: REAL-TIME ORDERS PANEL */}
          {activeTab === 'pedidos' && (
            <div className="space-y-5">
              {/* Prominent Visual Status Bar at the Top */}
              <div
                role="status"
                aria-live="polite"
                className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 px-5 py-3.5 shadow-sm transition-colors ${
                  autoPrintEnabled
                    ? 'border-[#15803D] bg-[#16A34A] text-white'
                    : 'border-[#D1D5DB] bg-[#E5E7EB] text-[#374151]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      autoPrintEnabled ? 'bg-white/20 text-white' : 'bg-white text-[#4B5563]'
                    }`}
                  >
                    <Printer className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold tracking-wide uppercase">
                      {autoPrintEnabled
                        ? 'IMPRESSÃO AUTOMÁTICA ATIVA'
                        : 'MODO MANUAL (Apenas Alerta na Tela)'}
                    </p>
                    <p
                      className={`text-xs ${
                        autoPrintEnabled ? 'text-white/90' : 'text-[#4B5563]'
                      }`}
                    >
                      {autoPrintEnabled
                        ? 'Novos pedidos serão impressos automaticamente em cupom 80mm e marcados como Em Preparo.'
                        : 'Novos pedidos tocam o alerta de voz e aguardam clique manual em Imprimir Cupom.'}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider ${
                    autoPrintEnabled
                      ? 'bg-white text-[#15803D]'
                      : 'bg-[#374151] text-white'
                  }`}
                >
                  {autoPrintEnabled ? 'Modo Ocupado ON' : 'Manual'}
                </span>
              </div>

              {/* Top Controls Bar: Auto-Print Toggle + Imprimir Teste + Testar Voz + Filters */}
              <div className="flex flex-col gap-4 rounded-2xl border border-[#D81B60]/20 bg-[#FFF8FB] p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Auto-print toggle switch */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={autoPrintEnabled}
                      id="auto-print-toggle"
                      onClick={() => {
                        if (!autoPrintEnabled) {
                          playOrderBellChime();
                        }
                        setAutoPrintEnabled((prev) => !prev);
                      }}
                      className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D81B60] ${
                        autoPrintEnabled ? 'bg-[#16A34A]' : 'bg-[#3A150B]/25'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                          autoPrintEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <label
                      htmlFor="auto-print-toggle"
                      className="cursor-pointer select-none"
                    >
                      <span className="flex items-center gap-1.5 text-sm font-bold text-[#3A150B]">
                        Impressão Automática
                      </span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleTestPrint}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#3A150B]/20 bg-white px-3 py-1.5 text-xs font-bold text-[#3A150B] transition-colors hover:bg-[#FCEEF2]"
                  >
                    <Printer className="h-3.5 w-3.5 text-[#D81B60]" aria-hidden="true" />
                    Imprimir Teste
                  </button>

                  <button
                    type="button"
                    onClick={playOrderBellChime}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#D81B60]/25 bg-white px-3 py-1.5 text-xs font-semibold text-[#D81B60] transition-colors hover:bg-[#FCEEF2]"
                  >
                    <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Testar voz comercial
                  </button>
                </div>

                {/* Status Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-white p-1 border border-[#3A150B]/10">
                  {(
                    [
                      { id: 'todos', label: `Todos (${orders.length})` },
                      { id: 'novo', label: `Novos (${pendingOrders.length})` },
                      {
                        id: 'em_preparo',
                        label: `Em preparo (${orders.filter((o) => o.status === 'em_preparo').length})`,
                      },
                      {
                        id: 'concluido',
                        label: `Concluídos (${orders.filter((o) => o.status === 'concluido').length})`,
                      },
                    ] as { id: OrderFilter; label: string }[]
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setOrderFilter(tab.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        orderFilter === tab.id
                          ? 'bg-[#D81B60] text-white'
                          : 'text-[#3A150B]/75 hover:bg-[#FCEEF2]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prominent Visual Alert Banner for Pending ('novo') Orders */}
              {pendingOrders.length > 0 && (
                <div
                  role="alert"
                  className="flex flex-col gap-3 rounded-2xl border-2 border-[#DC2626]/50 bg-[#FEF2F2] p-4 text-[#991B1B] shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#DC2626] text-white animate-pulse">
                      <BellRing className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold">
                        {pendingOrders.length}{' '}
                        {pendingOrders.length === 1
                          ? 'novo pedido pendente aguardando atendimento!'
                          : 'novos pedidos pendentes aguardando atendimento!'}
                      </p>
                      <p className="text-xs text-[#991B1B]/85">
                        Confira os detalhes abaixo para imprimir o cupom, preparar ou concluir o pedido.
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#DC2626] px-3.5 py-1 text-xs font-extrabold tabular-nums text-white">
                    {pendingOrders.length} {pendingOrders.length === 1 ? 'pendente' : 'pendentes'}
                  </span>
                </div>
              )}

              {orderActionMessage && (
                <p
                  role="status"
                  className="rounded-xl border border-[#16A34A]/25 bg-[#F0FDF4] px-4 py-2.5 text-xs font-semibold text-[#15803D]"
                >
                  {orderActionMessage}
                </p>
              )}

              {/* Orders List */}
              {!user.emailVerified ? (
                <div className="rounded-2xl border border-[#3A150B]/10 bg-[#FFF8FB] p-8 text-center text-sm text-[#3A150B]/75">
                  Verifique seu e-mail de administrador acima para visualizar os pedidos em tempo real.
                </div>
              ) : isLoadingOrders ? (
                <div className="flex items-center justify-center gap-2.5 rounded-2xl border border-[#3A150B]/10 bg-[#FFF8FB] p-10 text-sm font-medium text-[#3A150B]/75">
                  <Loader2 className="h-5 w-5 animate-spin text-[#D81B60]" aria-hidden="true" />
                  <span>Escutando novos pedidos em tempo real...</span>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="rounded-2xl border border-[#3A150B]/10 bg-[#FFF8FB] p-10 text-center">
                  <ClipboardList className="mx-auto h-8 w-8 text-[#D81B60]/60" aria-hidden="true" />
                  <p className="mt-2 text-sm font-semibold text-[#3A150B]/80">
                    Nenhum pedido encontrado nesta visualização.
                  </p>
                  <p className="mt-1 text-xs text-[#3A150B]/60">
                    Assim que um cliente finalizar uma encomenda no carrinho, ela aparecerá aqui automaticamente.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {filteredOrders.map((order) => {
                    const isNew = order.status === 'novo';
                    const isPreparing = order.status === 'em_preparo';
                    const isCompleted = order.status === 'concluido';
                    const formattedDate = new Date(order.createdAtMs).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    });

                    return (
                      <article
                        key={order.id}
                        className={`rounded-2xl border p-5 transition-shadow ${
                          isNew
                            ? 'border-2 border-[#DC2626]/55 bg-[#FFFBFB] shadow-md'
                            : isPreparing
                              ? 'border-[#D97706]/40 bg-[#FFFDF7] shadow-sm'
                              : 'border-[#3A150B]/15 bg-white shadow-sm'
                        }`}
                      >
                        {/* Order Header */}
                        <div className="flex flex-col gap-3 border-b border-[#3A150B]/10 pb-3.5 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="text-base font-extrabold text-[#3A150B]">
                              Pedido #{order.numeroPedido}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                isNew
                                  ? 'bg-[#DC2626] text-white'
                                  : isPreparing
                                    ? 'bg-[#FEF3C7] text-[#92400E]'
                                    : 'bg-[#DCFCE7] text-[#15803D]'
                              }`}
                            >
                              {isNew ? (
                                <>
                                  <BellRing className="h-3 w-3" aria-hidden="true" />
                                  Novo
                                </>
                              ) : isPreparing ? (
                                <>
                                  <Clock className="h-3 w-3" aria-hidden="true" />
                                  Em preparo
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                  Concluído
                                </>
                              )}
                            </span>
                            <span className="text-xs text-[#3A150B]/60">
                              {formattedDate}
                            </span>
                            {order.autoPrintedAtMs && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-[#16A34A]/35 bg-[#DCFCE7] px-2.5 py-0.5 text-xs font-bold text-[#15803D]">
                                <Printer className="h-3 w-3 shrink-0" aria-hidden="true" />
                                Impresso automaticamente às{' '}
                                {new Date(order.autoPrintedAtMs).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </span>
                            )}
                          </div>

                          <div className="text-right">
                            <span className="text-xs text-[#3A150B]/65">Total: </span>
                            <span className="text-lg font-extrabold tabular-nums text-[#D81B60]">
                              {formatBRL(order.total)}
                            </span>
                          </div>
                        </div>

                        {/* Customer + Items Details */}
                        <div className="mt-4 grid gap-4 md:grid-cols-12">
                          <div className="space-y-1.5 text-xs text-[#3A150B] md:col-span-5">
                            <p className="text-sm font-bold text-[#3A150B]">
                              {order.clienteNome}
                            </p>
                            <p className="text-[#3A150B]/80">
                              <strong>WhatsApp:</strong> {order.clienteWhatsapp}
                            </p>
                            <p className="flex items-start gap-1.5 text-[#3A150B]/80">
                              {order.modoEntrega === 'entrega' ? (
                                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D81B60]" aria-hidden="true" />
                              ) : (
                                <Store className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D81B60]" aria-hidden="true" />
                              )}
                              <span>
                                <strong>
                                  {order.modoEntrega === 'entrega' ? 'Entrega:' : 'Retirada no ateliê'}
                                </strong>{' '}
                                {order.modoEntrega === 'entrega' ? order.endereco : ''}
                              </span>
                            </p>
                            <p className="text-[#3A150B]/80">
                              <strong>Pagamento:</strong> {order.formaPagamento}
                            </p>
                            {order.observacoes && (
                              <p className="mt-1 rounded-lg bg-[#FCEEF2]/80 px-2.5 py-1.5 text-xs text-[#9D174D]">
                                <strong>Obs. Gerais:</strong> {order.observacoes}
                              </p>
                            )}
                          </div>

                          <div className="rounded-xl border border-[#3A150B]/10 bg-[#FFF8FB] p-3.5 md:col-span-7">
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#3A150B]/70">
                              Itens ({order.itens.reduce((s, i) => s + i.quantidade, 0)})
                            </p>
                            <ul className="space-y-1.5 text-xs">
                              {order.itens.map((item, idx) => (
                                <li
                                  key={`${order.id}-item-${idx}`}
                                  className="flex items-start justify-between gap-2 border-b border-[#3A150B]/8 pb-1.5 last:border-b-0 last:pb-0"
                                >
                                  <div>
                                    <span className="font-bold text-[#3A150B]">
                                      {item.quantidade}x {item.nome}
                                    </span>
                                    {item.sabor && (
                                      <span className="ml-1 text-[#3A150B]/70">
                                        ({item.sabor})
                                      </span>
                                    )}
                                    {item.observacao && (
                                      <p className="text-[11px] text-[#9D174D]">
                                        Obs: {item.observacao}
                                      </p>
                                    )}
                                  </div>
                                  <span className="shrink-0 font-semibold tabular-nums text-[#3A150B]">
                                    {formatBRL(item.preco * item.quantidade)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                            <div className="mt-2.5 flex justify-between border-t border-[#3A150B]/10 pt-2 text-xs text-[#3A150B]/75">
                              <span>
                                Subtotal: {formatBRL(order.subtotal)} ·{' '}
                                {order.taxaEntrega === 0
                                  ? 'Retirada Grátis'
                                  : `Entrega: ${formatBRL(order.taxaEntrega)}`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Manual Action Buttons */}
                        <div className="mt-4 flex flex-wrap items-center justify-end gap-2.5 border-t border-[#3A150B]/10 pt-4">
                          <button
                            type="button"
                            onClick={() => triggerPrintReceipt(order)}
                            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#3A150B]/20 bg-white px-4 py-1.5 text-xs font-bold text-[#3A150B] transition-colors hover:bg-[#FCEEF2]"
                          >
                            <Printer className="h-3.5 w-3.5 text-[#D81B60]" aria-hidden="true" />
                            Imprimir Cupom
                          </button>

                          {!isCompleted && (
                            <button
                              type="button"
                              disabled={updatingOrderId === order.id}
                              onClick={() => handleUpdateOrderStatus(order, 'concluido')}
                              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#D81B60] px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#AD1457] disabled:opacity-60"
                            >
                              {updatingOrderId === order.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              )}
                              Concluir Pedido
                            </button>
                          )}

                          <a
                            href={buildCustomerWhatsappHref(order)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#16A34A] px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#15803D]"
                          >
                            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                            Chamar no WhatsApp
                          </a>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PRODUCTS MANAGEMENT */}
          {activeTab === 'produtos' && (
            <>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-[#3A150B]">
                    {editingProduct ? `Editando: ${editingProduct.name}` : 'Adicionar Novo Produto'}
                  </h3>
                  {editingProduct && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#D81B60] hover:underline"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      Cancelar edição
                    </button>
                  )}
                </div>

                <div className="grid gap-5 lg:grid-cols-12">
                  {/* Image Picker (Canvas Base64 + Optional URL) */}
                  <div className="space-y-3 lg:col-span-4">
                    <label className="block text-xs font-semibold text-[#3A150B]">
                      Foto do Produto (salva no Firestore)
                    </label>
                    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#D81B60]/30 bg-[#FFF8FB] p-4 text-center">
                      {effectiveImage ? (
                        <img
                          src={effectiveImage}
                          alt="Pré-visualização do produto"
                          referrerPolicy="no-referrer"
                          className="mb-3 aspect-[4/3] w-full rounded-xl object-cover bg-white"
                        />
                      ) : (
                        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#FCEEF2] text-[#D81B60]">
                          <Upload className="h-5 w-5" aria-hidden="true" />
                        </div>
                      )}

                      <input
                        ref={fileInputRef}
                        id="admin-product-image"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="sr-only"
                      />
                      <label
                        htmlFor="admin-product-image"
                        className="inline-flex min-h-[38px] cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#D81B60]/30 bg-white px-4 py-1.5 text-xs font-semibold text-[#D81B60] transition-colors hover:bg-[#FCEEF2]"
                      >
                        {isCompressing ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            Comprimindo...
                          </>
                        ) : (
                          <>
                            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                            {effectiveImage ? 'Trocar foto do aparelho' : 'Escolher foto'}
                          </>
                        )}
                      </label>
                      <p className="mt-1.5 text-[11px] text-[#3A150B]/60">
                        Redimensionada para até 600px (JPEG leve)
                        {approxKb !== null ? ` · ~${approxKb} KB` : ''}
                      </p>
                    </div>

                    <div>
                      <label htmlFor="admin-prod-url" className="block text-xs font-semibold text-[#3A150B]">
                        Ou cole o link (URL) da imagem (opcional)
                      </label>
                      <div className="relative mt-1">
                        <Link2
                          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3A150B]/45"
                          aria-hidden="true"
                        />
                        <input
                          id="admin-prod-url"
                          type="url"
                          value={imageUrlInput}
                          onChange={(e) => handleUrlInputChange(e.target.value)}
                          placeholder="https://exemplo.com/foto-do-bolo.jpg"
                          className="w-full rounded-xl border border-[#3A150B]/15 bg-white py-2 pl-9 pr-3 text-xs text-[#3A150B] placeholder:text-[#3A150B]/40 focus:border-[#D81B60] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Fields */}
                  <div className="space-y-4 lg:col-span-8">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="admin-prod-name" className="block text-xs font-semibold text-[#3A150B]">
                          Nome do produto
                        </label>
                        <input
                          id="admin-prod-name"
                          type="text"
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          maxLength={120}
                          placeholder="Ex.: Bolo de Chocolate com Morangos"
                          className="mt-1 w-full rounded-xl border border-[#3A150B]/15 bg-white px-3 py-2.5 text-sm text-[#3A150B] focus:border-[#D81B60] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label htmlFor="admin-prod-price" className="block text-xs font-semibold text-[#3A150B]">
                          Preço (R$)
                        </label>
                        <input
                          id="admin-prod-price"
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={preco}
                          onChange={(e) => setPreco(e.target.value)}
                          placeholder="165.00"
                          className="mt-1 w-full rounded-xl border border-[#3A150B]/15 bg-white px-3 py-2.5 text-sm tabular-nums text-[#3A150B] focus:border-[#D81B60] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="admin-prod-cat" className="block text-xs font-semibold text-[#3A150B]">
                          Categoria
                        </label>
                        <select
                          id="admin-prod-cat"
                          value={categoria}
                          onChange={(e) => setCategoria(e.target.value as Exclude<ProductCategory, 'Todos'>)}
                          className="mt-1 w-full rounded-xl border border-[#3A150B]/15 bg-white px-3 py-2.5 text-sm text-[#3A150B] focus:border-[#D81B60] focus:outline-none"
                        >
                          {CATEGORY_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="admin-prod-portion" className="block text-xs font-semibold text-[#3A150B]">
                          Peso / Porção (opcional)
                        </label>
                        <input
                          id="admin-prod-portion"
                          type="text"
                          value={porcao}
                          onChange={(e) => setPorcao(e.target.value)}
                          maxLength={80}
                          placeholder="Ex.: 2 kg · Serve 18 fatias"
                          className="mt-1 w-full rounded-xl border border-[#3A150B]/15 bg-white px-3 py-2.5 text-sm text-[#3A150B] focus:border-[#D81B60] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="admin-prod-desc" className="block text-xs font-semibold text-[#3A150B]">
                        Descrição
                      </label>
                      <textarea
                        id="admin-prod-desc"
                        rows={3}
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        maxLength={600}
                        placeholder="Descreva massa, recheio, cobertura e diferenciais artesanais..."
                        className="mt-1 w-full rounded-xl border border-[#3A150B]/15 bg-white px-3 py-2.5 text-sm text-[#3A150B] focus:border-[#D81B60] focus:outline-none"
                      />
                    </div>

                    {statusMessage && (
                      <p
                        role="status"
                        className={`rounded-xl px-3.5 py-2.5 text-xs font-medium ${
                          statusMessage.type === 'success'
                            ? 'border border-[#16A34A]/25 bg-[#F0FDF4] text-[#15803D]'
                            : 'border border-[#EF4444]/25 bg-[#FEF2F2] text-[#B91C1C]'
                        }`}
                      >
                        {statusMessage.text}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        disabled={isSaving || isCompressing}
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#D81B60] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#AD1457] disabled:cursor-not-allowed disabled:opacity-65"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            Salvando...
                          </>
                        ) : editingProduct ? (
                          <>
                            <Check className="h-4 w-4" aria-hidden="true" />
                            Salvar Alterações
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Adicionar Produto
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              {/* Registered Products List */}
              <div className="mt-8 border-t border-[#3A150B]/10 pt-6">
                <h3 className="text-base font-bold text-[#3A150B]">
                  Produtos Cadastrados ({products.length})
                </h3>

                {products.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-[#3A150B]/10 bg-[#FFF8FB] p-5 text-sm text-[#3A150B]/70">
                    Nenhum produto cadastrado ainda na coleção <code>produtos</code>. Use o formulário acima para adicionar o primeiro item.
                  </p>
                ) : (
                  <ul className="mt-4 divide-y divide-[#3A150B]/10 rounded-xl border border-[#3A150B]/10 bg-[#FFFDFD]">
                    {products.map((product) => (
                      <li
                        key={product.id}
                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <img
                            src={product.image}
                            alt={product.name}
                            referrerPolicy="no-referrer"
                            className="h-14 w-16 shrink-0 rounded-lg object-cover bg-[#FCEEF2]"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[#3A150B]">
                              {product.name}
                            </p>
                            <p className="truncate text-xs text-[#3A150B]/65">
                              {product.category} · {formatBRL(product.price)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleSelectEdit(product)}
                            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#3A150B]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#3A150B] transition-colors hover:bg-[#FCEEF2]"
                          >
                            <Pencil className="h-3.5 w-3.5 text-[#D81B60]" aria-hidden="true" />
                            Editar
                          </button>

                          {confirmDeleteId === product.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleDelete(product)}
                                className="min-h-[36px] rounded-lg bg-[#DC2626] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#B91C1C]"
                              >
                                Confirmar
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="min-h-[36px] rounded-lg border border-[#3A150B]/15 px-2.5 py-1.5 text-xs font-medium text-[#3A150B]"
                              >
                                Não
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(product.id)}
                              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#EF4444]/25 bg-[#FEF2F2] px-3 py-1.5 text-xs font-semibold text-[#B91C1C] transition-colors hover:bg-[#FEE2E2]"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              Excluir
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};
