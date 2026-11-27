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
  LogOut,
  ShieldAlert,
  PartyPopper,
  LayoutGrid,
  List,
  Instagram,
  MapPin,
  Clock,
  CalendarDays,
} from 'lucide-react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  DEFAULT_CATALOG_PRODUCTS,
  getTodayScheduleEntries,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  Order,
  Product,
  ProductCategory,
  UserRole,
  WEEKLY_SCHEDULE,
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

const CATEGORIES: ProductCategory[] = [
  'Todos',
  'Bolos',
  'Doces',
  'Taças',
  'Combos para Festas',
];

const SERVICE_BAR_ITEMS = [
  { icon: Cake, label: 'Bolos Personalizados', href: '#encomendas' },
  { icon: MapPin, label: 'Onde Estamos na Semana', href: '#agenda' },
  { icon: PartyPopper, label: 'Combos para Festas', href: '#combos' },
  { icon: Gift, label: 'Encomendas Especiais', href: '#encomendas' },
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
  const [userRole, setUserRole] = useState<UserRole>('none');
  const [isResolvingRole, setIsResolvingRole] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [firestoreFatalError, setFirestoreFatalError] = useState<Error | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [catalogViewMode, setCatalogViewMode] = useState<'grid' | 'list'>('grid');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const authCheckSeqRef = React.useRef(0);

  if (firestoreFatalError) {
    throw firestoreFatalError;
  }

  React.useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      const checkSeq = ++authCheckSeqRef.current;

      if (!user) {
        setAdminUser(null);
        setUserRole('none');
        setIsResolvingRole(false);
        return;
      }

      setAdminUser(user);
      setIsResolvingRole(true);

      if (user.email?.toLowerCase() === 'deusproveraalx@gmail.com') {
        if (authCheckSeqRef.current === checkSeq) {
          setUserRole('admin');
          setIsResolvingRole(false);
        }
        return;
      }

      let resolvedRole: UserRole = 'none';

      try {
        const adminSnap = await getDoc(doc(db, 'admins', user.uid));
        if (adminSnap.exists()) {
          resolvedRole = 'admin';
        }
      } catch {
        // Non-admin or unverified accounts will receive permission-denied on /admins
      }

      if (resolvedRole === 'none') {
        try {
          const staffSnap = await getDoc(doc(db, 'atendentes', user.uid));
          if (staffSnap.exists() && staffSnap.data()?.ativo === true) {
            resolvedRole = 'atendente';
          }
        } catch {
          resolvedRole = 'none';
        }
      }

      if (authCheckSeqRef.current === checkSeq) {
        setUserRole(resolvedRole);
        setIsResolvingRole(false);
      }
    });
    return () => {
      authCheckSeqRef.current += 1;
      unsubscribeAuth();
    };
  }, []);

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
              ? 'Doces'
              : rawCategory === 'Taças'
                ? 'Taças'
                : rawCategory === 'Combos para Festas'
                  ? 'Combos para Festas'
                  : 'Bolos';
          const defaultMatch = DEFAULT_CATALOG_PRODUCTS.find((d) => d.id === docSnap.id);

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
            flavors:
              validCategory === 'Taças'
                ? []
                : Array.isArray(data.sabores) && data.sabores.length > 0
                  ? data.sabores.map(String)
                  : defaultMatch?.flavors ?? ['Tradicional'],
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

  const allCatalogProducts = useMemo(() => {
    const missingDefaults = DEFAULT_CATALOG_PRODUCTS.filter((defItem) => {
      if (products.some((p) => p.id === defItem.id)) {
        return false;
      }
      if (typeof window !== 'undefined') {
        const deletedPerId =
          window.localStorage.getItem(`delicia_combo_synced_${defItem.id}`) === 'deleted';
        const deletedLegacy =
          defItem.id === 'combo-1' &&
          window.localStorage.getItem('delicia_combo1_synced') === 'deleted';
        if (deletedPerId || deletedLegacy) {
          return false;
        }
      }
      return true;
    });
    return [...products, ...missingDefaults];
  }, [products]);

  const partyCombos = useMemo(
    () => allCatalogProducts.filter((item) => item.category === 'Combos para Festas'),
    [allCatalogProducts]
  );

  const filteredProducts = useMemo(() => {
    return allCatalogProducts.filter((item) => {
      const matchesCategory =
        selectedCategory === 'Todos' || item.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.portion.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [allCatalogProducts, selectedCategory, searchQuery]);

  const todayScheduleEntries = useMemo(() => getTodayScheduleEntries(), []);
  const todayScheduleIds = useMemo(
    () => new Set(todayScheduleEntries.map((entry) => entry.id)),
    [todayScheduleEntries]
  );

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
    { id: 'produtos', label: 'Produtos', href: '#produtos', icon: Cake },
    { id: 'combos', label: 'Combos', href: '#combos', icon: PartyPopper },
    { id: 'encomendas', label: 'Personalizar', href: '#encomendas', icon: ShoppingCart },
    { id: 'agenda', label: 'Onde Estamos', href: '#agenda', icon: MapPin },
  ];

  const isStorefrontPreview =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('vitrine') === '1';
  const showExclusiveAdmin = Boolean(adminUser && !isStorefrontPreview);

  return (
    <>
      {showExclusiveAdmin && adminUser ? (
        <div className="min-h-screen bg-[#FFF8FB] text-[#3A150B] print:hidden">
          {isResolvingRole ? (
            <div className="flex min-h-screen items-center justify-center p-6">
              <div className="flex items-center gap-3 rounded-2xl border border-[#D81B60]/20 bg-white px-6 py-5 shadow-sm">
                <Loader2 className="h-5 w-5 animate-spin text-[#D81B60]" aria-hidden="true" />
                <span className="text-sm font-semibold text-[#3A150B]">
                  Verificando permissões de acesso...
                </span>
              </div>
            </div>
          ) : userRole === 'none' ? (
            <div className="flex min-h-screen items-center justify-center p-6">
              <div className="w-full max-w-md rounded-2xl border border-[#DC2626]/25 bg-white p-7 text-center shadow-lg">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FEF2F2] text-[#DC2626]">
                  <ShieldAlert className="h-6 w-6" aria-hidden="true" />
                </div>
                <h1 className="mt-4 font-display text-xl font-bold text-[#3A150B]">
                  Acesso restrito
                </h1>
                <p className="mt-2 text-sm text-[#3A150B]/75">
                  A conta <strong>{adminUser.email}</strong> não possui permissão ativa para acessar os pedidos ou foi desativada pelo administrador.
                </p>
                <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={() => signOut(auth)}
                    className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-[#D81B60] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#AD1457]"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sair (Logout)
                  </button>
                  <a
                    href="/?vitrine=1"
                    className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-[#3A150B]/20 px-5 py-2 text-sm font-semibold text-[#3A150B] hover:bg-[#FCEEF2]"
                  >
                    Ver Loja
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <AdminPanel
              user={adminUser}
              role={userRole}
              products={products}
              onRequestPrintOrder={(order) => setPrintingOrder(order)}
            />
          )}
        </div>
      ) : (
        <div className="min-h-screen overflow-x-hidden bg-[#FFF0F6] pb-20 text-[#3A150B] lg:pb-0 print:hidden">
      {/* TOP BAR: Dark Chocolate Gradient Bar matching the image */}
      <header className="sticky top-0 z-40 border-b-2 border-[#D99B52]/70 bg-gradient-to-b from-[#4F2012] via-[#3A140A] to-[#491D10] shadow-md">
        <div className="mx-auto flex h-16 w-full max-w-[1100px] items-center justify-between gap-2 px-5 sm:gap-4 sm:px-6 lg:px-8">
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

          {/* Right Cart Button + Instagram + Mobile Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Instagram ${INSTAGRAM_HANDLE}`}
              title={`Instagram ${INSTAGRAM_HANDLE}`}
              className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-[#F9A8D4] transition-colors hover:bg-white/20 hover:text-white"
            >
              <Instagram className="h-5 w-5" aria-hidden="true" />
            </a>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-white/60 bg-gradient-to-b from-[#FFE6F0] to-[#F9BBD4] px-3.5 py-1.5 text-sm font-bold text-[#3A150B] shadow-sm transition-transform hover:scale-[1.02] sm:px-4 whitespace-nowrap"
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
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-[#F9A8D4] hover:bg-white/10"
              >
                <Instagram className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Instagram ({INSTAGRAM_HANDLE})</span>
              </a>
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

          <div className="relative z-10 mx-auto w-full max-w-[1100px] px-5 pt-6 pb-6 sm:px-6 lg:px-8 lg:pt-8">
            {/* Vitrine Interativa em Destaque (Largura total alinhada) */}
            <div className="flex min-w-0 w-full flex-col justify-between rounded-3xl border-2 border-white/95 bg-white/92 p-4 shadow-[0_14px_34px_rgba(173,20,87,0.16)] backdrop-blur-sm sm:p-6">
              <div className="min-w-0 w-full">
                {/* Top Row: Title + Quick Search + Full Catalog Link */}
                <div className="caixa-flex md:items-center md:justify-between">
                  <div className="flex items-baseline justify-between gap-2">
                    <h1 className="font-hand text-2xl font-bold text-[#4A1C10] sm:text-3xl">
                      Vitrine em Destaque
                    </h1>
                    <a
                      href="#produtos"
                      className="text-xs font-bold text-[#D81B60] underline underline-offset-2 hover:text-[#AD1457] md:hidden whitespace-nowrap"
                    >
                      Ver tudo ({allCatalogProducts.length})
                    </a>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 md:w-64 md:flex-none">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3A150B]/45"
                        aria-hidden="true"
                      />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="O que você procura?"
                        aria-label="Buscar produto na vitrine"
                        className="min-h-[38px] w-full rounded-xl border border-[#D81B60]/25 bg-white pl-9 pr-3 text-xs font-medium text-[#3A150B] placeholder:text-[#3A150B]/45 focus:border-[#D81B60] focus:outline-none"
                      />
                    </div>
                    <a
                      href="#produtos"
                      className="hidden text-xs font-bold text-[#D81B60] underline underline-offset-2 hover:text-[#AD1457] md:inline whitespace-nowrap"
                    >
                      Ver tudo ({allCatalogProducts.length})
                    </a>
                  </div>
                </div>

                {/* Category Filter Tabs right inside Vitrine */}
                <div
                  className="mt-3 flex w-full max-w-full items-center gap-1.5 overflow-x-auto rounded-xl bg-[#FCEEF2] p-1"
                  role="tablist"
                  aria-label="Filtrar vitrine por categoria"
                >
                  {CATEGORIES.map((category) => {
                    const count =
                      category === 'Todos'
                        ? allCatalogProducts.length
                        : allCatalogProducts.filter((p) => p.category === category).length;
                    return (
                      <button
                        key={`hero-${category}`}
                        type="button"
                        role="tab"
                        aria-selected={selectedCategory === category}
                        onClick={() => setSelectedCategory(category)}
                        className={`min-h-[34px] shrink-0 rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                          selectedCategory === category
                            ? 'bg-[#D81B60] text-white shadow-sm'
                            : 'text-[#3A150B]/75 hover:text-[#3A150B]'
                        }`}
                      >
                        {category} ({count})
                      </button>
                    );
                  })}
                </div>

                {/* Product Cards Grid */}
                {isLoadingProducts ? (
                  <div className="mt-4 flex min-h-[240px] items-center justify-center gap-2 rounded-2xl border border-[#D81B60]/15 bg-white px-4 py-8 text-xs font-semibold text-[#3A150B]/70">
                    <Loader2 className="h-4 w-4 animate-spin text-[#D81B60]" aria-hidden="true" />
                    <span>Carregando vitrine...</span>
                  </div>
                ) : allCatalogProducts.length === 0 ? (
                  <div className="mt-4 flex min-h-[240px] items-center justify-center rounded-2xl border border-[#D81B60]/15 bg-white px-5 py-8 text-center">
                    <p className="text-sm font-medium text-[#3A150B]/75">
                      Em breve novidades na vitrine
                    </p>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="mt-4 flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-[#D81B60]/15 bg-white px-5 py-8 text-center">
                    <p className="text-sm font-semibold text-[#3A150B]">
                      Nenhum item encontrado para essa busca.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('Todos');
                        setSearchQuery('');
                      }}
                      className="mt-3 inline-flex min-h-[36px] items-center justify-center rounded-lg bg-[#D81B60] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#AD1457]"
                    >
                      Mostrar todos os produtos
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-3">
                    {filteredProducts.slice(0, 6).map((product) => {
                      const isContain =
                        product.category === 'Combos para Festas' || product.category === 'Taças';
                      return (
                        <div
                          key={`hero-card-${product.id}`}
                          className="group flex h-full flex-col justify-between overflow-hidden rounded-xl border border-[#D81B60]/20 bg-white p-2 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#D81B60] hover:shadow-md sm:p-2.5"
                        >
                          <button
                            type="button"
                            onClick={() => setActiveProduct(product)}
                            className="text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D81B60]"
                            aria-label={`Ver ${product.name}`}
                          >
                            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-white">
                              <img
                                src={product.image}
                                alt={product.name}
                                referrerPolicy="no-referrer"
                                className={`h-full w-full transition-transform duration-300 group-hover:scale-105 ${
                                  isContain ? 'object-contain' : 'object-cover'
                                }`}
                              />
                              {product.category === 'Taças' && (
                                <span className="pointer-events-none absolute inset-x-1 bottom-1 rounded bg-[#260E09]/80 px-1 py-0.5 text-center text-[8px] font-bold tracking-wide text-white uppercase">
                                  Imagens ilustrativas
                                </span>
                              )}
                            </div>
                            <p className="mt-1.5 truncate text-xs font-bold text-[#3A150B] sm:text-sm">
                              {product.name}
                            </p>
                          </button>

                          <div className="mt-1.5 flex items-center justify-between gap-1.5 border-t border-[#3A150B]/10 pt-1.5">
                            <span className="text-xs font-extrabold tabular-nums text-[#D81B60] sm:text-sm">
                              {formatBRL(product.price)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleAddToCart(
                                  product,
                                  product.category === 'Taças'
                                    ? 'Montada conforme descrição'
                                    : product.flavors[0] ?? 'Tradicional',
                                  1
                                )
                              }
                              className="inline-flex min-h-[30px] items-center gap-1 rounded-lg bg-[#D81B60] px-2.5 py-1 text-[10px] font-bold text-white transition-colors hover:bg-[#AD1457] sm:text-xs whitespace-nowrap"
                            >
                              <Plus className="h-3 w-3 shrink-0" aria-hidden="true" />
                              Pedir
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {filteredProducts.length > 6 && (
                <div className="mt-3 flex justify-end">
                  <a
                    href="#produtos"
                    className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-[#FCEEF2] px-3 py-1 text-xs font-bold text-[#D81B60] transition-colors hover:bg-[#F9D7E5]"
                  >
                    Ver mais {filteredProducts.length - 6} produtos abaixo
                  </a>
                </div>
              )}
            </div>

            {/* Highlights & Mobile Quick-Access */}
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm sm:grid-cols-4">
              {[
                'Bolos artesanais',
                'Doces variados',
                'Taças especiais',
                'Combos para festas',
              ].map((text) => (
                <li
                  key={text}
                  className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#3A150B]"
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#E11D67] text-white">
                    <Check className="h-2.5 w-2.5 stroke-[3]" aria-hidden="true" />
                  </span>
                  <span className="truncate">{text}</span>
                </li>
              ))}
            </ul>

            <div className="mt-3 grid grid-cols-2 gap-2 lg:hidden">
              <a
                href="#produtos"
                onClick={() => setSelectedCategory('Todos')}
                className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-[#D81B60] px-3 py-2 text-xs font-bold text-white shadow-md transition-colors hover:bg-[#AD1457] whitespace-nowrap"
              >
                <Cake className="h-4 w-4 shrink-0" aria-hidden="true" />
                Ver Produtos ({allCatalogProducts.length})
              </a>
              <a
                href="#agenda"
                className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[#D81B60]/35 bg-white px-3 py-2 text-xs font-bold text-[#D81B60] shadow-sm transition-colors hover:bg-[#FCEEF2] whitespace-nowrap"
              >
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                Onde Estamos
              </a>
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
                      <Icon className="h-5 w-5 shrink-0 text-[#6D2816]" aria-hidden="true" />
                      <span className="text-xs font-bold leading-tight sm:text-[13px]">
                        {item.label}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>

            {/* WHATSAPP CTA ROW */}
            <div className="mt-6 flex justify-center">
              <a
                href={whatsappDirectHref}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex w-full max-w-[460px] items-center gap-3 rounded-full border-4 border-white bg-gradient-to-b from-[#25D366] via-[#16A34A] to-[#0E7A38] px-5 py-3 text-white shadow-[0_12px_28px_rgba(22,163,74,0.38)] transition-transform hover:scale-[1.02]"
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

          {/* CURVED CHOCOLATE FOOTER BAR matching the bottom of the image */}
          <div className="relative z-10 mt-4 border-t-2 border-[#D99B52] bg-gradient-to-r from-[#3D150A] via-[#592313] to-[#3D150A] py-3.5 text-white shadow-inner">
            <div className="caixa-flex mx-auto w-full max-w-[1100px] items-center justify-between px-5 sm:px-6 lg:px-8">
              <p className="text-center font-hand text-2xl font-bold tracking-wide text-white sm:text-[1.65rem] md:text-left">
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
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#F9A8D4]/45 bg-white/10 px-3 py-1 text-xs font-bold text-[#F9A8D4] transition-colors hover:bg-white/20 hover:text-white"
                >
                  <Instagram className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{INSTAGRAM_HANDLE}</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* INTERACTIVE FULL CATALOG ("Nossos Produtos" - Placed right after Hero for quick product finding) */}
        <section id="produtos" className="bg-[#FFF8FB] py-10 sm:py-14">
          <div className="mx-auto w-full max-w-[1100px] px-5 sm:px-6 lg:px-8">
            <div className="caixa-flex md:items-end md:justify-between">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-[#D81B60]">
                    Cardápio Completo ({allCatalogProducts.length})
                  </p>
                  <h2 className="mt-0.5 font-hand text-2xl font-bold text-[#3A150B] sm:text-4xl">
                    Escolha seus Bolos e Doces
                  </h2>
                </div>

                {/* Mobile Grid/List Switcher */}
                <div
                  className="inline-flex shrink-0 items-center rounded-xl border border-[#D81B60]/20 bg-white p-1 sm:hidden"
                  role="group"
                  aria-label="Modo de visualização no celular"
                >
                  <button
                    type="button"
                    onClick={() => setCatalogViewMode('grid')}
                    aria-pressed={catalogViewMode === 'grid'}
                    aria-label="Visualizar em grade"
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                      catalogViewMode === 'grid'
                        ? 'bg-[#D81B60] text-white'
                        : 'text-[#3A150B]/65'
                    }`}
                  >
                    <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogViewMode('list')}
                    aria-pressed={catalogViewMode === 'list'}
                    aria-label="Visualizar em lista"
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                      catalogViewMode === 'list'
                        ? 'bg-[#D81B60] text-white'
                        : 'text-[#3A150B]/65'
                    }`}
                  >
                    <List className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="flex min-w-0 w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                <div
                  className="flex w-full max-w-full items-center gap-1.5 overflow-x-auto rounded-xl bg-[#FCEEF2] p-1 sm:w-auto sm:flex-wrap"
                  role="tablist"
                  aria-label="Filtrar produtos por categoria"
                >
                  {CATEGORIES.map((category) => {
                    const count =
                      category === 'Todos'
                        ? allCatalogProducts.length
                        : allCatalogProducts.filter((p) => p.category === category).length;
                    return (
                      <button
                        key={category}
                        type="button"
                        role="tab"
                        aria-selected={selectedCategory === category}
                        onClick={() => setSelectedCategory(category)}
                        className={`min-h-[36px] shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                          selectedCategory === category
                            ? 'bg-[#D81B60] text-white shadow-sm'
                            : 'text-[#3A150B]/75 hover:text-[#3A150B]'
                        }`}
                      >
                        {category} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {isLoadingProducts ? (
              <div className="mt-6 flex items-center justify-center gap-2.5 rounded-2xl border border-[#D81B60]/15 bg-white p-12 text-sm font-medium text-[#3A150B]/75">
                <Loader2 className="h-5 w-5 animate-spin text-[#D81B60]" aria-hidden="true" />
                <span>Carregando produtos da vitrine...</span>
              </div>
            ) : allCatalogProducts.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-[#D81B60]/15 bg-white p-10 text-center">
                <p className="text-base font-medium text-[#3A150B]/75">
                  Em breve novidades na vitrine
                </p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-[#D81B60]/15 bg-white p-10 text-center">
                <p className="font-display text-xl font-semibold text-[#3A150B]">
                  Nenhum produto encontrado
                  {searchQuery ? ` para "${searchQuery}"` : ' nesta categoria'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('Todos');
                    setSearchQuery('');
                  }}
                  className="mt-4 inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#D81B60] px-5 py-2 text-xs font-semibold text-white hover:bg-[#AD1457]"
                >
                  Ver todos os produtos
                </button>
              </div>
            ) : catalogViewMode === 'list' ? (
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
                {filteredProducts.map((product) => {
                  const isCombo =
                    product.category === 'Combos para Festas' || product.category === 'Taças';
                  return (
                    <article
                      key={product.id}
                      className="flex flex-row overflow-hidden rounded-2xl border border-[#D81B60]/15 bg-white shadow-sm sm:flex-col"
                    >
                      <button
                        type="button"
                        onClick={() => setActiveProduct(product)}
                        className={`relative w-28 shrink-0 overflow-hidden sm:aspect-[4/3] sm:w-full ${
                          isCombo
                            ? 'bg-white p-1.5'
                            : `bg-gradient-to-br ${product.fallbackGradient}`
                        } text-left`}
                        aria-label={`Ver detalhes de ${product.name}`}
                      >
                        <img
                          src={product.image}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className={`h-full w-full ${
                            isCombo ? 'object-contain' : 'object-cover'
                          }`}
                        />
                        {product.category === 'Taças' && (
                          <span className="pointer-events-none absolute inset-x-1.5 bottom-1.5 rounded bg-[#260E09]/80 px-1.5 py-0.5 text-center text-[9px] font-bold tracking-wide text-white uppercase shadow-sm sm:text-[10px]">
                            Imagens ilustrativas
                          </span>
                        )}
                      </button>

                      <div className="flex min-w-0 flex-1 flex-col justify-between p-3 sm:p-5">
                        <div>
                          <p className="truncate text-[11px] font-semibold text-[#D81B60]">
                            {product.category}
                            {product.portion ? ` · ${product.portion}` : ''}
                          </p>
                          <h3 className="mt-0.5 line-clamp-1 text-sm font-bold text-[#3A150B] sm:text-base">
                            <button
                              type="button"
                              onClick={() => setActiveProduct(product)}
                              className="text-left hover:text-[#D81B60]"
                            >
                              {product.name}
                            </button>
                          </h3>
                          <p className="mt-1 line-clamp-2 text-xs leading-snug text-[#3A150B]/75 sm:text-sm">
                            {product.description}
                          </p>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#3A150B]/10 pt-2.5 sm:mt-4 sm:pt-3">
                          <span className="text-sm font-extrabold tabular-nums text-[#D81B60] sm:text-base">
                            {formatBRL(product.price)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setActiveProduct(product)}
                              className="min-h-[34px] rounded-lg border border-[#3A150B]/15 px-2.5 py-1 text-[11px] font-semibold text-[#3A150B] hover:bg-[#FCEEF2]"
                            >
                              {product.category === 'Taças' ? 'Detalhes' : 'Sabores'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleAddToCart(
                                  product,
                                  product.category === 'Taças'
                                    ? 'Montada conforme descrição'
                                    : product.flavors[0] ?? 'Tradicional',
                                  1
                                )
                              }
                              className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-[#D81B60] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#AD1457]"
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                              Adicionar
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3 lg:gap-6">
                {filteredProducts.map((product) => {
                  const isCombo =
                    product.category === 'Combos para Festas' || product.category === 'Taças';
                  return (
                    <article
                      key={product.id}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-[#D81B60]/15 bg-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <button
                        type="button"
                        onClick={() => setActiveProduct(product)}
                        className={`relative aspect-square w-full overflow-hidden text-left sm:aspect-[4/3] ${
                          isCombo
                            ? 'bg-white p-1.5 sm:p-2'
                            : `bg-gradient-to-br ${product.fallbackGradient}`
                        }`}
                        aria-label={`Ver detalhes de ${product.name}`}
                      >
                        <img
                          src={product.image}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className={`h-full w-full transition-transform duration-300 group-hover:scale-[1.03] ${
                            isCombo ? 'object-contain' : 'object-cover'
                          }`}
                        />
                        {product.category === 'Taças' && (
                          <span className="pointer-events-none absolute inset-x-2 bottom-2 rounded-md bg-[#260E09]/80 px-2 py-0.5 text-center text-[9px] font-bold tracking-wide text-white uppercase shadow-sm sm:text-[10px]">
                            Imagens ilustrativas
                          </span>
                        )}
                      </button>

                      <div className="flex flex-1 flex-col justify-between p-3 sm:p-5">
                        <div>
                          <div className="flex flex-wrap items-center gap-1 text-[10px] text-[#3A150B]/65 sm:gap-2 sm:text-xs">
                            <span className="font-semibold text-[#D81B60]">{product.category}</span>
                            {product.portion && (
                              <span className="hidden sm:inline truncate">· {product.portion}</span>
                            )}
                          </div>

                          <h3 className="mt-1 line-clamp-2 text-sm font-bold leading-snug text-[#3A150B] sm:text-base">
                            <button
                              type="button"
                              onClick={() => setActiveProduct(product)}
                              className="text-left transition-colors hover:text-[#D81B60]"
                            >
                              {product.name}
                            </button>
                          </h3>

                          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[#3A150B]/75 sm:mt-1.5 sm:text-sm sm:leading-relaxed">
                            {product.description}
                          </p>
                        </div>

                        <div className="mt-3 flex flex-col gap-2 border-t border-[#3A150B]/10 pt-2.5 md:mt-5 md:flex-row md:items-center md:justify-between md:pt-4">
                          <span className="text-sm font-extrabold tabular-nums text-[#D81B60] sm:text-base sm:text-[#3A150B]">
                            {formatBRL(product.price)}
                          </span>

                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveProduct(product)}
                              className="min-h-[34px] flex-1 rounded-lg border border-[#3A150B]/15 px-2 py-1 text-[11px] font-semibold text-[#3A150B] transition-colors hover:bg-[#FCEEF2] sm:min-h-[38px] sm:flex-none sm:px-3 sm:text-xs whitespace-nowrap"
                            >
                              {product.category === 'Taças' ? 'Detalhes' : 'Sabores'}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleAddToCart(
                                  product,
                                  product.category === 'Taças'
                                    ? 'Montada conforme descrição'
                                    : product.flavors[0] ?? 'Tradicional',
                                  1
                                )
                              }
                              className="inline-flex min-h-[34px] flex-1 items-center justify-center gap-1 rounded-lg bg-[#D81B60] px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#AD1457] sm:min-h-[38px] sm:flex-none sm:px-3.5 sm:text-xs whitespace-nowrap"
                            >
                              <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              Adicionar
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* COMBOS PARA FESTAS (Exclusively from Firestore 'produtos' with category 'Combos para Festas') */}
        <section id="combos" className="border-t border-[#D81B60]/15 bg-gradient-to-b from-[#FFF0F6] to-[#FFF8FB] py-14">
          <div className="mx-auto w-full max-w-[1100px] px-5 sm:px-6 lg:px-8">
            <div className="caixa-flex md:items-end md:justify-between">
              <div>
                <p className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D81B60]">
                  <PartyPopper className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Kits Completos para Comemorar
                </p>
                <h2 className="mt-1 font-hand text-3xl font-bold text-[#3A150B] sm:text-4xl">
                  Combos para Festas
                </h2>
                <p className="mt-1 text-sm text-[#3A150B]/75">
                  Praticidade e economia com bolo, docinhos e mimos artesanais prontos para a sua celebração.
                </p>
              </div>
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                  'Olá, Delícia da Esther! Gostaria de consultar ou montar um Combo para Festa.'
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-xl border border-[#16A34A]/35 bg-[#F0FDF4] px-4 py-2 text-xs font-bold text-[#15803D] transition-colors hover:bg-[#DCFCE7] whitespace-nowrap"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Orçar Combo no WhatsApp
              </a>
            </div>

            {isLoadingProducts ? (
              <div className="mt-8 flex items-center justify-center gap-2.5 rounded-2xl border border-[#D81B60]/15 bg-white p-10 text-sm font-medium text-[#3A150B]/75">
                <Loader2 className="h-5 w-5 animate-spin text-[#D81B60]" aria-hidden="true" />
                <span>Carregando combos para festas...</span>
              </div>
            ) : partyCombos.length === 0 ? (
              <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#D81B60]/15 bg-white p-8 text-center sm:flex-row sm:text-left">
                <div>
                  <p className="text-base font-medium text-[#3A150B]/80">
                    Em breve novos combos para festas na vitrine
                  </p>
                  <p className="mt-1 text-xs text-[#3A150B]/60">
                    Você também pode montar seu bolo personalizado logo abaixo ou pedir um kit completo pelo WhatsApp.
                  </p>
                </div>
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
                    'Olá, Delícia da Esther! Gostaria de montar um combo para festa (bolo + docinhos).'
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-2 rounded-xl bg-[#16A34A] px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#15803D] whitespace-nowrap"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  Pedir Combo no WhatsApp
                </a>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
                {partyCombos.map((combo) => (
                  <article
                    key={combo.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border-2 border-[#D81B60]/25 bg-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveProduct(combo)}
                      className="relative aspect-square w-full overflow-hidden bg-white p-1.5 text-left sm:p-2"
                      aria-label={`Ver detalhes de ${combo.name}`}
                    >
                      <img
                        src={combo.image}
                        alt={combo.name}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#D81B60] px-2 py-0.5 text-[10px] font-bold text-white shadow-sm sm:left-3 sm:top-3 sm:px-3 sm:py-1 sm:text-[11px]">
                        <PartyPopper className="h-3 w-3" aria-hidden="true" />
                        Combo Festa
                      </span>
                    </button>

                    <div className="flex flex-1 flex-col justify-between p-3 sm:p-5">
                      <div>
                        <p className="line-clamp-2 text-[10px] font-bold uppercase tracking-wide text-[#D81B60] sm:text-xs">
                          {combo.portion || 'Kit Completo para Festa'}
                        </p>
                        <h3 className="mt-1 text-base font-extrabold text-[#3A150B] sm:text-xl">
                          <button
                            type="button"
                            onClick={() => setActiveProduct(combo)}
                            className="text-left transition-colors hover:text-[#D81B60]"
                          >
                            {combo.name}
                          </button>
                        </h3>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[#3A150B]/80 sm:mt-1.5 sm:line-clamp-3 sm:text-sm sm:leading-relaxed">
                          {combo.description}
                        </p>
                      </div>

                      <div className="mt-3 flex flex-col gap-2 border-t border-[#3A150B]/10 pt-2.5 md:mt-5 md:flex-row md:items-center md:justify-between md:pt-4">
                        <span className="text-base font-extrabold tabular-nums text-[#D81B60] sm:text-xl">
                          {formatBRL(combo.price)}
                        </span>

                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveProduct(combo)}
                            className="min-h-[34px] flex-1 rounded-lg border border-[#3A150B]/15 px-2 py-1 text-[11px] font-semibold text-[#3A150B] transition-colors hover:bg-[#FCEEF2] sm:min-h-[38px] sm:flex-none sm:px-3 sm:text-xs whitespace-nowrap"
                          >
                            Sabores
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddToCart(combo, combo.flavors[0], 1)}
                            className="inline-flex min-h-[34px] flex-1 items-center justify-center gap-1 rounded-lg bg-[#D81B60] px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#AD1457] sm:min-h-[38px] sm:flex-none sm:px-3.5 sm:text-xs whitespace-nowrap"
                          >
                            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
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

        {/* CUSTOM ORDERS */}
        <CustomOrderSection onAddCustomCakeToCart={handleAddCustomCakeToCart} />

        {/* AGENDA DA SEMANA */}
        <section
          id="agenda"
          className="border-b border-[#D81B60]/15 bg-white py-12 sm:py-14"
        >
          <div className="mx-auto w-full max-w-[1100px] px-5 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-[#3A150B]/12 bg-[#FFFDFD] p-5 shadow-sm sm:p-8">
              <div className="caixa-flex md:items-end md:justify-between">
                <div>
                  <p className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D81B60]">
                    <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Agenda Oficial da Semana
                  </p>
                  <h2 className="mt-1 font-hand text-3xl font-bold text-[#3A150B] sm:text-4xl">
                    Onde Estaremos
                  </h2>
                  <p className="mt-1.5 text-sm text-[#3A150B]/75">
                    Confira os dias, horários e pontos de atendimento para retirar suas delícias ou peça pelo Delivery direto pelo site e WhatsApp.
                  </p>
                </div>

                {todayScheduleEntries.length > 0 && (
                  <div className="shrink-0 rounded-xl border border-[#D81B60]/25 bg-[#FFF0F6] px-4 py-2.5 text-xs text-[#3A150B]">
                    <span className="font-bold text-[#D81B60]">Hoje: </span>
                    <span className="font-semibold">
                      {todayScheduleEntries
                        .map((entry) => `${entry.location} (${entry.hours})`)
                        .join(' · ')}
                    </span>
                  </div>
                )}
              </div>

              <ul className="mt-6 divide-y divide-[#3A150B]/10 border-y border-[#3A150B]/10">
                {WEEKLY_SCHEDULE.map((entry) => {
                  const isToday = todayScheduleIds.has(entry.id);
                  const Icon = entry.isDeliveryOnly ? Truck : MapPin;
                  return (
                    <li
                      key={entry.id}
                      className={`flex flex-col gap-1.5 px-3 py-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${
                        isToday ? 'bg-[#FFF5F9]' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            isToday
                              ? 'bg-[#D81B60] text-white'
                              : 'bg-[#FCEEF2] text-[#D81B60]'
                          }`}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-bold text-[#3A150B]">
                            <span>{entry.dayLabel}</span>
                            {isToday && (
                              <span className="text-xs font-extrabold text-[#D81B60]">
                                · Hoje
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-[#9D174D]">
                            {entry.location}
                          </p>
                          <p className="text-xs text-[#3A150B]/70">
                            {entry.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5 pl-12 text-xs font-bold tabular-nums text-[#3A150B] sm:pl-0">
                        <Clock className="h-3.5 w-3.5 text-[#D81B60]" aria-hidden="true" />
                        <span className="whitespace-nowrap">{entry.hours}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="caixa-flex mt-5 items-stretch pt-1 md:items-center md:justify-between">
                <p className="text-xs font-medium text-[#3A150B]/75">
                  Prefere receber em casa ou retirar seu pedido no ponto mais próximo?
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={whatsappDirectHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-[#16A34A] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#15803D] whitespace-nowrap"
                  >
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    Fazer Pedido
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CONTACT SECTION */}
        <section id="contato" className="bg-[#3A140A] py-12 text-white">
          <div className="caixa-flex mx-auto w-full max-w-[1100px] items-center justify-between px-5 text-center sm:px-6 lg:px-8 md:text-left">
            <div>
              <h2 className="font-hand text-3xl font-bold text-white">
                Delícia da Esther — Bolos e Doces
              </h2>
              <p className="mt-1 text-sm text-white/75">
                Segunda: apenas Delivery · Terça a domingo: confira nossa Agenda da Semana · WhatsApp {WHATSAPP_DISPLAY}
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
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] px-6 py-2.5 text-sm font-bold text-white shadow-md transition-opacity hover:opacity-90 whitespace-nowrap"
              >
                <Instagram className="h-4 w-4" aria-hidden="true" />
                Instagram {INSTAGRAM_HANDLE}
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

          <div className="mx-auto mt-8 flex w-full max-w-[1100px] items-center justify-between border-t border-white/10 px-5 pt-5 text-xs text-white/60 sm:px-6 lg:px-8">
            <p>© {new Date().getFullYear()} Delícia da Esther — Bolos e Doces</p>
            <button
              type="button"
              onClick={() => {
                if (adminUser) {
                  window.location.href = '/';
                } else {
                  setIsAdminModalOpen(true);
                }
              }}
              className="text-xs font-medium text-white/65 underline-offset-4 transition-colors hover:text-[#F9A8D4] hover:underline"
            >
              {adminUser
                ? userRole === 'atendente'
                  ? 'Painel de Pedidos'
                  : 'Painel Administrativo'
                : 'Admin'}
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
          className="fixed bottom-20 left-3 right-3 z-40 flex items-center justify-between gap-3 rounded-xl border border-[#D81B60]/25 bg-[#3A140A] px-4 py-3 text-sm text-white shadow-xl sm:left-auto sm:right-5 sm:bottom-5"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <Check className="h-4 w-4 shrink-0 text-[#86EFAC]" aria-hidden="true" />
            <span className="truncate">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setToastMessage(null);
              setIsCartOpen(true);
            }}
            className="ml-1 shrink-0 font-semibold text-[#F9A8D4] underline underline-offset-2 hover:text-white whitespace-nowrap"
          >
            Ver carrinho
          </button>
        </div>
      )}

      {/* Sticky Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Atalhos rápidos no celular"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#D81B60]/20 bg-white/95 px-2 py-1.5 shadow-[0_-4px_18px_rgba(58,21,11,0.1)] backdrop-blur-md lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          <a
            href="#produtos"
            onClick={() => {
              setActiveNav('produtos');
              setSelectedCategory('Todos');
            }}
            className="flex flex-col items-center justify-center rounded-lg py-1 text-[11px] font-bold text-[#3A150B] transition-colors hover:bg-[#FCEEF2] hover:text-[#D81B60]"
          >
            <Cake className="h-4 w-4 text-[#D81B60]" aria-hidden="true" />
            <span className="mt-0.5">Produtos</span>
          </a>
          <a
            href="#agenda"
            onClick={() => setActiveNav('agenda')}
            className="flex flex-col items-center justify-center rounded-lg py-1 text-[11px] font-bold text-[#3A150B] transition-colors hover:bg-[#FCEEF2] hover:text-[#D81B60]"
          >
            <MapPin className="h-4 w-4 text-[#D81B60]" aria-hidden="true" />
            <span className="mt-0.5">Agenda</span>
          </a>
          <a
            href="#combos"
            onClick={() => setActiveNav('combos')}
            className="flex flex-col items-center justify-center rounded-lg py-1 text-[11px] font-bold text-[#3A150B] transition-colors hover:bg-[#FCEEF2] hover:text-[#D81B60]"
          >
            <PartyPopper className="h-4 w-4 text-[#D81B60]" aria-hidden="true" />
            <span className="mt-0.5">Combos</span>
          </a>
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="relative flex flex-col items-center justify-center rounded-lg bg-[#FCEEF2] py-1 text-[11px] font-bold text-[#D81B60]"
          >
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            <span className="mt-0.5">Carrinho</span>
            {totalItems > 0 && (
              <span className="absolute right-2.5 top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#D81B60] px-1 text-[10px] font-extrabold tabular-nums text-white">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </nav>

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
