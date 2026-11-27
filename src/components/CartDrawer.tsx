import React, { useState } from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  MessageCircle,
  CheckCircle2,
  ShoppingBag,
  Loader2,
} from 'lucide-react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { WHATSAPP_NUMBER, WHATSAPP_DISPLAY } from '../data/products';

export interface CartItem {
  key: string;
  productId: string;
  name: string;
  flavor: string;
  note?: string;
  price: number;
  quantity: number;
  image: string;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (key: string, delta: number) => void;
  onRemoveItem: (key: string) => void;
  onClearCart: () => void;
}

interface ConfirmedOrder {
  orderNumber: string;
  customerName: string;
  deliveryMode: 'retirada' | 'entrega';
  total: number;
  itemCount: number;
  whatsappHref: string;
}

const DELIVERY_FEE = 12.0;

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'retirada' | 'entrega'>('entrega');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Pix' | 'Cartão na entrega' | 'Dinheiro'>('Pix');
  const [observacoes, setObservacoes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(null);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  if (fatalError) {
    throw fatalError;
  }

  if (!isOpen) return null;

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryCost = items.length > 0 && deliveryMode === 'entrega' ? DELIVERY_FEE : 0;
  const total = subtotal + deliveryCost;

  const buildWhatsappHref = (orderNum?: string) => {
    const lines = [
      orderNum
        ? `Olá, *Delícia da Esther*! Acabei de enviar o pedido *#${orderNum}*:`
        : 'Olá, *Delícia da Esther*! Gostaria de fazer um pedido:',
      '',
      ...items.map(
        (item) =>
          `• ${item.quantity}x ${item.name} (${item.flavor})${item.note ? ` — Obs: ${item.note}` : ''} — ${formatBRL(item.price * item.quantity)}`
      ),
      '',
      `Subtotal: ${formatBRL(subtotal)}`,
      deliveryMode === 'entrega'
        ? `Entrega: ${formatBRL(deliveryCost)}${address ? `\nEndereço: ${address}` : ''}`
        : 'Modo: Retirada no ateliê',
      `*Total: ${formatBRL(total)}*`,
      `Pagamento: ${paymentMethod}`,
      observacoes.trim() ? `Observações: ${observacoes.trim()}` : '',
      customerName ? `Cliente: ${customerName}` : '',
      customerPhone ? `Contato: ${customerPhone}` : '',
    ].filter(Boolean);

    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
  };

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = customerName.trim();
    const trimmedPhone = customerPhone.trim();
    const trimmedAddress = address.trim();
    const trimmedNotes = observacoes.trim();

    if (trimmedName.length < 2 || trimmedName.length > 120) {
      setFormError('Por favor, informe seu nome completo (mínimo 2 caracteres).');
      return;
    }
    if (trimmedPhone.length < 6 || trimmedPhone.length > 40) {
      setFormError('Por favor, informe um número de WhatsApp válido para contato.');
      return;
    }
    if (deliveryMode === 'entrega' && trimmedAddress.length < 3) {
      setFormError('Por favor, informe o endereço completo para entrega.');
      return;
    }
    if (trimmedAddress.length > 300) {
      setFormError('O endereço deve ter no máximo 300 caracteres.');
      return;
    }
    if (items.length === 0) {
      setFormError('Adicione pelo menos um produto ao carrinho.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    const orderNumber = `DE-${Math.floor(1040 + Math.random() * 8900)}`;
    const whatsappHref = buildWhatsappHref(orderNumber);
    const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

    const sanitizedItems = items.slice(0, 50).map((item) => ({
      nome: String(item.name || 'Produto').slice(0, 140),
      sabor: String(item.flavor || 'Tradicional').slice(0, 80),
      quantidade: Math.max(1, Math.min(500, Math.round(item.quantity))),
      preco: Number(item.price) > 0 ? Number(item.price) : 1,
      observacao: item.note ? String(item.note).slice(0, 180) : '',
    }));

    const orderPayload: Record<string, unknown> = {
      numeroPedido: orderNumber,
      clienteNome: trimmedName,
      clienteWhatsapp: trimmedPhone,
      modoEntrega: deliveryMode,
      endereco: deliveryMode === 'entrega' ? trimmedAddress : '',
      formaPagamento: paymentMethod,
      itens: sanitizedItems,
      subtotal: Number(subtotal.toFixed(2)),
      taxaEntrega: Number(deliveryCost.toFixed(2)),
      total: Number(total.toFixed(2)),
      status: 'novo',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (trimmedNotes) {
      orderPayload.observacoes = trimmedNotes.slice(0, 500);
    }

    try {
      await addDoc(collection(db, 'pedidos'), orderPayload);
    } catch (err) {
      setIsSubmitting(false);
      try {
        handleFirestoreError(err, OperationType.CREATE, 'pedidos');
      } catch (wrapped) {
        setFatalError(wrapped as Error);
      }
      return;
    }

    setIsSubmitting(false);
    setConfirmedOrder({
      orderNumber,
      customerName: trimmedName,
      deliveryMode,
      total,
      itemCount,
      whatsappHref,
    });
    setObservacoes('');
    onClearCart();
  };

  const handleClose = () => {
    setConfirmedOrder(null);
    setFormError('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#260E09]/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-drawer-title"
    >
      <div className="absolute inset-0" onClick={handleClose} aria-hidden="true" />
      <aside className="relative z-10 flex h-full w-full max-w-md flex-col bg-[#FFFDFD] shadow-2xl">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-[#3A1810]/10 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5 text-[#D81B60]" aria-hidden="true" />
            <h2 id="cart-drawer-title" className="font-display text-xl font-semibold text-[#260E09]">
              Seu Carrinho
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[#3A1810]/70 transition-colors hover:bg-[#FCEEF2] hover:text-[#260E09] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D81B60]"
            aria-label="Fechar carrinho"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {confirmedOrder ? (
            <div className="rounded-xl border border-[#16A34A]/25 bg-[#F0FDF4] p-6 text-[#14532D]">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-[#16A34A]" aria-hidden="true" />
                <h3 className="font-display text-xl font-semibold text-[#14532D]">
                  Pedido #{confirmedOrder.orderNumber} Confirmado
                </h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#166534]">
                Obrigado, <strong>{confirmedOrder.customerName}</strong>! Recebemos seu pedido com{' '}
                {confirmedOrder.itemCount} {confirmedOrder.itemCount === 1 ? 'item' : 'itens'} (
                {confirmedOrder.deliveryMode === 'entrega' ? 'Entrega Rápida' : 'Retirada no Ateliê'}) no valor de{' '}
                <strong className="tabular-nums">{formatBRL(confirmedOrder.total)}</strong>.
              </p>
              <p className="mt-2 text-xs text-[#166534]/90">
                Sua encomenda já entrou na fila de produção da nossa cozinha. Caso queira, você também pode enviar o resumo pelo WhatsApp{' '}
                {WHATSAPP_DISPLAY}:
              </p>
              <div className="mt-5 flex flex-col gap-2.5">
                <a
                  href={confirmedOrder.whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#16A34A] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#15803D]"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  Enviar resumo no WhatsApp
                </a>
                <button
                  type="button"
                  onClick={handleClose}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[#16A34A]/30 bg-white px-5 py-2.5 text-sm font-medium text-[#14532D] transition-colors hover:bg-[#DCFCE7]"
                >
                  Continuar navegando
                </button>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FCEEF2] text-[#D81B60]">
                <ShoppingBag className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-[#260E09]">
                Seu carrinho está vazio
              </h3>
              <p className="mt-1.5 max-w-xs text-sm text-[#3A1810]/70">
                Escolha bolos personalizados, brigadeiros ou copos da felicidade para começar seu pedido.
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="mt-6 inline-flex min-h-[42px] items-center justify-center rounded-lg bg-[#D81B60] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#AD1457]"
              >
                Explorar cardápio
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Items list */}
              <ul className="divide-y divide-[#3A1810]/10">
                {items.map((item) => (
                  <li key={item.key} className="flex gap-3.5 py-4 first:pt-0">
                    <img
                      src={item.image}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="h-16 w-20 shrink-0 rounded-lg object-cover bg-[#FCEEF2]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-[#260E09] leading-snug">
                          {item.name}
                        </h3>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.key)}
                          className="shrink-0 rounded p-1 text-[#3A1810]/45 transition-colors hover:bg-[#FCEEF2] hover:text-[#D81B60]"
                          aria-label={`Remover ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-0.5 text-xs text-[#3A1810]/65">
                        Sabor: {item.flavor}
                      </p>
                      {item.note && (
                        <p className="mt-0.5 text-xs text-[#9D174D]">
                          Obs: {item.note}
                        </p>
                      )}
                      <div className="mt-2.5 flex items-center justify-between">
                        <div className="inline-flex items-center rounded-lg border border-[#3A1810]/15 bg-white">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.key, -1)}
                            className="flex h-8 w-8 items-center justify-center text-[#3A1810] transition-colors hover:bg-[#FCEEF2]"
                            aria-label="Diminuir quantidade"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[2rem] text-center text-xs font-semibold tabular-nums text-[#260E09]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.key, 1)}
                            className="flex h-8 w-8 items-center justify-center text-[#3A1810] transition-colors hover:bg-[#FCEEF2]"
                            aria-label="Aumentar quantidade"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-[#260E09]">
                          {formatBRL(item.price * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Checkout Form */}
              <form id="checkout-form" onSubmit={handleConfirmOrder} className="space-y-4 border-t border-[#3A1810]/10 pt-5">
                <h3 className="text-sm font-semibold text-[#260E09]">
                  Dados para entrega ou retirada
                </h3>

                <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#FCEEF2] p-1">
                  <button
                    type="button"
                    onClick={() => setDeliveryMode('entrega')}
                    className={`min-h-[38px] rounded-md px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                      deliveryMode === 'entrega'
                        ? 'bg-white text-[#260E09] shadow-sm'
                        : 'text-[#3A1810]/70 hover:text-[#260E09]'
                    }`}
                  >
                    Entrega ({formatBRL(DELIVERY_FEE)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMode('retirada')}
                    className={`min-h-[38px] rounded-md px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                      deliveryMode === 'retirada'
                        ? 'bg-white text-[#260E09] shadow-sm'
                        : 'text-[#3A1810]/70 hover:text-[#260E09]'
                    }`}
                  >
                    Retirada (Grátis)
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label htmlFor="checkout-name" className="block text-xs font-medium text-[#3A1810]/80">
                      Seu nome
                    </label>
                    <input
                      id="checkout-name"
                      type="text"
                      maxLength={120}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ex.: Maria Clara Silva"
                      className="mt-1 w-full rounded-lg border border-[#3A1810]/15 bg-white px-3 py-2 text-sm text-[#260E09] placeholder:text-[#3A1810]/40 focus:border-[#D81B60] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label htmlFor="checkout-phone" className="block text-xs font-medium text-[#3A1810]/80">
                      WhatsApp para confirmação
                    </label>
                    <input
                      id="checkout-phone"
                      type="tel"
                      maxLength={40}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="(69) 99999-0000"
                      className="mt-1 w-full rounded-lg border border-[#3A1810]/15 bg-white px-3 py-2 text-sm text-[#260E09] placeholder:text-[#3A1810]/40 focus:border-[#D81B60] focus:outline-none"
                    />
                  </div>
                  {deliveryMode === 'entrega' && (
                    <div>
                      <label htmlFor="checkout-address" className="block text-xs font-medium text-[#3A1810]/80">
                        Endereço de entrega
                      </label>
                      <input
                        id="checkout-address"
                        type="text"
                        maxLength={300}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Rua, número, bairro e ponto de referência"
                        className="mt-1 w-full rounded-lg border border-[#3A1810]/15 bg-white px-3 py-2 text-sm text-[#260E09] placeholder:text-[#3A1810]/40 focus:border-[#D81B60] focus:outline-none"
                      />
                    </div>
                  )}
                  <div>
                    <label htmlFor="checkout-payment" className="block text-xs font-medium text-[#3A1810]/80">
                      Forma de pagamento
                    </label>
                    <select
                      id="checkout-payment"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as 'Pix' | 'Cartão na entrega' | 'Dinheiro')}
                      className="mt-1 w-full rounded-lg border border-[#3A1810]/15 bg-white px-3 py-2 text-sm text-[#260E09] focus:border-[#D81B60] focus:outline-none"
                    >
                      <option value="Pix">Pix (confirmação imediata)</option>
                      <option value="Cartão na entrega">Cartão na entrega / retirada</option>
                      <option value="Dinheiro">Dinheiro na entrega / retirada</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="checkout-notes" className="block text-xs font-medium text-[#3A1810]/80">
                      Observações do pedido (opcional)
                    </label>
                    <textarea
                      id="checkout-notes"
                      rows={2}
                      maxLength={500}
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      placeholder="Ex.: Troco para R$ 100, horário preferido, recado..."
                      className="mt-1 w-full rounded-lg border border-[#3A1810]/15 bg-white px-3 py-2 text-sm text-[#260E09] placeholder:text-[#3A1810]/40 focus:border-[#D81B60] focus:outline-none"
                    />
                  </div>
                </div>

                {formError && (
                  <p className="rounded-lg bg-[#FEF2F2] px-3 py-2 text-xs font-medium text-[#B91C1C]" role="alert">
                    {formError}
                  </p>
                )}
              </form>
            </div>
          )}
        </div>

        {/* Footer Totals */}
        {!confirmedOrder && items.length > 0 && (
          <div className="border-t border-[#3A1810]/10 bg-[#FFF9FA] px-6 py-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-[#3A1810]/75">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatBRL(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[#3A1810]/75">
                <span>{deliveryMode === 'entrega' ? 'Entrega rápida' : 'Retirada no ateliê'}</span>
                <span className="tabular-nums">{deliveryCost === 0 ? 'Grátis' : formatBRL(deliveryCost)}</span>
              </div>
              <div className="flex justify-between border-t border-[#3A1810]/10 pt-2 text-base font-bold text-[#260E09]">
                <span>Total</span>
                <span className="tabular-nums">{formatBRL(total)}</span>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="submit"
                form="checkout-form"
                disabled={isSubmitting}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[#D81B60] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#AD1457] disabled:cursor-not-allowed disabled:opacity-65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D81B60]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Enviando pedido...
                  </>
                ) : (
                  'Confirmar Pedido'
                )}
              </button>
              <a
                href={buildWhatsappHref()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-lg border border-[#16A34A]/35 bg-[#F0FDF4] px-5 py-2 text-sm font-semibold text-[#15803D] transition-colors hover:bg-[#DCFCE7]"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Pedir direto pelo WhatsApp
              </a>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};
