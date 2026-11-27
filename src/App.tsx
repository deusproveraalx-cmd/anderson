import React, { useState, useMemo } from 'react';
import {
  Home,
  Cake,
  ShoppingCart,
  Star,
  Mail,
  Check,
  Gift,
  ShieldCheck,
  Truck,
  Heart,
  MessageCircle,
  Search,
  Plus,
  Menu,
  X,
  MousePointerClick,
  Loader2,
} from 'lucide-react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  Order,
  Product,
  ProductCategory,
  WHATSAPP_DISPLAY,
  WHATSAPP_NUMBER,
} from './data/products';
import { CartDrawer, CartItem, formatBRL } from './components/CartDrawer';
import { ProductModal } from './components/ProductModal';
import { CustomOrderSection } from './components/CustomOrderSection';
import { SnowfallOverlay } from './components/SnowfallOverlay';
import { ChristmasMusicButton } from './components/ChristmasMusicButton';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminPanel } from './components/AdminPanel';
import { ThermalReceipt } from './components/ThermalReceipt';

const CATEGORIES: ProductCategory[] = ['Todos', 'Bolos', 'Doces', 'Cupcakes & Potes'];

const SERVICE_BAR_ITEMS = [
  { icon: Cake, label: 'Bolos Personalizados', href: '#encomendas' },
  { icon: Heart, label: 'Doces Variados', href: '#produtos' },
  { icon: Gift, label: 'Encomendas Especiais', href: '#encomendas' },
  { icon: Star, label: 'Qualidade Garantida', href: '#produtos' },
  { icon: ShieldCheck, label: 'Compra Segura', href: '#contato' },
];

function ChefHatSvg({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 92"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M27 56C14 54 6 42 10 29C14 16 28 11 39 17C44 6 61 2 74 9C87 3 105 10 109 25C114 39 103 53 89 55L84 78C65 84 44 84 28 77L27 56Z"
        fill="#FFFFFF"
        stroke="#4A1C10"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M31 64C49 69 69 69 85 63"
        stroke="#4A1C10"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M59 44C59 44 47 36 47 28C47 24 50.5 21 54.5 21C56.8 21 58.3 22.3 59 24C59.7 22.3 61.2 21 63.5 21C67.5 21 71 24 71 28C71 36 59 44 59 44Z"
        stroke="#4A1C10"
        strokeWidth="3.5"
        strokeLinejoin="round"
        fill="#FFF5F8"
      />
    </svg>
  );
}

export default function App() {
  const [activeNav, setActiveNav] = useState('inicio');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [adminUser, setAdminUser] = useState<User | null>(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [firestoreFatalError, setFirestoreFatalError] = useState<Error | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);

  const isAdminRoute =
    typeof window !== 'undefined' &&
    window.location.pathname.replace(/\/+$/, '') === '/admin';

  if (firestoreFatalError) {
    throw firestoreFatalError;
  }

  React.useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setAdminUser(user);
      if (!user && isAdminRoute) {
        setIsAdminModalOpen(true);
      }
    });
    return () => unsubscribeAuth();
  }, [isAdminRoute]);

  React.useEffect(() => {
    const produtosQuery = query(collection(db, 'produtos'), orderBy('createdAt', 'desc'));
    const unsubscribeProducts = onSnapshot(
      produtosQuery,
      (snapshot) => {
        const items: Product[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const rawCategory = String(data.categoria || 'Bolos');
          const validCategory: Exclude<ProductCategory, 'Todos'> =
            rawCategory === 'Doces' || rawCategory === 'Cupcakes & Potes'
              ? rawCategory
              : 'Bolos';

          return {
            id: docSnap.id,
            name: String(data.nome || 'Produto'),
            description: String(data.descricao || ''),
            price: Number(data.preco || 0),
            image: String(data.imagemUrl || ''),
            storagePath: data.storagePath ? String(data.storagePath) : undefined,
            category: validCategory,
            portion: data.porcao ? String(data.porcao) : 'Artesanal',
            fallbackGradient: 'from-[#D81B60] to-[#3A1810]',
            flavors: Array.isArray(data.sabores) && data.sabores.length > 0
              ? data.sabores.map(String)
              : ['Tradicional'],
          };
        });
        setProducts(items);
        setIsLoadingProducts(false);
      },
      (error) => {
        setIsLoadingProducts(false);
        try {
          handleFirestoreError(error, OperationType.LIST, 'produtos');
        } catch (wrapped) {
          setFirestoreFatalError(wrapped as Error);
        }
      }
    );

    return () => unsubscribeProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const matchesCategory =
        selectedCategory === 'Todos' || item.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [products, selectedCategory, searchQuery]);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2600);
  };

  const handleAddToCart = (
    product: Product,
    flavor: string,
    quantity = 1,
    note?: string
  ) => {
    const key = `${product.id}__${flavor}__${note ?? ''}`;
    setCart((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) =>
          i.key === key ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          name: product.name,
          flavor,
          note,
          price: product.price,
          quantity,
          image: product.image,
        },
      ];
    });
    showToast(`${product.name} adicionado ao carrinho`);
  };

  const handleAddCustomCakeToCart = (summary: {
    name: string;
    flavor: string;
    price: number;
    note: string;
  }) => {
    setCart((prev) => [
      ...prev,
      {
        key: `custom__${Date.now()}`,
        productId: 'bolo-personalizado',
        name: summary.name,
        flavor: summary.flavor,
        note: summary.note,
        price: summary.price,
        quantity: 1,
        image: '/assets/products/bolo-rosa-coracoes.jpg',
      },
    ]);
    showToast(`${summary.name} adicionado ao carrinho`);
  };

  const handleUpdateQuantity = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.key === key ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveItem = (key: string) => {
    setCart((prev) => prev.filter((item) => item.key !== key));
  };

  const handleClearCart = () => setCart([]);

  const whatsappDirectHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    'Olá, Delícia da Esther! Gostaria de fazer um pedido de bolos e doces.'
  )}`;

  const navLinks = [
    { id: 'inicio', label: 'Início', href: '#inicio', icon: Home },
    { id: 'produtos', label: 'Nossos Produtos', href: '#produtos', icon: Cake },
    { id: 'encomendas', label: 'Faça seu Pedido', href: '#encomendas', icon: ShoppingCart },
    { id: 'contato', label: 'Contato', href: '#contato', icon: Mail },
  ];

  const isStorefrontPreview =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('vitrine') === '1';
  const showExclusiveAdmin = Boolean(adminUser && !isStorefrontPreview);

  return (
    <>
      {showExclusiveAdmin && adminUser ? (
        <div className="min-h-screen bg-[#FFF8FB] text-[#3A150B] print:hidden">
          <AdminPanel
            user={adminUser}
            products={products}
            onRequestPrintOrder={(order) => setPrintingOrder(order)}
          />
        </div>
      ) : (
        <div className="min-h-screen bg-[#FFF0F6] text-[#3A150B] print:hidden">
      {/* TOP BAR: Dark Chocolate Gradient Bar matching the image */}
      <header className="sticky top-0 z-40 border-b-2 border-[#D99B52]/70 bg-gradient-to-b from-[#4F2012] via-[#3A140A] to-[#491D10] shadow-md">
        <div className="mx-auto flex h-16 max-w-[1380px] items-center justify-between gap-4 px-4 sm:px-6">
          {/* Top-Left Scalloped Crest Logo */}
          <a
            href="#inicio"
            onClick={() => setActiveNav('inicio')}
            className="relative z-20 flex shrink-0 items-center self-start pt-1"
            aria-label="Delícia da Esther - Início"
          >
            <div className="relative flex flex-col items-center justify-center rounded-full border-2 border-[#F9A8D4] bg-gradient-to-b from-[#FFFDFD] to-[#FFEAF2] px-3.5 py-1.5 text-center shadow-lg sm:translate-y-2 sm:px-4 sm:py-2">
              <div className="flex items-center gap-1">
                <ChefHatSvg className="h-5 w-6 -rotate-12 shrink-0" />
                <span className="font-hand text-xs font-bold leading-none text-[#4A1C10] sm:text-sm">
                  Delícia da
                </span>
              </div>
              <span className="font-script -mt-0.5 text-base leading-none text-[#E91E63] sm:text-lg">
                Esther
              </span>
              <span className="mt-0.5 rounded-full bg-gradient-to-r from-[#5A2411] via-[#8F471C] to-[#5A2411] px-2 py-0.5 text-[9px] font-semibold tracking-wide text-[#FDE68A] whitespace-nowrap">
                Bolos e Doces
              </span>
            </div>
          </a>

          {/* Center Navigation Links with vertical separators */}
          <nav
            aria-label="Navegação principal"
            className="hidden lg:flex items-center divide-x divide-white/20"
          >
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <div key={item.id} className="px-3 first:pl-0 last:pr-0">
                  <a
                    href={item.href}
                    onClick={() => setActiveNav(item.id)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-gradient-to-b from-[#FF3D86] to-[#DC145B] text-white shadow-sm'
                        : 'text-[#FFF5F8] hover:bg-white/10'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </a>
                </div>
              );
            })}
          </nav>

          {/* Right Cart Button + Mobile Toggle */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-white/60 bg-gradient-to-b from-[#FFE6F0] to-[#F9BBD4] px-4 py-1.5 text-sm font-bold text-[#3A150B] shadow-sm transition-transform hover:scale-[1.02] whitespace-nowrap"
            >
              <ShoppingCart className="h-4 w-4 text-[#3A150B]" aria-hidden="true" />
              <span>Carrinho</span>
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#3A150B] px-1.5 text-xs font-bold tabular-nums text-white">
                {totalItems}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/25 text-white lg:hidden"
              aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {isMobileMenuOpen && (
          <nav
            aria-label="Menu mobile"
            className="border-t border-white/15 bg-[#3A140A] px-4 py-3 lg:hidden"
          >
            <div className="flex flex-col gap-1">
              {navLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    onClick={() => {
                      setActiveNav(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-white hover:bg-white/10"
                  >
                    <Icon className="h-4 w-4 text-[#F9A8D4]" aria-hidden="true" />
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </div>
          </nav>
        )}
      </header>

      <main>
        {/* MAIN VISUAL STAGE — IDENTICAL TO THE USER'S IMAGE */}
        <section
          id="inicio"
          className="relative overflow-hidden"
          style={{
            background:
              'radial-gradient(circle at 50% 34%, #FFF6F9 0%, #FFD6E8 36%, #FFA8CB 74%, #F97EB1 100%)',
          }}
        >
          {/* Corner Rose Accents */}
          <img
            src="/assets/products/rose-corner-left.jpg"
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            className="pointer-events-none absolute -bottom-4 -left-4 z-0 hidden h-36 w-36 rounded-full object-cover opacity-85 mix-blend-multiply sm:block lg:h-44 lg:w-44"
            style={{
              maskImage: 'radial-gradient(circle at center, black 48%, transparent 82%)',
              WebkitMaskImage: 'radial-gradient(circle at center, black 48%, transparent 82%)',
            }}
          />
          <img
            src="/assets/products/rose-corner-right.jpg"
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            className="pointer-events-none absolute -bottom-4 -right-4 z-0 hidden h-36 w-36 rounded-full object-cover opacity-85 mix-blend-multiply sm:block lg:h-44 lg:w-44"
            style={{
              maskImage: 'radial-gradient(circle at center, black 48%, transparent 82%)',
              WebkitMaskImage: 'radial-gradient(circle at center, black 48%, transparent 82%)',
            }}
          />

          <div className="relative z-10 mx-auto max-w-[1380px] px-4 pt-6 pb-6 sm:px-6 lg:pt-8">
            {/* 3-Column Hero Composition */}
            <div className="grid items-center gap-6 lg:grid-cols-12 lg:gap-4">
              {/* LEFT: Brand Emblem Crest ("Delícia da Esther - Bolos e Doces") */}
              <div className="flex flex-col items-center text-center lg:col-span-4">
                <div className="relative w-full max-w-[360px] rounded-[46px] border-2 border-[#E6A84C] bg-[#FFF8F6]/92 px-5 pt-10 pb-6 shadow-[0_14px_34px_rgba(74,28,16,0.2)]">
                  {/* Overlapping Chef Hat */}
                  <div className="absolute -top-9 left-3 h-20 w-24 -rotate-12 drop-shadow-md">
                    <ChefHatSvg className="h-full w-full" />
                  </div>

                  {/* Script Brand Title */}
                  <div className="pl-6">
                    <p className="font-hand text-3xl font-bold leading-none text-[#4A1C10] text-outline-white sm:text-4xl">
                      Delícia da
                    </p>
                    <h1 className="font-script -mt-1 text-5xl leading-tight text-[#E91E63] text-outline-white sm:text-[3.5rem]">
                      Esther
                    </h1>
                  </div>

                  {/* Satin Chocolate-Gold Ribbon */}
                  <div className="relative -mx-7 mt-2 rounded-lg border-y-2 border-[#F0B85A] bg-gradient-to-r from-[#5A2411] via-[#8F471C] to-[#5A2411] py-1.5 px-4 shadow-md">
                    <div className="flex items-center justify-center gap-2 text-white">
                      <span className="text-[#FDE68A]" aria-hidden="true">♥</span>
                      <span className="font-hand text-2xl font-bold tracking-wide sm:text-3xl">
                        Bolos e Doces
                      </span>
                      <span className="text-[#FDE68A]" aria-hidden="true">♥</span>
                    </div>
                  </div>

                  {/* Tagline inside medallion */}
                  <p className="mt-3 font-hand text-xl font-bold leading-snug text-[#4A1C10] sm:text-2xl">
                    Feito com amor
                    <br />
                    para adoçar sua vida!
                  </p>
                  <div className="mt-1.5 flex items-center justify-center gap-2 text-[#E11D67]">
                    <span className="h-[1.5px] w-12 bg-[#E11D67]/60" />
                    <Heart className="h-4 w-4 fill-[#E11D67]/20" aria-hidden="true" />
                    <span className="h-[1.5px] w-12 bg-[#E11D67]/60" />
                  </div>
                </div>
              </div>

              {/* CENTER: Chocolate Strawberry Cake, Pink Cupcake, Brigadeiros & Slice */}
              <div className="relative flex items-center justify-center lg:col-span-5">
                <a
                  href="#produtos"
                  className="group relative w-full max-w-[540px] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D81B60]"
                  aria-label="Ver produtos da vitrine Delícia da Esther"
                >
                  <img
                    src="/assets/products/hero-centerpiece.jpg"
                    alt="Bolo de chocolate com cobertura drip e morangos frescos, cupcake rosa, brigadeiros e beijinhos"
                    referrerPolicy="no-referrer"
                    className="w-full rounded-3xl object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    style={{
                      maskImage:
                        'radial-gradient(ellipse 92% 88% at 50% 50%, black 72%, transparent 100%)',
                      WebkitMaskImage:
                        'radial-gradient(ellipse 92% 88% at 50% 50%, black 72%, transparent 100%)',
                    }}
                  />
                  {/* Tucked Cake Slice on Bottom-Right */}
                  <img
                    src="/assets/products/fatia-bolo-chocolate.jpg"
                    alt="Fatia de bolo de chocolate com morango"
                    referrerPolicy="no-referrer"
                    className="absolute -bottom-2 right-0 hidden w-36 rounded-2xl border-2 border-white/85 shadow-xl sm:block md:w-40"
                  />
                </a>
              </div>

              {/* RIGHT: Headline & 4 Pink Checkmark Bullets */}
              <div className="flex flex-col items-center text-center lg:col-span-3 lg:items-start lg:text-left">
                <h2 className="font-hand text-3xl font-bold leading-[1.12] text-[#4A1C10] text-outline-soft sm:text-4xl">
                  Porque a vida fica
                  <span className="block font-script text-[1.85rem] font-normal text-[#E11D67] sm:text-[2.15rem]">
                    mais doce com nossos
                  </span>
                  <span className="block font-script text-[2.25rem] font-normal text-[#E11D67] sm:text-[2.55rem]">
                    bolos e doces!
                  </span>
                </h2>

                {/* Sweeping Pink Underline + Heart */}
                <div className="mt-2 flex w-full max-w-[290px] items-center gap-2">
                  <div className="h-[3px] flex-1 rounded-full bg-gradient-to-r from-[#E11D67] to-[#F43F5E]" />
                  <Heart className="h-5 w-5 text-[#E11D67]" aria-hidden="true" />
                </div>

                <ul className="mt-4 space-y-2 text-left">
                  {[
                    'Bolos personalizados',
                    'Doces variados',
                    'Confeitaria artesanal',
                    'Qualidade e muito amor em cada detalhe!',
                  ].map((text) => (
                    <li
                      key={text}
                      className="flex items-start gap-2.5 text-sm font-semibold text-[#3A150B] sm:text-[15px]"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E11D67] text-white shadow-sm">
                        <Check className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />
                      </span>
                      <span className="leading-snug">{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* MIDDLE SOFT PINK PILL BAR (5 Service Pillars) */}
            <div className="mt-6 rounded-2xl border border-white/80 bg-[#FFD6E6]/92 px-3 py-3 shadow-[0_8px_24px_rgba(173,20,87,0.12)] backdrop-blur-sm lg:rounded-full lg:px-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-0 lg:divide-x lg:divide-[#D81B60]/25">
                {SERVICE_BAR_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      className="flex items-center justify-center gap-2.5 rounded-xl px-3 py-1.5 text-[#4A1C10] transition-colors hover:bg-white/55"
                    >
                      <Icon className="h-6 w-6 shrink-0 text-[#6D2816]" aria-hidden="true" />
                      <span className="text-xs font-bold leading-tight sm:text-[13px]">
                        {item.label}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* RIBBON BANNER: "Nossos Produtos em Destaque" */}
            <div className="mt-6 flex items-center justify-center gap-3">
              <span className="hidden h-[2px] w-24 bg-[#F42473]/55 sm:block" />
              <Heart className="hidden h-4 w-4 fill-[#F42473] text-[#F42473] sm:block" aria-hidden="true" />
              <div className="rounded-xl bg-gradient-to-r from-[#D81B60] via-[#F42473] to-[#D81B60] px-7 py-2 text-center shadow-md">
                <h2 className="text-base font-bold tracking-wide text-white sm:text-xl">
                  Nossos Produtos em Destaque
                </h2>
              </div>
              <Heart className="hidden h-4 w-4 fill-[#F42473] text-[#F42473] sm:block" aria-hidden="true" />
              <span className="hidden h-[2px] w-24 bg-[#F42473]/55 sm:block" />
            </div>

            {/* FEATURED 5 PRODUCT THUMBNAILS + BIG GREEN WHATSAPP CTA */}
            <div className="mt-5 grid items-center gap-4 lg:grid-cols-12">
              {/* Featured Products exclusively from Firestore */}
              <div className="lg:col-span-8">
                {isLoadingProducts ? (
                  <div className="flex min-h-[88px] items-center justify-center gap-2 rounded-xl border border-white/75 bg-white/80 px-4 py-5 text-xs font-semibold text-[#3A150B]/70 shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-[#D81B60]" aria-hidden="true" />
                    <span>Carregando vitrine...</span>
                  </div>
                ) : products.length === 0 ? (
                  <div className="flex min-h-[88px] items-center justify-center rounded-xl border border-white/75 bg-white/80 px-5 py-5 text-center shadow-sm">
                    <p className="text-sm font-medium text-[#3A150B]/75">
                      Em breve novidades na vitrine
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                    {products.slice(0, 5).map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => setActiveProduct(product)}
                        className="group relative overflow-hidden rounded-xl border-2 border-[#F42473]/75 bg-white p-1 text-left shadow-md transition-all hover:-translate-y-1 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D81B60]"
                        aria-label={`Ver ${product.name}`}
                      >
                        <div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-[#FCEEF2]">
                          <img
                            src={product.image}
                            alt={product.name}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between gap-1 px-1 pb-0.5">
                          <span className="truncate text-[11px] font-bold text-[#3A150B]">
                            {product.name.split(' ').slice(0, 2).join(' ')}
                          </span>
                          <span className="shrink-0 text-[11px] font-bold tabular-nums text-[#D81B60]">
                            {formatBRL(product.price)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Big Green Glossy WhatsApp CTA Button */}
              <div className="lg:col-span-4">
                <a
                  href={whatsappDirectHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex items-center gap-3 rounded-full border-4 border-white bg-gradient-to-b from-[#25D366] via-[#16A34A] to-[#0E7A38] px-5 py-3 text-white shadow-[0_12px_28px_rgba(22,163,74,0.38)] transition-transform hover:scale-[1.02]"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#25D366] shadow-inner">
                    <MessageCircle className="h-7 w-7 fill-white text-[#16A34A]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1 leading-tight">
                    <span className="block text-xs font-semibold text-white/95 sm:text-sm">
                      Faça já seu pedido pelo
                    </span>
                    <span className="block text-lg font-extrabold tracking-tight text-white sm:text-xl">
                      WhatsApp!
                    </span>
                    <span className="block text-lg font-extrabold tabular-nums text-[#FEF08A] drop-shadow-sm sm:text-xl">
                      {WHATSAPP_DISPLAY}
                    </span>
                  </div>
                  <MousePointerClick
                    className="h-6 w-6 shrink-0 text-white/90 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    aria-hidden="true"
                  />
                </a>
              </div>
            </div>
          </div>

          {/* CURVED CHOCOLATE FOOTER BAR matching the bottom of the image */}
          <div className="relative z-10 mt-4 border-t-2 border-[#D99B52] bg-gradient-to-r from-[#3D150A] via-[#592313] to-[#3D150A] py-3.5 text-white shadow-inner">
            <div className="mx-auto flex max-w-[1380px] flex-col items-center justify-between gap-3 px-4 sm:px-6 lg:flex-row">
              <p className="font-hand text-2xl font-bold tracking-wide text-white sm:text-[1.65rem]">
                ♡ Delícia da Esther – Sempre com você! ♡
              </p>

              <div className="flex flex-wrap items-center justify-center gap-5 text-xs font-semibold text-[#FFF5F8] sm:gap-7 sm:text-sm">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-[#F9A8D4]" aria-hidden="true" />
                  <span>Entrega Rápida</span>
                </div>
                <div className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-[#F9A8D4]" aria-hidden="true" />
                  <span>Feito com Muito Amor</span>
                </div>
                <div className="flex items-center gap-2">
                  <Cake className="h-5 w-5 text-[#F9A8D4]" aria-hidden="true" />
                  <span>Sabor que Encanta</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* INTERACTIVE FULL CATALOG ("Nossos Produtos" - Real-time from Firestore 'produtos') */}
        <section id="produtos" className="bg-[#FFF8FB] py-14">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-bold text-[#D81B60]">
                  Cardápio Completo
                </p>
                <h2 className="mt-1 font-hand text-3xl font-bold text-[#3A150B] sm:text-4xl">
                  Escolha seus Bolos e Doces
                </h2>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div
                  className="flex flex-wrap items-center gap-1 rounded-xl bg-[#FCEEF2] p-1"
                  role="tablist"
                  aria-label="Filtrar produtos por categoria"
                >
                  {CATEGORIES.map((category) => (
                    <button
                      key={category}
                      type="button"
                      role="tab"
                      aria-selected={selectedCategory === category}
                      onClick={() => setSelectedCategory(category)}
                      className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                        selectedCategory === category
                          ? 'bg-[#D81B60] text-white shadow-sm'
                          : 'text-[#3A150B]/75 hover:text-[#3A150B]'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3A150B]/45"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar produto..."
                    aria-label="Buscar produto"
                    className="min-h-[42px] w-full rounded-xl border border-[#D81B60]/20 bg-white pl-9 pr-3 text-sm text-[#3A150B] placeholder:text-[#3A150B]/45 focus:border-[#D81B60] focus:outline-none sm:w-52"
                  />
                </div>
              </div>
            </div>

            {isLoadingProducts ? (
              <div className="mt-8 flex items-center justify-center gap-2.5 rounded-2xl border border-[#D81B60]/15 bg-white p-12 text-sm font-medium text-[#3A150B]/75">
                <Loader2 className="h-5 w-5 animate-spin text-[#D81B60]" aria-hidden="true" />
                <span>Carregando produtos da vitrine...</span>
              </div>
            ) : products.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-[#D81B60]/15 bg-white p-10 text-center">
                <p className="text-base font-medium text-[#3A150B]/75">
                  Em breve novidades na vitrine
                </p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-[#D81B60]/15 bg-white p-10 text-center">
                <p className="font-display text-xl font-semibold text-[#3A150B]">
                  Nenhum produto encontrado para "{searchQuery}"
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('Todos');
                    setSearchQuery('');
                  }}
                  className="mt-4 inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#D81B60] px-5 py-2 text-xs font-semibold text-white hover:bg-[#AD1457]"
                >
                  Ver todos os itens
                </button>
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredProducts.map((product) => (
                  <article
                    key={product.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-[#D81B60]/15 bg-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveProduct(product)}
                      className={`relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br ${product.fallbackGradient} text-left`}
                      aria-label={`Ver detalhes de ${product.name}`}
                    >
                      <img
                        src={product.image}
                        alt={product.name}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </button>

                    <div className="flex flex-1 flex-col justify-between p-5">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-[#3A150B]/65">
                          <span className="font-semibold text-[#D81B60]">{product.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{product.portion}</span>
                        </div>

                        <h3 className="mt-1.5 text-base font-bold text-[#3A150B]">
                          <button
                            type="button"
                            onClick={() => setActiveProduct(product)}
                            className="text-left hover:text-[#D81B60] transition-colors"
                          >
                            {product.name}
                          </button>
                        </h3>

                        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-[#3A150B]/75">
                          {product.description}
                        </p>
                      </div>

                      <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#3A150B]/10 pt-4">
                        <span className="text-base font-bold tabular-nums text-[#3A150B]">
                          {formatBRL(product.price)}
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveProduct(product)}
                            className="min-h-[38px] rounded-lg border border-[#3A150B]/15 px-3 py-1.5 text-xs font-semibold text-[#3A150B] transition-colors hover:bg-[#FCEEF2] whitespace-nowrap"
                          >
                            Sabores
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddToCart(product, product.flavors[0], 1)}
                            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#D81B60] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#AD1457] whitespace-nowrap"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            Adicionar
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CUSTOM ORDERS & TESTIMONIALS */}
        <CustomOrderSection onAddCustomCakeToCart={handleAddCustomCakeToCart} />

        {/* CONTACT SECTION */}
        <section id="contato" className="bg-[#3A140A] py-12 text-white">
          <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-6 px-4 text-center sm:px-6 lg:flex-row lg:text-left">
            <div>
              <h2 className="font-hand text-3xl font-bold text-white">
                Delícia da Esther — Bolos e Doces
              </h2>
              <p className="mt-1 text-sm text-white/75">
                Atendimento de segunda a sábado, das 08h30 às 19h00 · Encomendas e pronta entrega pelo WhatsApp {WHATSAPP_DISPLAY}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href={whatsappDirectHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#16A34A] px-6 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-[#15803D] whitespace-nowrap"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Chamar no WhatsApp
              </a>
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/25 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 whitespace-nowrap"
              >
                Ver Carrinho ({totalItems})
              </button>
            </div>
          </div>

          <div className="mx-auto mt-8 flex max-w-[1200px] items-center justify-between border-t border-white/10 px-4 pt-5 text-xs text-white/60 sm:px-6 lg:px-8">
            <p>© {new Date().getFullYear()} Delícia da Esther — Bolos e Doces</p>
            <button
              type="button"
              onClick={() => {
                if (adminUser) {
                  window.location.href = '/admin';
                } else {
                  setIsAdminModalOpen(true);
                }
              }}
              className="text-xs font-medium text-white/65 underline-offset-4 transition-colors hover:text-[#F9A8D4] hover:underline"
            >
              {adminUser ? 'Painel Administrativo' : 'Admin'}
            </button>
          </div>
        </section>
      </main>

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onLoginSuccess={() => {
          setIsAdminModalOpen(false);
          if (isStorefrontPreview) {
            window.location.href = '/';
          }
        }}
      />

      {/* Product Detail Modal */}
      <ProductModal
        product={activeProduct}
        onClose={() => setActiveProduct(null)}
        onAddToCart={handleAddToCart}
      />

      {/* Slide-Over Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded-xl border border-[#D81B60]/25 bg-[#3A140A] px-4 py-3 text-sm text-white shadow-xl"
        >
          <Check className="h-4 w-4 shrink-0 text-[#86EFAC]" aria-hidden="true" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => {
              setToastMessage(null);
              setIsCartOpen(true);
            }}
            className="ml-1 font-semibold text-[#F9A8D4] underline underline-offset-2 hover:text-white whitespace-nowrap"
          >
            Ver carrinho
          </button>
        </div>
      )}
      {/* Subtle Christmas Effects */}
      <SnowfallOverlay />
      <ChristmasMusicButton />
    </div>
      )}

    {/* Clean 80mm Thermal Receipt (Visible only when printing) */}
    <div id="thermal-receipt-print" className="hidden print:block">
      <ThermalReceipt order={printingOrder} />
    </div>
  </>
  );
}
