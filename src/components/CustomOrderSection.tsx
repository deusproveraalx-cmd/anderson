import React, { useState, useMemo } from 'react';
import { MessageCircle, CalendarHeart, Check, AlertCircle, Sparkles } from 'lucide-react';
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

const CAKE_WEIGHTS = [
  { id: '1kg', label: '1 kg', slices: '8 a 10 fatias', kg: 1 },
  { id: '1.5kg', label: '1,5 kg', slices: '12 a 15 fatias', kg: 1.5 },
  { id: '2kg', label: '2 kg', slices: '18 a 22 fatias', kg: 2 },
  { id: '3kg', label: '3 kg', slices: '28 a 32 fatias', kg: 3 },
] as const;

const DOUGH_OPTIONS = [
  { id: 'branca', label: 'Massa Branca', surchargePerKg: 0, note: 'R$ 65,00/kg base' },
  { id: 'chocolate', label: 'Massa de Chocolate', surchargePerKg: 15, note: 'acréscimo (+R$ 15/kg → R$ 80/kg)' },
] as const;

const FILLING_OPTIONS = ['Ninho', 'Chocolate', 'Dois amores', 'Prestígio'] as const;

const FRUIT_OPTIONS = [
  { id: 'none', label: 'Sem frutas (tradicional)', surchargePerKg: 0 },
  { id: 'Morango', label: 'Com Morango', surchargePerKg: 15 },
  { id: 'Abacaxi', label: 'Com Abacaxi', surchargePerKg: 15 },
  { id: 'Uva', label: 'Com Uva', surchargePerKg: 15 },
] as const;

const BASE_PRICE_PER_KG = 65;
const MIN_TOPPER_PRICE = 15;
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

  const [weightId, setWeightId] = useState<(typeof CAKE_WEIGHTS)[number]['id']>('2kg');
  const [doughId, setDoughId] = useState<(typeof DOUGH_OPTIONS)[number]['id']>('branca');
  const [filling, setFilling] = useState<(typeof FILLING_OPTIONS)[number]>(FILLING_OPTIONS[0]);
  const [fruitId, setFruitId] = useState<(typeof FRUIT_OPTIONS)[number]['id']>('none');
  const [includeTopper, setIncludeTopper] = useState(false);
  const [eventDate, setEventDate] = useState(minDateInfo.iso);
  const [themeNote, setThemeNote] = useState('');
  const [dateError, setDateError] = useState('');
  const [addedFeedback, setAddedFeedback] = useState(false);

  const selectedWeight = CAKE_WEIGHTS.find((w) => w.id === weightId) ?? CAKE_WEIGHTS[2];
  const selectedDough = DOUGH_OPTIONS.find((d) => d.id === doughId) ?? DOUGH_OPTIONS[0];
  const selectedFruit = FRUIT_OPTIONS.find((f) => f.id === fruitId) ?? FRUIT_OPTIONS[0];

  const pricePerKg =
    BASE_PRICE_PER_KG + selectedDough.surchargePerKg + selectedFruit.surchargePerKg;
  const cakePrice = Number((selectedWeight.kg * pricePerKg).toFixed(2));
  const topperPrice = includeTopper ? MIN_TOPPER_PRICE : 0;
  const totalPrice = Number((cakePrice + topperPrice).toFixed(2));

  const flavorSummary =
    selectedFruit.id === 'none' ? filling : `${filling} com ${selectedFruit.id}`;

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
      `• Peso: ${selectedWeight.label} (${selectedWeight.slices})`,
      `• Massa: ${selectedDough.label}`,
      `• Recheio: ${flavorSummary}`,
      `• Valor do kg: ${formatBRL(pricePerKg)}/kg (Bolo: ${formatBRL(cakePrice)})`,
      includeTopper
        ? `• Topo de bolo (à parte): a partir de ${formatBRL(MIN_TOPPER_PRICE)}`
        : '• Topo de bolo: Sem topo',
      eventDate ? `• Data da entrega/evento: ${eventDate.split('-').reverse().join('/')}` : '',
      themeNote ? `• Tema / Decoração: ${themeNote}` : '',
      `• Total estimado: ${formatBRL(totalPrice)}`,
    ]
      .filter(Boolean)
      .join('\n')
  )}`;

  const handleAddCustomToCart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDate()) return;

    const formattedBrDate = eventDate.split('-').reverse().join('/');
    const noteParts = [
      selectedDough.label,
      `${formatBRL(pricePerKg)}/kg`,
      includeTopper ? `Topo de bolo (mín. ${formatBRL(MIN_TOPPER_PRICE)})` : null,
      `Data: ${formattedBrDate}`,
      themeNote.trim() ? `Tema: ${themeNote.trim()}` : null,
    ].filter(Boolean);

    onAddCustomCakeToCart({
      name: `Bolo Personalizado (${selectedWeight.label})`,
      flavor: flavorSummary,
      price: totalPrice,
      note: noteParts.join(' · '),
    });

    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2200);
  };

  return (
    <section id="encomendas" className="border-y border-[#3A1810]/10 bg-[#FCEEF2]/65 py-14 md:py-16">
      <div className="mx-auto w-full max-w-[1100px] px-5 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[#3A1810]/10 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#D81B60]">
            <CalendarHeart className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Encomendas Especiais · Pedido com 3 dias de antecedência</span>
          </div>
          <h2 className="mt-2 font-display text-2xl font-semibold text-[#260E09] sm:text-3xl text-balance">
            Monte seu bolo personalizado
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#3A1810]/75">
            Massa branca a partir de <strong>R$ 65,00/kg</strong>, massa de chocolate <strong>R$ 80,00/kg</strong> e recheios com frutas (morango, abacaxi ou uva) a partir de <strong>R$ 80,00/kg</strong>. Pedidos com no mínimo <strong>3 dias de antecedência</strong>.
          </p>

          <form onSubmit={handleAddCustomToCart} className="mt-6 space-y-5">
            {/* 1. Weight */}
            <div>
              <span className="block text-xs font-semibold text-[#260E09]">
                1. Peso do bolo ({formatBRL(pricePerKg)}/kg selecionado)
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {CAKE_WEIGHTS.map((weight) => {
                  const previewPrice = weight.kg * pricePerKg;
                  return (
                    <button
                      key={weight.id}
                      type="button"
                      onClick={() => setWeightId(weight.id)}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition-colors ${
                        weightId === weight.id
                          ? 'border-[#D81B60] bg-[#FCEEF2] text-[#260E09]'
                          : 'border-[#3A1810]/15 bg-white text-[#3A1810] hover:border-[#D81B60]/40'
                      }`}
                    >
                      <span className="text-sm font-bold tabular-nums">{weight.label}</span>
                      <span className="mt-0.5 text-[11px] text-[#3A1810]/70">{weight.slices}</span>
                      <span className="mt-1.5 text-xs font-semibold tabular-nums text-[#D81B60]">
                        {formatBRL(previewPrice)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Dough & 3. Filling */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="block text-xs font-semibold text-[#260E09]">
                  2. Massa
                </span>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {DOUGH_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDoughId(opt.id)}
                      className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        doughId === opt.id
                          ? 'border-[#D81B60] bg-[#FCEEF2] text-[#260E09]'
                          : 'border-[#3A1810]/15 bg-white text-[#3A1810] hover:border-[#D81B60]/40'
                      }`}
                    >
                      <span className="block text-xs font-bold">{opt.label}</span>
                      <span className="mt-0.5 block text-[11px] text-[#3A1810]/70">
                        {opt.surchargePerKg === 0 ? 'R$ 65,00/kg' : 'R$ 80,00/kg (+R$ 15/kg)'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="custom-filling" className="block text-xs font-semibold text-[#260E09]">
                  3. Recheio
                </label>
                <select
                  id="custom-filling"
                  value={filling}
                  onChange={(e) => setFilling(e.target.value as (typeof FILLING_OPTIONS)[number])}
                  className="mt-1.5 w-full rounded-xl border border-[#3A1810]/15 bg-white px-3 py-2.5 text-sm text-[#260E09] focus:border-[#D81B60] focus:outline-none"
                >
                  {FILLING_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-[#3A1810]/65">
                  Recheios tradicionais: Ninho, Chocolate, Dois amores ou Prestígio.
                </p>
              </div>
            </div>

            {/* 4. Fruit Filling & 5. Topper */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="custom-fruit" className="block text-xs font-semibold text-[#260E09]">
                  4. Recheio com frutas (opcional)
                </label>
                <select
                  id="custom-fruit"
                  value={fruitId}
                  onChange={(e) => setFruitId(e.target.value as (typeof FRUIT_OPTIONS)[number]['id'])}
                  className="mt-1.5 w-full rounded-xl border border-[#3A1810]/15 bg-white px-3 py-2.5 text-sm text-[#260E09] focus:border-[#D81B60] focus:outline-none"
                >
                  {FRUIT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.surchargePerKg === 0
                        ? opt.label
                        : `${opt.label} (massa branca R$ 80,00/kg)`}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-[#3A1810]/65">
                  Frutas disponíveis: Morango, Abacaxi ou Uva (+R$ 15,00/kg).
                </p>
              </div>

              <div>
                <span className="block text-xs font-semibold text-[#260E09]">
                  5. Topo de bolo (cobrado à parte)
                </span>
                <button
                  type="button"
                  onClick={() => setIncludeTopper((v) => !v)}
                  aria-pressed={includeTopper}
                  className={`mt-1.5 flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                    includeTopper
                      ? 'border-[#D81B60] bg-[#FCEEF2] text-[#260E09]'
                      : 'border-[#3A1810]/15 bg-white text-[#3A1810] hover:border-[#D81B60]/40'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles
                      className={`h-4 w-4 shrink-0 ${
                        includeTopper ? 'text-[#D81B60]' : 'text-[#3A1810]/45'
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <span className="block text-xs font-bold">
                        {includeTopper ? 'Com topo de bolo' : 'Adicionar topo de bolo'}
                      </span>
                      <span className="block text-[11px] text-[#3A1810]/70">
                        Cobrado à parte · Mínimo {formatBRL(MIN_TOPPER_PRICE)}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      includeTopper
                        ? 'bg-[#D81B60] text-white'
                        : 'bg-[#3A1810]/10 text-[#3A1810]'
                    }`}
                  >
                    {includeTopper ? `+ ${formatBRL(MIN_TOPPER_PRICE)}` : 'Opcional'}
                  </span>
                </button>
                <p className="mt-1 text-[11px] text-[#3A1810]/65">
                  Valor mínimo de R$ 15,00 (modelos mais elaborados têm ajuste combinado no WhatsApp).
                </p>
              </div>
            </div>

            {/* 6. Date & Theme */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="custom-date" className="block text-xs font-semibold text-[#260E09]">
                  6. Data desejada (mín. 3 dias de antecedência)
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
                  className="mt-1.5 w-full rounded-xl border border-[#3A1810]/15 bg-white px-3 py-2 text-sm text-[#260E09] focus:border-[#D81B60] focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-[#3A1810]/65">
                  Disponível para entregas/retiradas a partir de <strong>{minDateInfo.br}</strong>.
                </p>
              </div>

              <div>
                <label htmlFor="custom-theme" className="block text-xs font-semibold text-[#260E09]">
                  7. Tema, cores ou detalhes do topo
                </label>
                <input
                  id="custom-theme"
                  type="text"
                  value={themeNote}
                  onChange={(e) => setThemeNote(e.target.value)}
                  placeholder="Ex.: Rosetas rosa, flores e nome Esther"
                  className="mt-1.5 w-full rounded-xl border border-[#3A1810]/15 bg-white px-3 py-2 text-sm text-[#260E09] placeholder:text-[#3A1810]/40 focus:border-[#D81B60] focus:outline-none"
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
            <div className="caixa-flex border-t border-[#3A1810]/10 pt-5 md:items-center md:justify-between">
              <div>
                <span className="block text-xs text-[#3A1810]/65">
                  Valor estimado ({selectedWeight.label} a {formatBRL(pricePerKg)}/kg
                  {includeTopper ? ` + Topo mín. ${formatBRL(MIN_TOPPER_PRICE)}` : ''})
                </span>
                <span className="font-display text-2xl font-bold tabular-nums text-[#260E09]">
                  {formatBRL(totalPrice)}
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
