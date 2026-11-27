import React, { useState } from 'react';
import { X, Plus, Minus, MessageCircle, ShoppingBag } from 'lucide-react';
import { Product, WHATSAPP_NUMBER } from '../data/products';
import { formatBRL } from './CartDrawer';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, flavor: string, quantity: number, note?: string) => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  product,
  onClose,
  onAddToCart,
}) => {
  const hasSelectableFlavors =
    Boolean(product && product.category !== 'Taças' && product.flavors.length > 0);
  const flavorsList =
    hasSelectableFlavors && product ? product.flavors : ['Montada conforme descrição'];
  const [selectedFlavor, setSelectedFlavor] = useState<string>(
    flavorsList[0] ?? 'Montada conforme descrição'
  );
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  if (!product) return null;

  const activeFlavor = hasSelectableFlavors
    ? flavorsList.includes(selectedFlavor)
      ? selectedFlavor
      : flavorsList[0]
    : 'Montada conforme descrição';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddToCart(product, activeFlavor, quantity, note.trim() || undefined);
    setQuantity(1);
    setNote('');
    onClose();
  };

  const whatsappDirectUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Olá, Delícia da Esther! Tenho interesse em: ${quantity}x ${product.name} (${activeFlavor})${note ? ` — Obs: ${note}` : ''}.`
  )}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#260E09]/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdp-modal-title"
    >
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 grid max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[#FFFDFD] shadow-2xl md:grid-cols-2">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-[#260E09] shadow-sm transition-colors hover:bg-[#FCEEF2]"
          aria-label="Fechar detalhes do produto"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Left Image */}
        <div
          className={`relative min-h-[210px] sm:min-h-[260px] ${
            product.category === 'Combos para Festas' || product.category === 'Taças'
              ? 'bg-white p-3'
              : `bg-gradient-to-br ${product.fallbackGradient}`
          }`}
        >
          <img
            src={product.image}
            alt={product.name}
            referrerPolicy="no-referrer"
            className={`h-full max-h-[320px] w-full md:max-h-full ${
              product.category === 'Combos para Festas' || product.category === 'Taças'
                ? 'object-contain'
                : 'object-cover'
            }`}
          />
          {product.category === 'Taças' && (
            <span className="pointer-events-none absolute inset-x-3 bottom-3 rounded-lg bg-[#260E09]/80 px-3 py-1 text-center text-xs font-bold tracking-wide text-white uppercase shadow-sm">
              Imagens ilustrativas
            </span>
          )}
        </div>

        {/* Right Contiguous Purchase Module */}
        <form onSubmit={handleSubmit} className="flex flex-col justify-between p-6 md:p-7">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-[#3A1810]/65">
              <span>{product.category}</span>
              <span aria-hidden="true">·</span>
              <span>{product.portion}</span>
            </div>

            <h2 id="pdp-modal-title" className="mt-1.5 font-display text-2xl font-semibold text-[#260E09]">
              {product.name}
            </h2>

            <p className="mt-2 text-xl font-bold tabular-nums text-[#D81B60]">
              {formatBRL(product.price)}
            </p>

            <p className="mt-3 text-sm leading-relaxed text-[#3A1810]/80">
              {product.description}
            </p>

            {/* Flavor Selection (hidden for fixed-assembly Taças) */}
            {hasSelectableFlavors && (
              <div className="mt-5">
                <span className="block text-xs font-semibold text-[#260E09]">
                  Escolha o sabor / recheio
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {flavorsList.map((flavor) => (
                    <button
                      key={flavor}
                      type="button"
                      onClick={() => setSelectedFlavor(flavor)}
                      className={`min-h-[38px] rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        activeFlavor === flavor
                          ? 'border-[#D81B60] bg-[#FCEEF2] text-[#9D174D]'
                          : 'border-[#3A1810]/15 bg-white text-[#3A1810] hover:border-[#D81B60]/40'
                      }`}
                    >
                      {flavor}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Optional Note */}
            <div className="mt-4">
              <label htmlFor="pdp-note" className="block text-xs font-semibold text-[#260E09]">
                Personalização ou observação (opcional)
              </label>
              <input
                id="pdp-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex.: Feliz aniversário, nome no topo, sem coco..."
                className="mt-1.5 w-full rounded-lg border border-[#3A1810]/15 bg-white px-3 py-2 text-sm text-[#260E09] placeholder:text-[#3A1810]/40 focus:border-[#D81B60] focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-6 space-y-2.5 border-t border-[#3A1810]/10 pt-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center rounded-lg border border-[#3A1810]/15 bg-white">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-11 w-10 items-center justify-center text-[#3A1810] hover:bg-[#FCEEF2]"
                  aria-label="Diminuir quantidade"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-[2.25rem] text-center text-sm font-semibold tabular-nums text-[#260E09]">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="flex h-11 w-10 items-center justify-center text-[#3A1810] hover:bg-[#FCEEF2]"
                  aria-label="Aumentar quantidade"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <button
                type="submit"
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-[#D81B60] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#AD1457] whitespace-nowrap"
              >
                <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                Adicionar · {formatBRL(product.price * quantity)}
              </button>
            </div>

            <a
              href={whatsappDirectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg border border-[#16A34A]/30 bg-[#F0FDF4] px-4 py-2 text-xs font-semibold text-[#15803D] transition-colors hover:bg-[#DCFCE7]"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Tirar dúvida sobre este item no WhatsApp
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};
