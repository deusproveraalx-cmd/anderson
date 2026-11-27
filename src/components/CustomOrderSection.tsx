import React, { useState, useMemo } from 'react';
import { MessageCircle, CalendarHeart, Check, AlertCircle } from 'lucide-react';
import { WHATSAPP_NUMBER } from '../data/products';
import { formatBRL } from './CartDrawer';

interface CustomOrderSectionProps {
  onAddCustomCakeToCart: (summary: {
    name: string;
    flavor: string;
    price: number;
    note: string;
  }) => void;
}

const CAKE_SIZES = [
  { id: '1.5kg', label: '1,5 kg (12 a 15 fatias)', price: 135 },
  { id: '2kg', label: '2 kg (18 a 22 fatias)', price: 165 },
  { id: '3kg', label: '3 kg (28 a 32 fatias)', price: 235 },
];

const DOUGH_OPTIONS = ['Chocolate 50% Cacau', 'Baunilha Amanteigada', 'Red Velvet'];
const FILLING_OPTIONS = [
  'Brigadeiro Gourmet + Morangos',
  'Leite Ninho com Morango',
  'Quatro Leites Cremoso',
  'Doce de Leite com Ameixa',
];

const MIN_ADVANCE_DAYS = 3;

function getMinOrderDateInfo(): { iso: string; br: string } {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + MIN_ADVANCE_DAYS);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return {
    iso: `${year}-${month}-${day}`,
    br: `${day}/${month}/${year}`,
  };
}

export const CustomOrderSection: React.FC<CustomOrderSectionProps> = ({
  onAddCustomCakeToCart,
}) => {
  const minDateInfo = useMemo(() => getMinOrderDateInfo(), []);

  const [sizeId, setSizeId] = useState(CAKE_SIZES[1].id);
  const [dough, setDough] = useState(DOUGH_OPTIONS[0]);
  const [filling, setFilling] = useState(FILLING_OPTIONS[0]);
  const [eventDate, setEventDate] = useState(minDateInfo.iso);
  const [themeNote, setThemeNote] = useState('');
  const [dateError, setDateError] = useState('');
  const [addedFeedback, setAddedFeedback] = useState(false);

  const selectedSize = CAKE_SIZES.find((s) => s.id === sizeId) ?? CAKE_SIZES[1];
  const isDateValid = Boolean(eventDate && eventDate >= minDateInfo.iso);

  const validateDate = (): boolean => {
    if (!eventDate) {
      setDateError(
        `Selecione a data desejada. O pedido deve ser feito com no mínimo ${MIN_ADVANCE_DAYS} dias de antecedência (a partir de ${minDateInfo.br}).`
      );
      return false;
    }
    if (eventDate < minDateInfo.iso) {
      setDateError(
        `O pedido de bolo personalizado tem que ser feito com pelo menos ${MIN_ADVANCE_DAYS} dias de antecedência (data mínima: ${minDateInfo.br}).`
      );
      return false;
    }
    setDateError('');
    return true;
  };

  const customWhatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    [
      'Olá, *Delícia da Esther*! Quero fazer uma encomenda especial de bolo personalizado:',
      `• Tamanho: ${selectedSize.label}`,
      `• Massa: ${dough}`,
      `• Recheio: ${filling}`,
      eventDate ? `• Data da entrega/evento: ${eventDate.split('-').reverse().join('/')}` : '',
      themeNote ? `• Tema / Decoração: ${themeNote}` : '',
      `• Valor estimado: ${formatBRL(selectedSize.price)}`,
    ]
      .filter(Boolean)
      .join('\n')
  )}`;

  const handleAddCustomToCart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDate()) return;

    const formattedBrDate = eventDate.split('-').reverse().join('/');
    const noteParts = [
      `Massa ${dough}`,
      `Data: ${formattedBrDate}`,
      themeNote.trim() ? `Tema: ${themeNote.trim()}` : null,
    ].filter(Boolean);

    onAddCustomCakeToCart({
      name: `Bolo Personalizado (${selectedSize.id})`,
      flavor: filling,
      price: selectedSize.price,
      note: noteParts.join(' · '),
    });

    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2200);
  };

  return (
    <section id="encomendas" className="border-y border-[#3A1810]/10 bg-[#FCEEF2]/65 py-16 md:py-20">
      <div className="mx-auto max-w-[920px] px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[#3A1810]/10 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#D81B60]">
            <CalendarHeart className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Encomendas Especiais · Pedido com 3 dias de antecedência</span>
          </div>
          <h2 className="mt-2 font-display text-2xl font-semibold text-[#260E09] sm:text-3xl text-balance">
            Monte seu bolo personalizado
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#3A1810]/75">
            Escolha o peso, massa e recheio ideais para a sua festa. As encomendas de bolos personalizados devem ser feitas com no mínimo <strong>3 dias de antecedência</strong>.
          </p>

          <form onSubmit={handleAddCustomToCart} className="mt-6 space-y-5">
            {/* Size */}
            <div>
              <span className="block text-xs font-semibold text-[#260E09]">
                1. Tamanho do bolo
              </span>
              <div className="mt-2 grid gap-2.5 sm:grid-cols-3">
                {CAKE_SIZES.map((size) => (
                  <button
                    key={size.id}
                    type="button"
                    onClick={() => setSizeId(size.id)}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left transition-colors ${
                      sizeId === size.id
                        ? 'border-[#D81B60] bg-[#FCEEF2] text-[#260E09]'
                        : 'border-[#3A1810]/15 bg-white text-[#3A1810] hover:border-[#D81B60]/40'
                    }`}
                  >
                    <span className="text-sm font-bold tabular-nums">{size.id}</span>
                    <span className="mt-0.5 text-xs text-[#3A1810]/70">{size.label.replace(`${size.id} `, '')}</span>
                    <span className="mt-1.5 text-xs font-semibold tabular-nums text-[#D81B60]">
                      {formatBRL(size.price)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dough & Filling */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="custom-dough" className="block text-xs font-semibold text-[#260E09]">
                  2. Massa artesanal
                </label>
                <select
                  id="custom-dough"
                  value={dough}
                  onChange={(e) => setDough(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#3A1810]/15 bg-white px-3 py-2.5 text-sm text-[#260E09] focus:border-[#D81B60] focus:outline-none"
                >
                  {DOUGH_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="custom-filling" className="block text-xs font-semibold text-[#260E09]">
                  3. Recheio principal
                </label>
                <select
                  id="custom-filling"
                  value={filling}
                  onChange={(e) => setFilling(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#3A1810]/15 bg-white px-3 py-2.5 text-sm text-[#260E09] focus:border-[#D81B60] focus:outline-none"
                >
                  {FILLING_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date & Theme */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="custom-date" className="block text-xs font-semibold text-[#260E09]">
                  4. Data desejada (mín. 3 dias de antecedência)
                </label>
                <input
                  id="custom-date"
                  type="date"
                  min={minDateInfo.iso}
                  required
                  value={eventDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEventDate(val);
                    if (val && val >= minDateInfo.iso) {
                      setDateError('');
                    }
                  }}
                  className="mt-1.5 w-full rounded-lg border border-[#3A1810]/15 bg-white px-3 py-2 text-sm text-[#260E09] focus:border-[#D81B60] focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-[#3A1810]/65">
                  Disponível para entregas/retiradas a partir de <strong>{minDateInfo.br}</strong>.
                </p>
              </div>

              <div>
                <label htmlFor="custom-theme" className="block text-xs font-semibold text-[#260E09]">
                  5. Tema, cores ou escrita no topo
                </label>
                <input
                  id="custom-theme"
                  type="text"
                  value={themeNote}
                  onChange={(e) => setThemeNote(e.target.value)}
                  placeholder="Ex.: Rosetas rosa, flores e nome Esther"
                  className="mt-1.5 w-full rounded-lg border border-[#3A1810]/15 bg-white px-3 py-2 text-sm text-[#260E09] placeholder:text-[#3A1810]/40 focus:border-[#D81B60] focus:outline-none"
                />
              </div>
            </div>

            {dateError && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-[#EF4444]/30 bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#B91C1C]"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{dateError}</span>
              </p>
            )}

            {/* Summary & CTAs */}
            <div className="flex flex-col gap-3 border-t border-[#3A1810]/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="block text-xs text-[#3A1810]/65">Valor estimado</span>
                <span className="font-display text-2xl font-bold tabular-nums text-[#260E09]">
                  {formatBRL(selectedSize.price)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#D81B60] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#AD1457] whitespace-nowrap"
                >
                  {addedFeedback ? (
                    <>
                      <Check className="h-4 w-4" aria-hidden="true" />
                      Adicionado ao carrinho
                    </>
                  ) : (
                    'Adicionar Encomenda'
                  )}
                </button>
                {isDateValid ? (
                  <a
                    href={customWhatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#16A34A] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#15803D] whitespace-nowrap"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    Enviar no WhatsApp
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={validateDate}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#16A34A] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#15803D] whitespace-nowrap"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    Enviar no WhatsApp
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};
