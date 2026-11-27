export type ProductCategory = 'Todos' | 'Bolos' | 'Doces' | 'Taças' | 'Combos para Festas';

export interface Product {
  id: string;
  name: string;
  category: Exclude<ProductCategory, 'Todos'>;
  portion: string;
  price: number;
  description: string;
  image: string;
  storagePath?: string;
  fallbackGradient: string;
  flavors: string[];
  featuredNote?: string;
}

export type OrderStatus = 'novo' | 'em_preparo' | 'concluido';

export interface OrderItem {
  nome: string;
  sabor?: string;
  quantidade: number;
  preco: number;
  observacao?: string;
}

export interface Order {
  id: string;
  numeroPedido: string;
  clienteNome: string;
  clienteWhatsapp: string;
  modoEntrega: 'entrega' | 'retirada';
  endereco: string;
  formaPagamento: 'Pix' | 'Cartão na entrega' | 'Dinheiro';
  itens: OrderItem[];
  subtotal: number;
  taxaEntrega: number;
  total: number;
  observacoes?: string;
  status: OrderStatus;
  autoPrintedAtMs?: number;
  createdAtMs: number;
}

export type UserRole = 'admin' | 'atendente' | 'none';

export interface StaffUser {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  createdAtMs: number;
}

export const COMBO_1_DEFAULT: Product = {
  id: 'combo-1',
  name: 'COMBO 1',
  category: 'Combos para Festas',
  portion: 'BOLO DE 1,5 KG • 30 BRIGADEIROS • 5 CUPCAKES',
  price: 150,
  description: 'BOLO DE 1,5 KG • 30 BRIGADEIROS • 5 CUPCAKES — Peça a sua doçura!',
  image: '/assets/aistudio/image_da6a777a.png',
  fallbackGradient: 'from-[#D81B60] to-[#3A1810]',
  flavors: ['Ninho', 'Chocolate', 'Dois amores', 'Prestígio'],
  featuredNote: 'Peça a sua doçura!',
};

export const COMBO_2_DEFAULT: Product = {
  id: 'combo-2',
  name: 'COMBO 2',
  category: 'Combos para Festas',
  portion: 'BOLO DE 2 KG • 30 BRIGADEIROS • 5 CUPCAKES',
  price: 185,
  description: 'BOLO DE 2 KG • 30 BRIGADEIROS • 5 CUPCAKES — Peça a sua doçura!',
  image: '/assets/aistudio/image_cdecbf73.png',
  fallbackGradient: 'from-[#D81B60] to-[#3A1810]',
  flavors: ['Ninho', 'Chocolate', 'Dois amores', 'Prestígio'],
  featuredNote: 'Peça a sua doçura!',
};

export const COMBO_3_DEFAULT: Product = {
  id: 'combo-3',
  name: 'COMBO 3',
  category: 'Combos para Festas',
  portion: 'BOLO DE 3 KG • 30 BRIGADEIROS • 5 CUPCAKES',
  price: 230,
  description: 'BOLO DE 3 KG • 30 BRIGADEIROS • 5 CUPCAKES — Peça a sua doçura!',
  image: '/assets/aistudio/image_75bb213b.png',
  fallbackGradient: 'from-[#D81B60] to-[#3A1810]',
  flavors: ['Ninho', 'Chocolate', 'Dois amores', 'Prestígio'],
  featuredNote: 'Peça a sua doçura!',
};

export const COMBO_4_DEFAULT: Product = {
  id: 'combo-4',
  name: 'COMBO 4',
  category: 'Combos para Festas',
  portion: 'BOLO DE 4 KG • 30 BRIGADEIROS • 5 CUPCAKES',
  price: 315,
  description: 'BOLO DE 4 KG • 30 BRIGADEIROS • 5 CUPCAKES — Peça a sua doçura!',
  image: '/assets/aistudio/image_dccbdeea.png',
  fallbackGradient: 'from-[#D81B60] to-[#3A1810]',
  flavors: ['Ninho', 'Chocolate', 'Dois amores', 'Prestígio'],
  featuredNote: 'Peça a sua doçura!',
};

export const DEFAULT_PARTY_COMBOS: Product[] = [
  COMBO_1_DEFAULT,
  COMBO_2_DEFAULT,
  COMBO_3_DEFAULT,
  COMBO_4_DEFAULT,
];

export const TACA_TROPICAL_DEFAULT: Product = {
  id: 'taca-tropical',
  name: 'Taça Tropical',
  category: 'Taças',
  portion: '1,250L · Montada conforme descrição',
  price: 100,
  description:
    'Recheios de Frutas (1,250L) — Montada com Cupuaçu, Maracujá, Bolo, Limão, Chantilly e Frutas.',
  image: '/assets/aistudio/image_779a7261.png',
  fallbackGradient: 'from-[#D81B60] to-[#3A1810]',
  flavors: [],
};

export const TACA_NINHO_DEFAULT: Product = {
  id: 'taca-ninho',
  name: 'Taça Ninho',
  category: 'Taças',
  portion: '1,250L · Montada conforme descrição',
  price: 100,
  description:
    'Recheio de Ninho (1,250L) — Montada com Recheio de Ninho, Morango, Massa Baunilha e Chantilly.',
  image: '/assets/aistudio/image_36bf5332.png',
  fallbackGradient: 'from-[#D81B60] to-[#3A1810]',
  flavors: [],
};

export const TACA_CHOCOLATE_DEFAULT: Product = {
  id: 'taca-chocolate',
  name: 'Taça Chocolate',
  category: 'Taças',
  portion: '1,250L · Montada conforme descrição',
  price: 100,
  description:
    'Recheios (1,250L) — Montada com Chocolate, Morango e Chantilly.',
  image: '/assets/aistudio/image_27842d5d.png',
  fallbackGradient: 'from-[#D81B60] to-[#3A1810]',
  flavors: [],
};

export const DEFAULT_CATALOG_PRODUCTS: Product[] = [
  ...DEFAULT_PARTY_COMBOS,
  TACA_TROPICAL_DEFAULT,
  TACA_NINHO_DEFAULT,
  TACA_CHOCOLATE_DEFAULT,
];

export interface ScheduleEntry {
  id: string;
  dayLabel: string;
  hours: string;
  location: string;
  description: string;
  isDeliveryOnly: boolean;
  dayIndices: number[];
}

export const WEEKLY_SCHEDULE: ScheduleEntry[] = [
  {
    id: 'segunda',
    dayLabel: 'Segunda-feira',
    hours: 'Horário comercial',
    location: 'Apenas Delivery',
    description: 'Peça pelo site ou WhatsApp e receba suas delícias direto em casa.',
    isDeliveryOnly: true,
    dayIndices: [1],
  },
  {
    id: 'terca-quinta',
    dayLabel: 'Terça e Quinta-feira',
    hours: 'A partir das 14h',
    location: 'Jatuarana',
    description: 'Passe na Jatuarana para garantir seus bolos e docinhos fresquinhos.',
    isDeliveryOnly: false,
    dayIndices: [2, 4],
  },
  {
    id: 'quarta-sexta',
    dayLabel: 'Quarta e Sexta-feira',
    hours: 'A partir das 14h',
    location: 'Esquina da Sete de Setembro com Campos Sales',
    description: 'Esperamos você na esquina da Sete de Setembro com Campos Sales.',
    isDeliveryOnly: false,
    dayIndices: [3, 5],
  },
  {
    id: 'sabado-manha',
    dayLabel: 'Sábado (Manhã)',
    hours: 'Das 10h às 13h',
    location: 'Jatuarana',
    description: 'Atendimento especial pela manhã na Jatuarana para adoçar o seu sábado.',
    isDeliveryOnly: false,
    dayIndices: [6],
  },
  {
    id: 'sabado-domingo',
    dayLabel: 'Sábado (Tarde/Noite) e Domingo',
    hours: 'A partir das 17h30',
    location: 'Skate Parque',
    description: 'Fim de tarde e noite no Skate Parque com nossas delícias artesanais.',
    isDeliveryOnly: false,
    dayIndices: [6, 0],
  },
];

export function getTodayScheduleEntries(date: Date = new Date()): ScheduleEntry[] {
  const day = date.getDay();
  return WEEKLY_SCHEDULE.filter((entry) => entry.dayIndices.includes(day));
}

export const WHATSAPP_NUMBER = '556992622250';
export const WHATSAPP_DISPLAY = '+55 69 9262-2250';
export const INSTAGRAM_URL = 'https://www.instagram.com/shawanytalita?fqnt=MXI4cmZqOHN2NTJucg==';
export const INSTAGRAM_HANDLE = '@shawanytalita';
