export type ProductCategory = 'Todos' | 'Bolos' | 'Doces' | 'Cupcakes & Potes';

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

export const WHATSAPP_NUMBER = '556992622250';
export const WHATSAPP_DISPLAY = '+55 69 9262-2250';
