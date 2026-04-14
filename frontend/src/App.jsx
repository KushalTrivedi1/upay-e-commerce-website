import { useState, useEffect, useMemo, useRef } from 'react'
import { Routes, Route, Link, useNavigate, useParams, useLocation } from 'react-router-dom'

// --- 1. DATA & ASSETS ---
const PRODUCTS_BACKUP = [
  { id: 1, name: 'Eco Jute Tote Bag', price: 450, category: 'Bags', subCategory: 'Natural Fiber', img: 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=800', maker: 'Meera', center: 'Nagpur', inStock: true, vendor: 'admin@upay.com', deliveryDays: '3-5 working days' },
  { id: 3, name: 'Bamboo Clutch', price: 580, category: 'Bags', subCategory: 'Hand-Woven', img: 'https://images.unsplash.com/photo-1614165586616-0ed9e17b62dc?q=80&w=800', maker: 'Rajni', center: 'Delhi', inStock: true, vendor: 'admin@upay.com', deliveryDays: '5-7 working days' },
  { id: 4, name: 'Reusable Hand-Painted Mask', price: 280, category: 'Masks', subCategory: 'Eco-Friendly', img: 'https://images.unsplash.com/photo-1584916201218-f4242ceb4809?q=80&w=800', maker: 'Rural Skill Group', center: 'Rural', inStock: true, vendor: 'vendor@upay.com', deliveryDays: '2-4 working days' },
  { id: 5, name: 'Hand-Knitted Wool Scarf', price: 720, category: 'Accessories', subCategory: 'Winter Special', img: 'https://images.unsplash.com/photo-1606830733611-ce5d2217181c?q=80&w=800', maker: 'Winter Craft Team', center: 'Winter Team', inStock: true, vendor: 'vendor2@upay.com', deliveryDays: '5-7 working days' },
  { id: 6, name: 'Organic Cotton Face Mask Set (3 pcs)', price: 350, category: 'Masks', subCategory: 'Health & Eco', img: 'https://images.unsplash.com/photo-1585032767093-4a11db918c5e?q=80&w=800', maker: 'Creative Youth', center: 'Youth', inStock: true, vendor: 'admin@upay.com', deliveryDays: '3-5 working days' }
];

const LOGO_URL = "/upay-logo.png";

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

// --- 2. MAIN APP COMPONENT ---
export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [extraDonation, setExtraDonation] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('upay_categories');
    return saved ? JSON.parse(saved) : ['Bags', 'Accessories', 'Masks'];
  });

  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Scroll to top on every route change
  useEffect(() => { window.scrollTo(0, 0) }, [pathname]);

  // Close search suggestions when clicking outside
  const searchRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Persist categories to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('upay_categories', JSON.stringify(categories));
  }, [categories]);

  const fetchProducts = () => {
    fetch('https://upay-e-commerce-website.onrender.com/api/products')
      .then(res => res.json())
      .then(data => {
        const enrichedData = data.map(item => {
          const lowerName = item.name.toLowerCase();
          let correctCategory = item.category;
          if (!correctCategory) {
            if (lowerName.includes('mask')) correctCategory = 'Masks';
            else if (lowerName.includes('bag') || lowerName.includes('clutch')) correctCategory = 'Bags';
            else correctCategory = 'Accessories';
          }

          const backup = PRODUCTS_BACKUP.find(b => b.id === item.id) || {};
          return {
            ...item,
            category: correctCategory,
            img: item.img || backup.img || 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=800',
            inStock: item.inStock !== false,
            vendor: item.vendor || backup.vendor || 'admin@upay.com',
            deliveryDays: item.deliveryDays || backup.deliveryDays || '3-5 working days'
          };
        });

        const finalProducts = enrichedData.filter(p => !p.name.toLowerCase().includes('pouch'));
        setProducts(finalProducts);

        // Auto-add any new categories found in the database
        const dbCategories = [...new Set(finalProducts.map(p => p.category))].filter(Boolean);
        const combinedCategories = [...new Set([...categories, ...dbCategories])];
        if (combinedCategories.length > categories.length) {
          setCategories(combinedCategories);
        }

        setLoading(false);
      })
      .catch(err => {
        console.error("API Error, using backup:", err);
        setProducts(PRODUCTS_BACKUP);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p =>
      (activeCategory === 'All' || p.category === activeCategory) &&
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm, activeCategory]);

  const suggestions = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return products
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .slice(0, 5);
  }, [products, searchTerm]);

  const addToCart = (p) => {
    if (p.inStock === false) return;
    const existing = cart.find(i => i.id === p.id);
    existing
      ? setCart(cart.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i))
      : setCart([...cart, { ...p, quantity: 1 }]);
  };

  const updateCartItemQuantity = (id, delta) => {
    setCart(prevCart =>
      prevCart
        .map(item => {
          if (item.id === id) {
            const newQuantity = item.quantity + delta;
            return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col">

      {/* NAVBAR */}
      <nav className="sticky top-0 w-full bg-white/95 backdrop-blur-md z-50 py-3 px-6 border-b border-slate-200 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-6">
          <Link to="/" className="flex items-center gap-4 group">
            <img src={LOGO_URL} alt="UPAY" className="h-10 w-auto bg-white rounded-lg p-1 object-contain transition-transform group-hover:scale-105" />
            <span className="text-2xl font-serif font-bold tracking-widest hidden lg:block uppercase text-[#1B3B5A]">UPAY</span>
          </Link>

          {/* SEARCH WITH DROPDOWN */}
          <div className="hidden md:flex flex-1 max-w-sm flex-col relative" ref={searchRef}>
            <div className="flex bg-slate-100 rounded-full px-4 items-center border border-slate-200 focus-within:border-[#F47920] focus-within:ring-2 focus-within:ring-[#F47920]/20 transition-all duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Explore collection..."
                value={searchTerm}
                className="bg-transparent border-none text-sm w-full py-2 focus:ring-0 placeholder-slate-400 text-slate-800 outline-none"
                onFocus={() => setShowSuggestions(true)}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setActiveCategory('All');
                  setShowSuggestions(true);
                  if (pathname !== '/') navigate('/');
                }}
              />
              {searchTerm && (
                <button onClick={() => { setSearchTerm(''); setShowSuggestions(false); }} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
              )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-12 left-0 right-0 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                {suggestions.map(p => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-none transition-colors"
                    onClick={() => {
                      setSearchTerm(p.name);
                      setShowSuggestions(false);
                      navigate('/');
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="text-sm font-bold text-slate-700">{p.name}</span>
                    <span className="text-[10px] text-[#00AEEF] ml-1">{p.category}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-6 uppercase tracking-widest text-[11px] font-bold text-slate-600">
            <Link to="/" className="hover:text-[#F47920] transition-colors">Home</Link>
            <Link to="/faq" className="hover:text-[#F47920] transition-colors">FAQ</Link>
            <Link to="/contact" className="hover:text-[#F47920] transition-colors">Contact Us</Link>
            {user
              ? <Link to="/dashboard" className="text-[#1B3B5A] hover:text-[#F47920] transition-colors">
                  {user.role === 'admin' ? 'Admin' : user.role === 'vendor' ? 'Vendor' : 'Profile'}
                </Link>
              : <Link to="/login" className="hover:text-[#F47920] transition-colors">Login</Link>
            }
            <Link to="/cart" className="bg-[#F47920] text-white px-4 py-2 rounded-full shadow-md hover:bg-[#D96516] hover:shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center gap-2">
              Cart <span className="bg-white/20 px-2 py-0.5 rounded-full">{cart.reduce((s, i) => s + i.quantity, 0)}</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* PAGE CONTENT */}
      <div className="flex-grow flex flex-col">
        <Routes>
          <Route path="/" element={<Home products={filteredProducts} categories={categories} setActiveCategory={setActiveCategory} activeCategory={activeCategory} loading={loading} addToCart={addToCart} cart={cart} updateQuantity={updateCartItemQuantity} />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/product/:id" element={<ProductDetail addToCart={addToCart} allProducts={products} cart={cart} updateQuantity={updateCartItemQuantity} />} />
          <Route path="/cart" element={<CartPage cart={cart} setCart={setCart} user={user} donation={extraDonation} setDonation={setExtraDonation} updateQuantity={updateCartItemQuantity} />} />
          <Route path="/login" element={<LoginPage setUser={setUser} />} />
          <Route path="/dashboard" element={<Dashboard user={user} setUser={setUser} products={products} setProducts={setProducts} refreshProducts={fetchProducts} categories={categories} setCategories={setCategories} />} />
          <Route path="/contact" element={<ContactPage products={products} />} />
          <Route path="/orders" element={
            user && user.role === 'customer'
              ? <OrderTrackingPage user={user} />
              : <CustomerOnlyGuard user={user} />
          } />
        </Routes>
      </div>

      {/* FOOTER — only shown on home page */}
      {pathname === '/' && (
        <footer className="bg-[#1B3B5A] text-slate-300 py-10 mt-12 border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-6">

            <div className="grid md:grid-cols-2 gap-8 mb-8 pb-8 border-b border-white/10">
              <div>
                <h2 className="text-white text-3xl font-serif italic mb-4">About UPAY</h2>
                <p className="text-sm leading-relaxed mb-3 text-slate-300">
                  Underprivileged Advancement by Youth (UPAY) is a non-profit organization established in 2010.
                  We aim to provide quality education and skill development to children and women living in
                  marginalized communities across India.
                </p>
                <p className="text-sm leading-relaxed text-slate-300">
                  Our "Reach & Teach" program brings classrooms to the streets, ensuring that no child
                  is left behind due to their socio-economic status. By purchasing from this boutique,
                  you directly fund these educational centers and provide fair wages to our rural artisans.
                </p>
              </div>
              <div className="bg-white/5 p-6 rounded-2xl border border-white/10 h-fit backdrop-blur-sm">
                <h3 className="text-[#00AEEF] text-xs font-bold uppercase tracking-[0.3em] mb-4">Mission & Vision</h3>
                <ul className="space-y-3 text-sm text-slate-200">
                  <li className="flex gap-3 items-start"><span className="text-[#F47920] leading-none">●</span> Eliminating illiteracy in street children.</li>
                  <li className="flex gap-3 items-start"><span className="text-[#F47920] leading-none">●</span> Empowering women through vocational training.</li>
                  <li className="flex gap-3 items-start"><span className="text-[#F47920] leading-none">●</span> Creating sustainable livelihoods in rural clusters.</li>
                </ul>
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-6 border-b border-white/10 pb-8">
              <div className="md:col-span-2">
                <div className="bg-white inline-block p-1.5 rounded-lg mb-4">
                  <img src={LOGO_URL} alt="UPAY" className="h-10 w-auto object-contain" />
                </div>
                <p className="text-sm italic text-slate-400 mb-5 max-w-sm">Crafting dignity, one stitch at a time.</p>
                <div className="flex gap-2">
                  <a href="https://instagram.com" target="_blank" rel="noreferrer" className="text-[9px] uppercase font-bold tracking-widest text-white border border-white/20 px-4 py-2 rounded-full hover:bg-[#F47920] hover:border-[#F47920] transition-all">Instagram</a>
                  <a href="https://facebook.com" target="_blank" rel="noreferrer" className="text-[9px] uppercase font-bold tracking-widest text-white border border-white/20 px-4 py-2 rounded-full hover:bg-[#F47920] hover:border-[#F47920] transition-all">Facebook</a>
                  <a href="https://twitter.com" target="_blank" rel="noreferrer" className="text-[9px] uppercase font-bold tracking-widest text-white border border-white/20 px-4 py-2 rounded-full hover:bg-[#F47920] hover:border-[#F47920] transition-all">Twitter</a>
                </div>
              </div>
              <div>
                <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs">Navigation</h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li><Link to="/faq" className="hover:text-white transition">FAQ</Link></li>
                  <li><Link to="/contact" className="hover:text-white transition">Contact Us</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-bold mb-4 uppercase tracking-widest text-xs">Support</h4>
                <ul className="space-y-2 text-sm font-bold text-slate-300">
                  <li><a href="https://upay.org.in/donate" target="_blank" rel="noreferrer" className="text-[#00AEEF] hover:text-white transition-colors flex items-center gap-2">Donate Directly <span className="text-lg">→</span></a></li>
                </ul>
              </div>
            </div>

            <div className="text-center pt-6 opacity-50 text-[10px] tracking-[0.4em] uppercase text-white">© {new Date().getFullYear()} UPAY NGO | NGO Registered: 2010</div>
          </div>
        </footer>
      )}
    </div>
  );
}

// --- 3. PAGE COMPONENTS ---

function Home({ products, categories, setActiveCategory, activeCategory, loading, addToCart, cart, updateQuantity }) {
  if (loading) return (
    <div className="flex-grow flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-[#F47920] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-lg font-serif italic text-slate-500">Loading masterpieces...</p>
      </div>
    </div>
  );

  return (
    <div className="flex-grow w-full max-w-7xl mx-auto px-6 pb-12 pt-6">

      {/* HERO BANNER — full-height immersive */}
      <header className="relative overflow-hidden rounded-[2rem] mb-10 shadow-2xl bg-[#0D2235] flex items-center justify-center min-h-[300px]">
        {/* Background image */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=2000')] bg-cover bg-center opacity-25"></div>
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0D2235]/98 via-[#1B3B5A]/90 to-[#F47920]/20"></div>
        {/* Subtle dot pattern */}
        <div className="absolute inset-0 opacity-[0.05]" style={{backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px'}}></div>
        {/* Decorative lines */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#F47920]/60 to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00AEEF]/40 to-transparent"></div>
        {/* Glow accents */}
        <div className="absolute -top-16 -right-16 w-72 h-72 bg-[#F47920]/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-[#00AEEF]/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#F47920]/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 w-full max-w-5xl mx-auto px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left: text */}
          <div className="text-center md:text-left max-w-lg">
            <span className="inline-flex items-center gap-2 bg-[#F47920]/20 border border-[#F47920]/40 text-[#F47920] font-bold tracking-[0.3em] uppercase text-[10px] mb-5 px-5 py-2 rounded-full shadow-sm">
              ✦ Handcrafted with Purpose ✦
            </span>
            <h1 className="text-5xl md:text-6xl font-serif italic text-white leading-none mb-3 tracking-tight"
              style={{textShadow: '0 4px 30px rgba(244,121,32,0.4)'}}>
              UPAY
            </h1>
            <p className="text-base md:text-lg font-serif text-slate-300 max-w-sm leading-relaxed mb-6">
              Empowering underprivileged children & rural artisans — one stitch at a time.
            </p>
            <div className="flex gap-3 justify-center md:justify-start">
              <button
                onClick={() => window.scrollTo({ top: 480, behavior: 'smooth' })}
                className="bg-[#F47920] text-white px-8 py-3 rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-white hover:text-[#F47920] transition-all duration-300 shadow-[0_0_20px_rgba(244,121,32,0.5)] hover:shadow-[0_0_30px_rgba(244,121,32,0.4)]"
              >
                Shop Now
              </button>
              <a href="https://upay.org.in/donate" target="_blank" rel="noreferrer"
                className="border border-white/40 text-white px-8 py-3 rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 hover:border-white/60 transition-all duration-300">
                Donate →
              </a>
            </div>
          </div>

          {/* Right: stats */}
          <div className="flex flex-col items-center md:items-end gap-5">
            <div className="grid grid-cols-3 gap-3">
              {[['500+', 'Artisans', '🧵'], ['10K+', 'Impacted', '❤️'], ['2010', 'Est.', '🏛️']].map(([n, l, icon]) => (
                <div key={l} className="bg-white/8 border border-white/15 rounded-2xl px-4 py-4 text-center backdrop-blur-sm hover:bg-white/12 transition-all duration-300 min-w-[90px]">
                  <p className="text-xl md:text-2xl font-serif font-bold text-[#F47920] mb-0.5">{n}</p>
                  <p className="text-[8px] uppercase tracking-widest text-slate-400 font-bold">{l}</p>
                </div>
              ))}
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-center backdrop-blur-sm max-w-[280px]">
              <p className="text-[10px] uppercase tracking-widest font-bold text-[#00AEEF] mb-1">Our Promise</p>
              <p className="text-xs text-slate-300 leading-relaxed italic font-serif">"Every purchase funds a classroom, feeds a dream."</p>
            </div>
          </div>
        </div>
      </header>

      {/* CATEGORY FILTERS */}
      <div className="mb-10">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 mb-4">Browse by Category</p>
        <div className="flex gap-3 overflow-x-auto no-scrollbar py-2 justify-center flex-wrap">
          {['All', ...categories].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${
                activeCategory === cat
                  ? 'bg-gradient-to-r from-[#1B3B5A] to-[#2a5580] text-white shadow-lg shadow-[#1B3B5A]/20 transform -translate-y-0.5 ring-2 ring-[#1B3B5A]/20'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-[#F47920] hover:text-[#F47920] hover:shadow-md'
              }`}
            >
              {activeCategory === cat && <span className="mr-1.5">✦</span>}
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* PRODUCT GRID */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
        {products.map(p => {
          const cartItem = cart?.find(i => i.id === p.id);
          const isOutOfStock = p.inStock === false;

          return (
            <div key={p.id} className={`group bg-white rounded-[2rem] overflow-hidden shadow-md border border-slate-100 flex flex-col relative transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 hover:border-[#F47920]/30 ${isOutOfStock ? 'opacity-70 hover:translate-y-0 hover:shadow-sm' : ''}`}>

              {/* Image Container — object-contain prevents cropping */}
              <Link to={`/product/${p.id}`} className="w-full overflow-hidden h-52 bg-gradient-to-b from-slate-50 to-gray-100 relative block flex-shrink-0 flex items-center justify-center">
                <img
                  src={p.img}
                  alt={p.name}
                  className={`w-full h-full object-contain p-2 transition-transform duration-700 ease-out ${isOutOfStock ? 'grayscale opacity-60' : 'group-hover:scale-105'}`}
                />
                {/* gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />

                {/* Top badges */}
                <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
                  {p.subCategory && (
                    <span className="bg-white/90 backdrop-blur-sm text-[#1B3B5A] text-[8px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm border border-white/50">
                      {p.subCategory}
                    </span>
                  )}
                  {!p.subCategory && <span></span>}
                  {!isOutOfStock && (
                    <span className="bg-emerald-500/90 backdrop-blur-sm text-white text-[8px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm">
                      ● In Stock
                    </span>
                  )}
                </div>

                {isOutOfStock && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/20 backdrop-blur-[2px]">
                    <span className="bg-[#E31E24] text-white px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-xl">
                      Out of Stock
                    </span>
                  </div>
                )}
              </Link>

              {/* Card Body */}
              <div className="flex-grow flex flex-col p-4">
                <div className="mb-3 flex-grow">
                  <h3 className="text-sm font-bold text-[#1B3B5A] leading-snug line-clamp-2 group-hover:text-[#F47920] transition-colors duration-300 mb-1" title={p.name}>{p.name}</h3>
                  <p className="text-[9px] text-slate-400 font-medium">by <span className="text-[#00AEEF] font-bold">{p.vendor}</span></p>
                </div>

                <div className="mt-auto">
                  {/* Price row */}
                  <div className="flex items-center justify-between mb-3 pt-3 border-t border-slate-100">
                    <p className={`font-bold text-xl font-serif ${isOutOfStock ? 'text-slate-400 line-through' : 'text-[#F47920]'}`}>₹{p.price}</p>
                    {p.deliveryDays && !isOutOfStock && (
                      <span className="text-[8px] text-slate-400 font-medium bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">🚚 {p.deliveryDays}</span>
                    )}
                  </div>

                  {cartItem ? (
                    <div className="flex items-center justify-between bg-slate-50 rounded-full px-3 py-1 border border-slate-200 shadow-inner">
                      <button onClick={(e) => { e.preventDefault(); updateQuantity(p.id, -1); }} className="text-xl text-slate-600 hover:text-[#E31E24] w-8 h-8 flex items-center justify-center leading-none transition-colors rounded-full hover:bg-red-50">-</button>
                      <span className="font-serif text-sm w-4 text-center text-[#1B3B5A] font-bold">{cartItem.quantity}</span>
                      <button onClick={(e) => { e.preventDefault(); updateQuantity(p.id, 1); }} className="text-xl text-slate-600 hover:text-[#F47920] w-8 h-8 flex items-center justify-center leading-none transition-colors rounded-full hover:bg-orange-50">+</button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.preventDefault(); if (!isOutOfStock) addToCart(p); }}
                      disabled={isOutOfStock}
                      className={`w-full py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${isOutOfStock ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-[#1B3B5A] to-[#2a5580] text-white hover:from-[#F47920] hover:to-[#D96516] hover:shadow-lg hover:shadow-orange-200/50 hover:scale-105'}`}
                      aria-label="Add to cart"
                    >
                      {isOutOfStock ? 'Sold Out' : '+ Add to Cart'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContactPage({ products }) {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', vendorEmail: 'admin@upay.com' });
  const [submitted, setSubmitted] = useState(false);

  const uniqueVendors = [...new Set(products?.map(p => p.vendor).filter(Boolean))] || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch('https://upay-e-commerce-website.onrender.com/api/queries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    if (res.ok) setSubmitted(true);
  };

  return (
    <div className="flex-grow flex items-center justify-center w-full max-w-6xl mx-auto px-6 py-4 md:py-6">
      <div className="grid lg:grid-cols-2 gap-10 items-center w-full">
        <div className="pr-lg-8">
          <span className="text-[#F47920] font-bold tracking-widest uppercase text-xs mb-2 block">Support & Inquiries</span>
          <h1 className="text-4xl md:text-6xl font-serif italic mb-4 text-[#1B3B5A]">Get in Touch</h1>
          <p className="text-sm md:text-base text-slate-500 mb-8 font-serif leading-relaxed">Have questions about an order or our impact programs? Select the specific vendor or reach out to our admin team directly.</p>

          <div className="space-y-5">
            <div className="flex gap-4 items-center group">
              <div className="w-12 h-12 shrink-0 bg-slate-100 rounded-full flex items-center justify-center text-[#F47920] text-lg group-hover:bg-[#F47920] group-hover:text-white transition-colors">✉</div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-0.5">Email Us</p>
                <p className="text-base font-serif text-[#1B3B5A]">info@upay.org.in</p>
              </div>
            </div>

            <div className="flex gap-4 items-center group">
              <div className="w-12 h-12 shrink-0 bg-slate-100 rounded-full flex items-center justify-center text-[#F47920] text-lg group-hover:bg-[#F47920] group-hover:text-white transition-colors">📞</div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-0.5">Phone</p>
                <p className="text-base font-serif text-[#1B3B5A]">+91-93706-07484</p>
              </div>
            </div>

            <div className="flex gap-4 items-start group">
              <div className="w-12 h-12 shrink-0 bg-slate-100 rounded-full flex items-center justify-center text-[#F47920] text-lg group-hover:bg-[#F47920] group-hover:text-white transition-colors mt-0.5">📍</div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-0.5">Main Office</p>
                <p className="text-sm font-serif leading-relaxed text-[#1B3B5A]">
                  201, Gandhinagar, near Shivaji Skating Ground,<br />
                  Ambajhari Road, Nagpur – 440012,<br />
                  Maharashtra, India
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-xl border border-slate-100 w-full relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-[100px] -z-10"></div>
          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <select
                value={form.vendorEmail}
                onChange={e => setForm({ ...form, vendorEmail: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/50 cursor-pointer"
              >
                <option value="admin@upay.com">General Inquiry (Admin)</option>
                {uniqueVendors.filter(v => v !== 'admin@upay.com').map(v => (
                  <option key={v} value={v}>Specific Vendor: {v}</option>
                ))}
              </select>

              <div className="grid md:grid-cols-2 gap-4">
                <input type="text" placeholder="Full Name" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/50" required onChange={e => setForm({ ...form, name: e.target.value })} />
                <input type="email" placeholder="Email Address" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/50" required onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <input type="text" placeholder="Subject" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/50" required onChange={e => setForm({ ...form, subject: e.target.value })} />
              <textarea placeholder="Your Message" rows="4" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/50 resize-none" required onChange={e => setForm({ ...form, message: e.target.value })}></textarea>
              <button className="w-full bg-[#1B3B5A] text-white py-3 rounded-full font-serif italic text-lg hover:bg-[#F47920] hover:shadow-lg transition-all transform hover:-translate-y-1 mt-2">Send Message</button>
            </form>
          ) : (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-[#00AEEF] rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl shadow-md ring-4 ring-sky-50">✓</div>
              <h3 className="text-2xl font-serif italic mb-2 text-[#1B3B5A]">Message Sent!</h3>
              <p className="text-slate-500 text-sm">We'll get back to you within 24-48 hours.</p>
              <button onClick={() => setSubmitted(false)} className="mt-5 text-[#F47920] font-bold uppercase tracking-widest text-[10px] border border-[#F47920] px-4 py-1.5 rounded-full hover:bg-[#F47920] hover:text-white transition-colors">Send another message</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductDetail({ addToCart, allProducts, cart, updateQuantity }) {
  const { id } = useParams();
  const p = allProducts.find(item => item.id === parseInt(id)) || PRODUCTS_BACKUP.find(item => item.id === parseInt(id));

  if (!p) return <div className="flex-grow flex items-center justify-center text-slate-500 font-serif text-2xl">Product not found.</div>;

  const cartItem = cart?.find(i => i.id === p.id);
  const isOutOfStock = p.inStock === false;

  return (
    <div className="flex-grow w-full max-w-6xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-6">
        <Link to="/" className="hover:text-[#F47920] transition-colors">Home</Link>
        <span className="text-slate-300">›</span>
        <span className="text-slate-400">{p.category}</span>
        <span className="text-slate-300">›</span>
        <span className="text-[#1B3B5A]">{p.name}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-10 items-start w-full">

        {/* LEFT — Image Panel */}
        <div className="relative">
          {/* Main image */}
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 shadow-xl">
            <img
              src={p.img} alt={p.name}
              className={`w-full h-[340px] object-contain p-4 transition-transform duration-700 hover:scale-105 ${isOutOfStock ? 'grayscale opacity-60' : ''}`}
            />
            {/* Overlay badges */}
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              {p.subCategory && (
                <span className="bg-white/90 backdrop-blur-sm text-[#1B3B5A] text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md border border-white">
                  {p.subCategory}
                </span>
              )}
              {!isOutOfStock && (
                <span className="bg-emerald-500/90 backdrop-blur-sm text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md">
                  ● In Stock
                </span>
              )}
            </div>
            {isOutOfStock && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/20 backdrop-blur-[3px] rounded-[2rem]">
                <span className="bg-[#E31E24] text-white px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-xl">
                  Out of Stock
                </span>
              </div>
            )}
          </div>

          {/* Impact note */}
          <div className="mt-4 bg-gradient-to-r from-[#1B3B5A]/5 to-[#00AEEF]/5 border border-[#1B3B5A]/10 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-[#F47920]/10 rounded-xl flex items-center justify-center text-lg shrink-0">🌟</div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Every purchase directly supports <span className="font-bold text-[#1B3B5A]">rural artisans</span> and funds education for underprivileged children.
            </p>
          </div>
        </div>

        {/* RIGHT — Product Info */}
        <div className="flex flex-col gap-6">

          {/* Category + Title */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[#F47920] font-bold tracking-widest uppercase text-[10px] bg-[#F47920]/10 px-3 py-1 rounded-full">{p.category}</span>
              {p.subCategory && <span className="text-slate-400 font-bold tracking-widest uppercase text-[10px]">• {p.subCategory}</span>}
            </div>
            <h1 className="text-4xl md:text-5xl font-serif leading-tight text-[#1B3B5A] mb-3">{p.name}</h1>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#00AEEF]/10 rounded-full flex items-center justify-center text-[10px]">🏪</div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Vendor: <span className="text-[#00AEEF] lowercase normal-case">{p.vendor}</span></p>
            </div>
          </div>

          {/* Description */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">About this product</p>
            <p className="text-sm text-slate-600 leading-relaxed">
              {p.description || "Handcrafted with care and purpose by our skilled rural artisans. Each piece tells a unique story and contributes directly to sustainable livelihoods."}
            </p>
          </div>

          {/* Price & Delivery */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[9px] uppercase font-bold tracking-widest text-slate-400 mb-1">Price</p>
                <p className={`text-4xl font-serif font-bold ${isOutOfStock ? 'text-slate-300 line-through' : 'text-[#F47920]'}`}>₹{p.price}</p>
              </div>
              {isOutOfStock && (
                <span className="bg-red-50 text-[#E31E24] px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest border border-red-100">Unavailable</span>
              )}
            </div>
            {p.deliveryDays && (
              <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                <span className="text-lg">🚚</span>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Expected Delivery</p>
                  <p className="text-sm font-bold text-[#00AEEF]">{p.deliveryDays}</p>
                </div>
              </div>
            )}
          </div>

          {/* Perks */}
          <div className="grid grid-cols-3 gap-3">
            {[['🔒', 'Secure', 'Payment'], ['↩️', 'Easy', 'Returns'], ['🤝', 'Fair', 'Trade']].map(([icon, t1, t2]) => (
              <div key={t1} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                <p className="text-xl mb-1">{icon}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#1B3B5A]">{t1}</p>
                <p className="text-[9px] text-slate-400">{t2}</p>
              </div>
            ))}
          </div>

          {/* Add to Cart */}
          <div>
            {isOutOfStock ? (
              <button disabled className="w-full bg-slate-100 text-slate-400 py-4 rounded-2xl font-bold uppercase tracking-widest cursor-not-allowed text-sm shadow-inner">
                Sold Out
              </button>
            ) : cartItem ? (
              <div className="flex items-center justify-between bg-slate-50 rounded-2xl px-5 py-3 shadow-inner border border-slate-200">
                <button onClick={(e) => { e.preventDefault(); updateQuantity(p.id, -1); }} className="text-2xl text-slate-600 hover:text-[#E31E24] w-12 h-12 flex items-center justify-center rounded-xl hover:bg-red-50 transition-colors font-bold">−</button>
                <span className="font-serif text-2xl text-[#1B3B5A] font-bold">{cartItem.quantity}</span>
                <button onClick={(e) => { e.preventDefault(); updateQuantity(p.id, 1); }} className="text-2xl text-slate-600 hover:text-[#F47920] w-12 h-12 flex items-center justify-center rounded-xl hover:bg-orange-50 transition-colors font-bold">+</button>
              </div>
            ) : (
              <button
                onClick={() => addToCart(p)}
                className="w-full bg-gradient-to-r from-[#F47920] to-[#D96516] text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-sm shadow-lg hover:from-[#1B3B5A] hover:to-[#0D2235] hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300"
              >
                Add to Basket
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CartPage({ cart, setCart, donation, setDonation, updateQuantity, user }) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const navigate = useNavigate();

  const subtotal = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
  const FREE_SHIPPING_THRESHOLD = 499;
  // ₹50 delivery only when cart is non-empty AND subtotal is below ₹499
  const deliveryCharge = cart.length > 0 && subtotal < FREE_SHIPPING_THRESHOLD ? 50 : 0;
  const total = subtotal + donation + deliveryCharge;
  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const shippingProgress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  // Groups cart items by vendor and submits one order per vendor
  const processOrderAfterPayment = async (method) => {
    setShowPaymentModal(false);
    const vendorOrders = {};

    cart.forEach(item => {
      const vEmail = item.vendor || 'admin@upay.com';
      if (!vendorOrders[vEmail]) {
        vendorOrders[vEmail] = { items: [], subtotal: 0 };
      }
      vendorOrders[vEmail].items.push(`${item.quantity}x ${item.name}`);
      vendorOrders[vEmail].subtotal += (item.price * item.quantity);
    });

    try {
      const orderPromises = Object.keys(vendorOrders).map((vendor, index) => {
        const orderDonation = index === 0 ? donation : 0;
        let itemsString = vendorOrders[vendor].items.join(', ');
        if (orderDonation > 0) itemsString += ` (+ ₹${orderDonation} NGO Donation)`;

        const orderData = {
          customer: user ? user.email : 'guest@upay.com',
          total: vendorOrders[vendor].subtotal + orderDonation,
          items: itemsString,
          vendors: [vendor],
          paymentMethod: method
        };

        return fetch('https://upay-e-commerce-website.onrender.com/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData)
        });
      });

      const responses = await Promise.all(orderPromises);
      const jsonResults = await Promise.all(responses.map(r => r.json()));

      if (responses.every(res => res.ok)) {
        const firstOrder = jsonResults[0];
        if (firstOrder?.order?.id) {
          setLastOrderId(firstOrder.order.id);
        }
        setShowSuccess(true);
        setCart([]);
        setDonation(0);
      } else {
        alert("Backend received the request but couldn't process it.");
      }
    } catch (err) {
      alert("Checkout failed. Cannot connect to server.");
    }
  };

  // Handles both UPI (Razorpay) and Cash on Delivery checkout flows
  const handleCheckout = async () => {
    if (cart.length === 0) return;

    if (paymentMethod === 'UPI') {
      // Step 1: Load the Razorpay SDK
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        alert("Razorpay SDK failed to load. Are you online?");
        return;
      }

      // Step 2: Ask backend to create a Razorpay Order
      const orderRes = await fetch("https://upay-e-commerce-website.onrender.com/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: total })
      });
      const orderData = await orderRes.json();

      if (!orderData.success) {
        alert("Server error. Are you sure the backend is running?");
        return;
      }

      // Step 3: Open Razorpay Checkout
      const options = {
        key: "YOUR_RAZORPAY_KEY_ID", // Replace with your real Razorpay Key ID
        amount: orderData.order.amount,
        currency: "INR",
        name: "UPAY NGO",
        description: "Order Payment",
        order_id: orderData.order.id,
        handler: async function (response) {
          // Step 4: Verify payment signature with the backend
          const verifyRes = await fetch("https://upay-e-commerce-website.onrender.com/api/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          });

          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            // Step 5: Payment verified — save order in DB
            await processOrderAfterPayment("UPI");
          } else {
            alert("Payment verification failed! Please contact support.");
          }
        },
        prefill: {
          name: user?.name || "Guest",
          email: user?.email || "guest@upay.com"
        },
        theme: { color: "#F47920" }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        alert("Payment Failed: " + response.error.description);
      });
      rzp.open();
    } else {
      // Cash on Delivery flow
      await processOrderAfterPayment("COD");
    }
  };

  return (
    <div className="flex-grow w-full max-w-6xl mx-auto px-6 py-6 md:py-10 relative">
      {/* Cart Page Header */}
      <div className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#F47920] mb-1">Your Basket</p>
        <div className="flex items-end justify-between border-b border-slate-200 pb-3">
          <h2 className="text-3xl md:text-4xl font-serif italic text-[#1B3B5A]">My Cart</h2>
          <span className="bg-[#1B3B5A] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full">
            {cart.reduce((s,i)=>s+i.quantity,0)} item{cart.reduce((s,i)=>s+i.quantity,0)!==1?'s':''}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">

          {cart.length === 0 ? (
            <div className="bg-white p-16 rounded-[2rem] text-center border border-dashed border-slate-300 shadow-sm">
              <div className="w-20 h-20 bg-gradient-to-br from-slate-100 to-slate-50 rounded-full flex items-center justify-center mx-auto mb-5 text-4xl shadow-inner">🛒</div>
              <p className="text-2xl font-serif text-slate-400 mb-2">Your basket is empty</p>
              <p className="text-sm text-slate-400 mb-8">Discover handcrafted products made with love by rural artisans.</p>
              <Link to="/" className="inline-block bg-gradient-to-r from-[#1B3B5A] to-[#2a5580] text-white px-8 py-3 rounded-full font-bold uppercase tracking-widest text-[10px] hover:from-[#F47920] hover:to-[#D96516] transition-all shadow-md">
                Explore Collection
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map(item => (
                <div key={item.id} className="flex flex-col md:flex-row gap-5 items-center bg-white p-4 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md hover:border-[#F47920]/20 transition-all duration-300 group">
                  <div className="relative flex-shrink-0">
                    <img src={item.img} alt={item.name} className="w-20 h-20 object-cover rounded-2xl bg-slate-50 shadow-sm group-hover:scale-105 transition-transform duration-300" />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <div className="font-serif text-lg text-[#1B3B5A] mb-0.5 group-hover:text-[#F47920] transition-colors">{item.name}</div>
                    <div className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">{item.category}</div>
                    <div className="text-[10px] text-slate-400 mt-1">Unit price: <span className="font-bold text-[#F47920]">₹{item.price}</span></div>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-50 rounded-full px-2 py-1.5 border border-slate-200 shadow-inner">
                    <button onClick={() => updateQuantity(item.id, -1)} className="text-lg text-slate-600 hover:text-[#E31E24] w-8 h-8 flex items-center justify-center leading-none rounded-full hover:bg-red-50 transition-colors">-</button>
                    <span className="font-serif text-lg w-6 text-center text-[#1B3B5A] font-bold">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="text-lg text-slate-600 hover:text-[#F47920] w-8 h-8 flex items-center justify-center leading-none rounded-full hover:bg-orange-50 transition-colors">+</button>
                  </div>

                  <div className="text-right min-w-[100px]">
                    <div className="text-[#F47920] font-bold text-xl font-serif">₹{item.price * item.quantity}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">{item.quantity} × ₹{item.price}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* DONATION SLIDER */}
          <div className="bg-[#1B3B5A] text-white p-6 md:p-8 rounded-[2rem] shadow-md relative overflow-hidden mt-8">
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
            <h4 className="text-xl font-serif mb-3 text-[#00AEEF]">Donate a Little Extra?</h4>
            <p className="text-slate-300 text-xs mb-5 max-w-md leading-relaxed">100% of your extra donation goes directly to funding our "Reach & Teach" street classrooms.</p>
            <input type="range" min="0" max="2000" step="50" value={donation} onChange={(e) => setDonation(parseInt(e.target.value))} className="w-full mb-5 accent-[#F47920] h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Amount</span>
              <p className="text-3xl font-serif text-white">₹{donation}</p>
            </div>
          </div>
        </div>

        {/* ORDER SUMMARY */}
        <div className="bg-white rounded-[2rem] h-fit sticky top-24 shadow-xl border border-slate-100 overflow-hidden">
          {/* Summary Header */}
          <div className="bg-gradient-to-br from-[#1B3B5A] to-[#0D2235] px-6 py-5">
            <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-[#00AEEF] mb-0.5">Your</p>
            <h3 className="text-xl font-serif text-white">Order Summary</h3>
          </div>

          <div className="p-6 md:p-8">
            {/* FREE SHIPPING PROGRESS BAR */}
            <div className="mb-5 pb-5 border-b border-slate-100">
              {remainingForFreeShipping === 0 ? (
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[9px]">✓</span>
                  <p className="text-[11px] font-bold text-emerald-600">Free delivery unlocked!</p>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 mb-2">
                  Add <span className="font-bold text-[#F47920]">₹{remainingForFreeShipping}</span> more to get <span className="font-bold text-emerald-600">FREE delivery!</span>
                </p>
              )}
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#1B3B5A] to-[#F47920] rounded-full transition-all duration-700"
                  style={{ width: `${shippingProgress}%` }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[9px] text-slate-400 font-bold">₹0</span>
                <span className="text-[9px] text-slate-400 font-bold">Free at ₹499</span>
              </div>
            </div>

            <div className="space-y-3 text-sm mb-6 text-slate-600">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-bold text-slate-800">₹{subtotal}</span>
              </div>
              {donation > 0 && (
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1.5 text-[#F47920]">
                    <span className="text-sm">🤝</span> NGO Donation
                  </span>
                  <span className="font-bold text-[#F47920]">+₹{donation}</span>
                </div>
              )}
              {cart.length > 0 && (
                <div className={`flex justify-between items-center text-xs font-bold rounded-xl px-3 py-2 ${deliveryCharge > 0 ? 'bg-orange-50 text-[#F47920] border border-orange-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                  <span className="flex items-center gap-1.5">
                    <span>🚚</span> Delivery Charge
                  </span>
                  <span>{deliveryCharge > 0 ? `+₹${deliveryCharge}` : 'FREE 🎉'}</span>
                </div>
              )}
              {deliveryCharge > 0 && (
                <p className="text-[9px] text-slate-400 text-center">Add ₹{remainingForFreeShipping} more to waive the ₹50 delivery fee</p>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-700 uppercase tracking-widest">Total Payable</span>
                <span className="text-3xl font-serif font-bold text-[#F47920]">₹{total}</span>
              </div>
            </div>

            <button
              onClick={() => setShowPaymentModal(true)}
              disabled={cart.length === 0}
              className="w-full bg-gradient-to-r from-[#F47920] to-[#D96516] text-white py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:from-[#1B3B5A] hover:to-[#2a5580] hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-none shadow-lg shadow-orange-200/50"
            >
              🛒 Proceed to Checkout
            </button>
          </div>
        </div>
      </div>

      {/* PAYMENT METHOD MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowPaymentModal(false)}></div>
          <div className="relative bg-white w-full max-w-md p-8 rounded-[2rem] shadow-2xl border border-slate-100">
            <h2 className="text-2xl font-serif mb-6 text-[#1B3B5A] text-center">Select Payment Method</h2>

            <div className="space-y-4 mb-8">
              <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'COD' ? 'border-[#F47920] bg-orange-50/50' : 'border-slate-100 hover:border-slate-200'}`}>
                <input type="radio" name="payment" value="COD" checked={paymentMethod === 'COD'} onChange={(e) => setPaymentMethod(e.target.value)} className="w-4 h-4 text-[#F47920] accent-[#F47920]" />
                <span className="font-bold text-[#1B3B5A] text-sm uppercase tracking-widest">Cash on Delivery</span>
              </label>

              <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'UPI' ? 'border-[#F47920] bg-orange-50/50' : 'border-slate-100 hover:border-slate-200'}`}>
                <input type="radio" name="payment" value="UPI" checked={paymentMethod === 'UPI'} onChange={(e) => setPaymentMethod(e.target.value)} className="w-4 h-4 text-[#F47920] accent-[#F47920]" />
                <span className="font-bold text-[#1B3B5A] text-sm uppercase tracking-widest">UPI Payment</span>
              </label>
            </div>

            <div className="flex gap-4">
              <button onClick={() => setShowPaymentModal(false)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={handleCheckout} className="flex-1 bg-[#1B3B5A] text-white py-3 rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-[#F47920] transition-colors shadow-md">Confirm Order</button>
            </div>
          </div>
        </div>
      )}

      {/* ORDER SUCCESS MODAL */}
      {showSuccess && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowSuccess(false)}></div>
          <div className="relative bg-white w-full max-w-sm p-10 rounded-[2rem] shadow-2xl text-center border border-slate-100">
            <div className="w-16 h-16 bg-[#00AEEF] rounded-full flex items-center justify-center mx-auto mb-5 text-white text-2xl shadow-md ring-4 ring-sky-50">✓</div>
            <h2 className="text-2xl font-serif italic mb-3 text-[#1B3B5A]">Order Placed!</h2>
            <p className="text-sm text-slate-500 mb-4">Thank you for supporting our artisans. Your contribution makes a real difference.</p>
            {lastOrderId && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 mb-5">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Your Order ID</p>
                <p className="text-2xl font-serif font-bold text-[#F47920]">#{lastOrderId}</p>
                <p className="text-[10px] text-slate-400 mt-1">Use this ID on the Orders page to track your delivery</p>
              </div>
            )}
            <button onClick={() => { setShowSuccess(false); navigate('/'); }} className="bg-[#1B3B5A] text-white px-8 py-3 rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-[#F47920] transition-colors">Return to Home</button>
          </div>
        </div>
      )}
    </div>
  );
}

function LoginPage({ setUser }) {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('customer'); // 'customer', 'vendor', or 'admin'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Admin can only log in, not sign up
  useEffect(() => {
    if (role === 'admin') setIsLogin(true);
  }, [role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isLogin && phone.length !== 10) {
      setError("Phone number must be exactly 10 digits.");
      return;
    }

    const endpoint = isLogin ? 'https://upay-e-commerce-website.onrender.com/api/login' : 'https://upay-e-commerce-website.onrender.com/api/register';
    const payload = isLogin
      ? { email, password, role }
      : { name, phone, email, password, role };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        let assignedRole = data.user.role || role;
        if (!data.user.role) {
          if (data.user.email === 'admin@upay.com') assignedRole = 'admin';
          else if (data.user.email.includes('vendor')) assignedRole = 'vendor';
          else assignedRole = 'customer';
        }

        // New vendor sign-ups require admin approval before they can log in
        if (!isLogin && role === 'vendor') {
          alert("Application received! Please wait for admin approval before logging in.");
          setIsLogin(true);
          return;
        }

        setUser({
          name: data.user.name,
          email: data.user.email,
          role: assignedRole,
          phone: data.user.phone,
          impactPoints: data.user.impactPoints
        });
        navigate('/dashboard');
      } else {
        setError(data.message || "An error occurred. If you already registered, please sign in.");
      }
    } catch (err) {
      setError("Cannot connect to server. Make sure your backend is running!");
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center w-full px-6 py-2">
      <div className="bg-white p-5 md:p-6 rounded-3xl shadow-xl w-full max-w-md text-center border border-slate-100">
        <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2 text-lg text-[#1B3B5A]">🔒</div>

        <h2 className="text-2xl font-serif mb-1 text-[#1B3B5A]">
          {isLogin ? 'Welcome Back' : (role === 'vendor' ? 'Apply as Vendor' : 'Join UPAY')}
        </h2>
        <p className="text-slate-500 mb-4 text-xs">
          {isLogin ? 'Sign in to access your profile' : (role === 'vendor' ? 'Register your NGO/SHG for admin review' : 'Create an account to track your orders')}
        </p>

        {/* ROLE SELECTOR */}
        <div className="flex bg-slate-100 p-1 rounded-full mb-6 mx-2">
          {['customer', 'vendor', 'admin'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => { setRole(r); setError(''); }}
              className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all ${role === r ? 'bg-white text-[#F47920] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {r}
            </button>
          ))}
        </div>

        {error && <div className="bg-red-50 text-[#E31E24] p-2 rounded-lg mb-3 font-bold text-xs border border-red-100">{error}</div>}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <input
                type="text"
                placeholder={role === 'vendor' ? "Organization / Full Name" : "Full Name"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm mb-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/50 transition-all"
                required
              />
              <input
                type="tel"
                placeholder="Phone Number (10 digits)"
                value={phone}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  if (val.length <= 10) setPhone(val);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm mb-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/50 transition-all"
                required
              />
            </>
          )}

          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm mb-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/50 transition-all"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm mb-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/50 transition-all"
            required
          />
          <button type="submit" className="w-full bg-[#1B3B5A] text-white py-2.5 rounded-full font-bold uppercase tracking-widest text-sm shadow-md hover:bg-[#F47920] hover:shadow-lg transition-all transform hover:-translate-y-1">
            {isLogin ? 'Sign In' : (role === 'vendor' ? 'Submit Application' : 'Create Account')}
          </button>
        </form>

        {/* Hide toggle link for admin (admin can only log in) */}
        {role !== 'admin' && (
          <p className="mt-4 text-slate-500 text-xs">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="text-[#F47920] font-bold underline hover:text-[#D96516]"
            >
              {isLogin ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

function Dashboard({ user, setUser, products, setProducts, refreshProducts, categories, setCategories }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('add');
  const [orderView, setOrderView] = useState('pending');   // 'pending' or 'delivered'
  const [vendorView, setVendorView] = useState('pending'); // 'pending' or 'approved'

  const [queries, setQueries] = useState([]);
  const [orders, setOrders] = useState([]);
  const [vendorList, setVendorList] = useState([]);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    category: categories[0] || 'Bags',
    subCategory: '',
    img: '',
    description: '',
    vendor: user?.email,
    deliveryDays: ''
  });
  const [msg, setMsg] = useState('');

  // Customer-specific state
  const [customerOrders, setCustomerOrders] = useState([]);
  const [customerOrdersLoading, setCustomerOrdersLoading] = useState(false);
  const [customerTab, setCustomerTab] = useState('account'); // 'account' | 'orders'

  const displayedProducts = user?.role === 'admin'
    ? products
    : products.filter(p => p.vendor === user?.email);

  // Fetch queries, orders, and vendor applications for admin/vendor roles
  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'vendor') {
      fetch('https://upay-e-commerce-website.onrender.com/api/queries')
        .then(res => res.json())
        .then(data => {
          if (user.role === 'admin') setQueries(data);
          else setQueries(data.filter(q => q.vendorEmail === user.email));
        });

      fetch('https://upay-e-commerce-website.onrender.com/api/orders')
        .then(res => res.json())
        .then(data => {
          if (user.role === 'admin') setOrders(data);
          else setOrders(data.filter(o => o.vendors && o.vendors.includes(user.email)));
        });

      if (user.role === 'admin') {
        fetch('https://upay-e-commerce-website.onrender.com/api/applications')
          .then(res => res.json())
          .then(data => setVendorList(data))
          .catch(err => console.error("Error fetching vendor applications:", err));
      }
    }
  }, [user]);

  // Fetch order history for customer role
  useEffect(() => {
    if (user?.role === 'customer') {
      setCustomerOrdersLoading(true);
      fetch('https://upay-e-commerce-website.onrender.com/api/orders')
        .then(res => res.json())
        .then(data => {
          const myOrders = data.filter(o =>
            o.customer && o.customer.toLowerCase() === user.email.toLowerCase()
          );
          setCustomerOrders(myOrders.sort((a, b) => new Date(b.date) - new Date(a.date)));
        })
        .catch(err => console.error("Failed to fetch customer orders:", err))
        .finally(() => setCustomerOrdersLoading(false));
    }
  }, [user]);

  if (!user) return null;

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewProduct({ ...newProduct, img: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...newProduct, price: Number(newProduct.price), vendor: user.email };
      const res = await fetch('https://upay-e-commerce-website.onrender.com/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setMsg('Product added successfully!');
        setNewProduct({ name: '', price: '', category: categories[0] || 'Bags', subCategory: '', img: '', description: '', vendor: user.email, deliveryDays: '' });
        document.getElementById('file-upload').value = "";
        refreshProducts();
      }
    } catch (err) { setMsg('Failed to add product.'); }
  };

  const handleDeleteProduct = async (id) => {
    if (window.confirm("Are you sure you want to permanently delete this product?")) {
      try {
        const res = await fetch(`https://upay-e-commerce-website.onrender.com/api/products/${id}`, { method: 'DELETE' });
        if (res.ok) refreshProducts();
        else alert("Failed to delete from server.");
      } catch (err) {
        alert("Failed to connect to server.");
      }
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus !== false;  // flip: false → true, true → false
    setProducts(products.map(p => p.id === id ? { ...p, inStock: !newStatus } : p));
    try {
      await fetch(`https://upay-e-commerce-website.onrender.com/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inStock: !newStatus })
      });
    } catch (err) {
      console.error("Failed to sync stock status with backend.");
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const trimmedCat = newCategoryName.trim();
    if (trimmedCat && !categories.includes(trimmedCat)) {
      try {
        await fetch('https://upay-e-commerce-website.onrender.com/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmedCat })
        });
      } catch (err) { console.error("Failed to post to backend."); }
      setCategories([...categories, trimmedCat]);
      setNewCategoryName('');
      setMsg(`Category "${trimmedCat}" added successfully!`);
    } else {
      setMsg('Category already exists or is invalid.');
    }
  };

  const handleDeleteCategory = async (catToDelete) => {
    if (window.confirm(`Are you sure you want to permanently delete the category "${catToDelete}"?`)) {
      try {
        await fetch(`https://upay-e-commerce-website.onrender.com/api/categories/${encodeURIComponent(catToDelete)}`, { method: 'DELETE' });
      } catch (err) { console.error("Failed to delete from backend."); }
      setCategories(categories.filter(c => c !== catToDelete));
      setMsg(`Category "${catToDelete}" deleted!`);
    }
  };

  const handleApproveVendor = async (vendorId) => {
    try {
      const response = await fetch(`https://upay-e-commerce-website.onrender.com/api/vendors/${vendorId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        setVendorList(vendorList.map(v => (v.id === vendorId || v._id === vendorId) ? { ...v, status: 'Approved' } : v));
        alert("Vendor Approved!");
      }
    } catch (err) { console.error(err); }
  };

  const handleRejectVendor = async (vendorId) => {
    try {
      const response = await fetch(`https://upay-e-commerce-website.onrender.com/api/applications/${vendorId}`, { method: 'DELETE' });
      if (response.ok) {
        setVendorList(vendorList.filter(v => v.id !== vendorId && v._id !== vendorId));
        alert("Application Rejected!");
      }
    } catch (err) { console.error(err); }
  };

  const handleUpdateOrderStatus = async (id, newStatus) => {
    setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
    try {
      await fetch(`https://upay-e-commerce-website.onrender.com/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (err) { console.error("Failed to update order status"); }
  };

  const handleResolveQuery = async (id) => {
    setQueries(queries.map(q => q.id === id ? { ...q, status: 'Resolved' } : q));
    try {
      await fetch(`https://upay-e-commerce-website.onrender.com/api/queries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Resolved' })
      });
    } catch (err) { console.error("Failed to resolve query"); }
  };

  const handleDeleteQuery = async (id) => {
    if (!window.confirm("Are you sure you want to permanently delete this query?")) return;
    setQueries(queries.filter(q => q.id !== id));
    try {
      await fetch(`https://upay-e-commerce-website.onrender.com/api/queries/${id}`, { method: 'DELETE' });
    } catch (err) { console.error("Failed to delete query"); }
  };

  const sortedOrders = [...orders].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="flex-grow w-full px-4 md:px-6 py-6">
      <div className={`w-full mx-auto ${user.role === 'admin' || user.role === 'vendor' ? 'max-w-7xl' : 'max-w-3xl'}`}>
        {user.role === 'admin' || user.role === 'vendor' ? (
          <div className="flex flex-col gap-6">

            {/* DASHBOARD HEADER */}
            <div className="relative bg-gradient-to-br from-[#1B3B5A] via-[#1B3B5A] to-[#0e2438] rounded-3xl px-6 md:px-10 py-8 overflow-hidden shadow-xl">
              <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-20 w-32 h-32 bg-[#F47920]/10 rounded-full blur-2xl pointer-events-none" />

              <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center text-2xl backdrop-blur-sm shadow-inner">
                    {user.role === 'admin' ? '🛡️' : '🏪'}
                  </div>
                  <div>
                    <p className="text-[#00AEEF] text-[10px] font-bold uppercase tracking-[0.3em] mb-0.5">
                      {user.role === 'admin' ? 'Administrator' : 'Vendor'} Portal
                    </p>
                    <h1 className="text-2xl md:text-3xl font-serif text-white leading-tight">
                      {user.role === 'admin' ? 'Admin Dashboard' : 'Vendor Dashboard'}
                    </h1>
                    <p className="text-slate-400 text-xs mt-0.5 font-mono">{user.email.toLowerCase()}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 items-end">
                  <div className="flex gap-3 flex-wrap">
                    <div className="bg-white/10 border border-white/15 backdrop-blur-sm rounded-2xl px-4 py-3 text-center min-w-[80px]">
                      <p className="text-white text-xl font-serif font-bold">{displayedProducts.length}</p>
                      <p className="text-slate-400 text-[9px] uppercase font-bold tracking-widest">Products</p>
                    </div>
                    <div className="bg-white/10 border border-white/15 backdrop-blur-sm rounded-2xl px-4 py-3 text-center min-w-[80px]">
                      <p className="text-[#F47920] text-xl font-serif font-bold">{sortedOrders.filter(o => o.status !== 'Delivered').length}</p>
                      <p className="text-slate-400 text-[9px] uppercase font-bold tracking-widest">Pending</p>
                    </div>
                    <div className="bg-white/10 border border-white/15 backdrop-blur-sm rounded-2xl px-4 py-3 text-center min-w-[80px]">
                      <p className="text-emerald-400 text-xl font-serif font-bold">{queries.filter(q => q.status !== 'Resolved').length}</p>
                      <p className="text-slate-400 text-[9px] uppercase font-bold tracking-widest">Queries</p>
                    </div>
                  </div>
                  <button onClick={() => { setUser(null); navigate('/') }}
                    className="text-[9px] font-bold uppercase tracking-widest text-red-300 hover:text-white border border-red-400/30 hover:border-red-400/60 hover:bg-red-500/20 px-4 py-1.5 rounded-full transition-all">
                    Logout
                  </button>
                </div>
              </div>
            </div>

            {/* SIDEBAR + CONTENT */}
            <div className="flex flex-col lg:flex-row gap-5">

              {/* Sidebar Navigation */}
              <aside className="lg:w-56 shrink-0">
                <nav className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                  <p className="text-[9px] uppercase font-bold tracking-[0.3em] text-slate-400 px-4 pt-4 pb-2">Navigation</p>
                  {[
                    { id: 'add',         icon: '➕', label: 'Add Product' },
                    { id: 'addCategory', icon: '🏷️', label: 'Categories' },
                    { id: 'inventory',   icon: '📦', label: 'Inventory' },
                    { id: 'orders',      icon: '🛒', label: 'Orders',
                      badge: sortedOrders.filter(o => o.status !== 'Delivered').length || null },
                    { id: 'queries',     icon: '💬', label: 'Queries',
                      badge: queries.filter(q => q.status !== 'Resolved').length || null },
                    ...(user.role === 'admin' ? [{ id: 'vendors', icon: '🤝', label: 'Approvals',
                      badge: vendorList.filter(v => v.status === 'Pending' || !v.status).length || null }] : [])
                  ].map(item => (
                    <button
                      key={item.id}
                      onClick={() => { setActiveTab(item.id); setMsg(''); }}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm font-bold transition-all border-l-2 ${
                        activeTab === item.id
                          ? 'bg-[#1B3B5A]/5 text-[#1B3B5A] border-[#F47920]'
                          : 'text-slate-500 border-transparent hover:bg-slate-50 hover:text-slate-700'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="text-base">{item.icon}</span>
                        <span className="tracking-wide">{item.label}</span>
                      </span>
                      {item.badge > 0 && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === item.id ? 'bg-[#F47920] text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>
              </aside>

              {/* Main Content Panel */}
              <main className="flex-1 min-w-0">

                {/* ─── MANAGE CATEGORIES ─── */}
                {activeTab === 'addCategory' && (
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
                      <div className="w-9 h-9 bg-[#1B3B5A]/5 rounded-xl flex items-center justify-center text-lg">🏷️</div>
                      <div>
                        <h2 className="text-lg font-serif text-[#1B3B5A] font-bold">Manage Categories</h2>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{categories.length} active categories</p>
                      </div>
                    </div>
                    <div className="p-6">
                      {msg && <div className="mb-4 bg-sky-50 border border-sky-200 text-[#00AEEF] text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2">✓ {msg}</div>}
                      <form onSubmit={handleAddCategory} className="flex gap-3 mb-6">
                        <input
                          type="text" placeholder="New category name (e.g. Wallets)" required
                          value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                          className="flex-grow px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/30 focus:border-[#F47920]/50 transition-all"
                        />
                        <button type="submit" className="bg-[#F47920] text-white px-6 py-2.5 rounded-xl font-bold tracking-widest uppercase text-[10px] hover:bg-[#D96516] transition-all shadow-sm whitespace-nowrap">Add</button>
                      </form>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">Current Categories</p>
                      <div className="flex flex-wrap gap-2">
                        {categories.map(c => (
                          <div key={c} className="group bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-200 pl-4 pr-2 py-1.5 rounded-full text-xs font-bold text-[#1B3B5A] group-hover:text-red-600 flex items-center gap-2 transition-all">
                            <span className="group-hover:text-red-600 transition-colors">{c}</span>
                            <button type="button" onClick={() => handleDeleteCategory(c)}
                              className="text-slate-400 hover:text-red-500 w-4 h-4 flex items-center justify-center rounded-full hover:bg-red-100 transition-colors text-base leading-none pb-0.5">×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── ADD PRODUCT ─── */}
                {activeTab === 'add' && (
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
                      <div className="w-9 h-9 bg-[#F47920]/10 rounded-xl flex items-center justify-center text-lg">➕</div>
                      <div>
                        <h2 className="text-lg font-serif text-[#1B3B5A] font-bold">Add New Product</h2>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Upload a handcrafted item to the store</p>
                      </div>
                    </div>
                    <div className="p-6">
                      {msg && <div className="mb-4 bg-sky-50 border border-sky-200 text-[#00AEEF] text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2">✓ {msg}</div>}
                      <form onSubmit={handleAddProduct} className="grid md:grid-cols-2 gap-4">
                        {[
                          { placeholder: 'Product Name', key: 'name', type: 'text', required: true },
                          { placeholder: 'Price (₹)', key: 'price', type: 'number', required: true },
                          { placeholder: 'Sub Category (e.g. Hand-Woven)', key: 'subCategory', type: 'text' },
                          { placeholder: 'Delivery Estimate (e.g. 3-5 working days)', key: 'deliveryDays', type: 'text', required: true, full: true },
                        ].map(f => f.key === 'subCategory' ? (
                          <input key={f.key} type={f.type} placeholder={f.placeholder} value={newProduct[f.key]}
                            onChange={e => setNewProduct({ ...newProduct, [f.key]: e.target.value })}
                            className="px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/30 transition-all" />
                        ) : (
                          <input key={f.key} type={f.type} placeholder={f.placeholder} required={f.required}
                            value={newProduct[f.key]} onChange={e => setNewProduct({ ...newProduct, [f.key]: e.target.value })}
                            className={`px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/30 transition-all ${f.full ? 'md:col-span-2' : ''}`} />
                        ))}

                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Category</p>
                          <select value={newProduct.category} onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                            className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/30 cursor-pointer transition-all">
                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Product Image</p>
                          <input type="file" id="file-upload" accept="image/*" onChange={handleImageUpload}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#F47920]/30 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-[#F47920]/10 file:text-[#F47920] hover:file:bg-[#F47920]/20 cursor-pointer transition-all" />
                        </div>

                        <textarea placeholder="Product description — tell the story of the artisan..." required
                          value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
                          className="md:col-span-2 px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/30 resize-none transition-all" rows="3" />

                        <button type="submit"
                          className="md:col-span-2 bg-gradient-to-r from-[#F47920] to-[#D96516] text-white py-3 rounded-xl font-bold tracking-widest uppercase text-xs shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
                          🚀 Upload to Store
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {/* ─── INVENTORY ─── */}
                {activeTab === 'inventory' && (
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center text-lg">📦</div>
                        <div>
                          <h2 className="text-lg font-serif text-[#1B3B5A] font-bold">Inventory</h2>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{displayedProducts.length} products listed</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                        <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-1 rounded-full">
                          {displayedProducts.filter(p => p.inStock !== false).length} In Stock
                        </span>
                        <span className="bg-red-50 text-red-500 border border-red-200 px-2.5 py-1 rounded-full">
                          {displayedProducts.filter(p => p.inStock === false).length} Out
                        </span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[620px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            {['Product', 'Category', 'Price', 'Vendor', 'Status', 'Actions'].map(h => (
                              <th key={h} className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {displayedProducts.length === 0 ? (
                            <tr><td colSpan="6" className="p-10 text-center text-slate-400 font-serif">No products in your inventory.</td></tr>
                          ) : displayedProducts.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <img src={p.img || 'https://via.placeholder.com/40'} alt={p.name} className="w-9 h-9 object-cover rounded-lg border border-slate-200 shadow-sm" />
                                  <span className="font-serif text-sm text-[#1B3B5A] font-medium">{p.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-500">{p.category || '—'}</td>
                              <td className="px-4 py-3 font-bold text-[#F47920] text-sm font-serif">₹{p.price}</td>
                              <td className="px-4 py-3 text-[10px] text-slate-400 lowercase">{p.vendor || 'admin@upay.com'}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${
                                  p.inStock !== false ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-500 border-red-200'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${p.inStock !== false ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                  {p.inStock !== false ? 'In Stock' : 'Sold Out'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <button onClick={() => handleToggleStatus(p.id, p.inStock)}
                                    className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border transition-all ${
                                      p.inStock !== false
                                        ? 'border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100'
                                        : 'border-sky-200 text-[#00AEEF] bg-sky-50 hover:bg-sky-100'
                                    }`}>
                                    {p.inStock !== false ? 'Mark Out' : 'Mark In'}
                                  </button>
                                  <button onClick={() => handleDeleteProduct(p.id)}
                                    className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest bg-red-500 text-white hover:bg-red-600 shadow-sm transition-all">
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ─── ORDERS ─── */}
                {activeTab === 'orders' && (
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-[#F47920]/10 rounded-xl flex items-center justify-center text-lg">🛒</div>
                        <div>
                          <h2 className="text-lg font-serif text-[#1B3B5A] font-bold">Orders</h2>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{sortedOrders.length} total orders</p>
                        </div>
                      </div>
                      <div className="flex bg-slate-100 p-1 rounded-full gap-1">
                        {[['pending', 'Pending'], ['delivered', 'Delivered']].map(([v, l]) => (
                          <button key={v} onClick={() => setOrderView(v)}
                            className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                              orderView === v ? 'bg-white text-[#1B3B5A] shadow-sm' : 'text-slate-400 hover:text-slate-600'
                            }`}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[720px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            {['Order #', 'Date', 'Customer', 'Items', 'Total', 'Payment', 'Status'].map(h => (
                              <th key={h} className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(() => {
                            const filtered = orderView === 'pending'
                              ? sortedOrders.filter(o => o.status !== 'Delivered')
                              : sortedOrders.filter(o => o.status === 'Delivered');
                            if (filtered.length === 0) return (
                              <tr><td colSpan="7" className="p-10 text-center text-slate-400 font-serif">No {orderView} orders.</td></tr>
                            );
                            return filtered.map(o => (
                              <tr key={o.id} className={`transition-colors ${orderView === 'delivered' ? 'bg-slate-50/40 opacity-80 hover:opacity-100' : 'hover:bg-slate-50/60'}`}>
                                <td className="px-4 py-3">
                                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">#{o.id}</span>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500">{o.date}</td>
                                <td className="px-4 py-3 text-xs font-medium text-[#1B3B5A] lowercase">{o.customer}</td>
                                <td className="px-4 py-3 text-[10px] text-slate-500 max-w-[160px] truncate">{o.items}</td>
                                <td className="px-4 py-3 font-bold text-[#1B3B5A] text-sm font-serif">₹{o.total}</td>
                                <td className="px-4 py-3">
                                  <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border ${
                                    o.paymentMethod === 'UPI' ? 'bg-purple-50 text-purple-600 border-purple-200' : 'bg-slate-50 text-slate-500 border-slate-200'
                                  }`}>{o.paymentMethod || 'COD'}</span>
                                </td>
                                <td className="px-4 py-3">
                                  {orderView === 'delivered' ? (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                                      ✓ Delivered
                                    </span>
                                  ) : (
                                    <select value={o.status || 'Pending'} onChange={e => handleUpdateOrderStatus(o.id, e.target.value)}
                                      className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#F47920]/40 transition-all">
                                      <option value="Pending">Pending</option>
                                      <option value="Packed">Packed</option>
                                      <option value="Shipped">Shipped</option>
                                      <option value="Delivered">Delivered</option>
                                    </select>
                                  )}
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ─── CUSTOMER QUERIES ─── */}
                {activeTab === 'queries' && (
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
                      <div className="w-9 h-9 bg-sky-50 rounded-xl flex items-center justify-center text-lg">💬</div>
                      <div>
                        <h2 className="text-lg font-serif text-[#1B3B5A] font-bold">Customer Queries</h2>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                          {queries.filter(q => q.status !== 'Resolved').length} unresolved · {queries.filter(q => q.status === 'Resolved').length} resolved
                        </p>
                      </div>
                    </div>
                    <div className="p-5">
                      {queries.length === 0 ? (
                        <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          <div className="text-4xl mb-3">📭</div>
                          <p className="text-slate-400 font-serif">No customer queries yet.</p>
                        </div>
                      ) : (
                        <div className="grid md:grid-cols-2 gap-4">
                          {queries.map(q => (
                            <div key={q.id} className={`rounded-2xl border transition-all relative overflow-hidden ${
                              q.status === 'Resolved'
                                ? 'bg-slate-50 border-slate-200 opacity-70'
                                : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                            }`}>
                              {q.status !== 'Resolved' && (
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#F47920] to-[#00AEEF] rounded-l-2xl" />
                              )}
                              <div className="p-5 pl-6">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <p className="font-serif text-base text-[#1B3B5A] font-bold truncate">{q.subject}</p>
                                      {q.status === 'Resolved' && (
                                        <span className="shrink-0 text-[8px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">✓ Done</span>
                                      )}
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                      {q.name} · <span className="lowercase normal-case font-normal">{q.email}</span>
                                    </p>
                                    {user.role === 'admin' && q.vendorEmail && (
                                      <p className="text-[10px] font-bold text-[#F47920] mt-0.5">→ {q.vendorEmail}</p>
                                    )}
                                  </div>
                                  <div className="flex gap-1.5 shrink-0">
                                    {q.status !== 'Resolved' && (
                                      <button onClick={() => handleResolveQuery(q.id)}
                                        className="text-[9px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors">
                                        Resolve
                                      </button>
                                    )}
                                    <button onClick={() => handleDeleteQuery(q.id)}
                                      className="text-[9px] font-bold uppercase tracking-widest bg-red-50 text-red-500 border border-red-200 px-2.5 py-1.5 rounded-lg hover:bg-red-100 transition-colors">
                                      Delete
                                    </button>
                                  </div>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-100">{q.message}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ─── VENDOR APPROVALS (Admin only) ─── */}
                {activeTab === 'vendors' && user.role === 'admin' && (
                  <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-[#1B3B5A]/5 rounded-xl flex items-center justify-center text-lg">🤝</div>
                        <div>
                          <h2 className="text-lg font-serif text-[#1B3B5A] font-bold">Vendor Approvals</h2>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                            {vendorList.filter(v => v.status === 'Pending' || !v.status).length} pending applications
                          </p>
                        </div>
                      </div>
                      <div className="flex bg-slate-100 p-1 rounded-full gap-1">
                        {[['pending', 'Pending'], ['approved', 'Approved']].map(([v, l]) => (
                          <button key={v} onClick={() => setVendorView(v)}
                            className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                              vendorView === v ? 'bg-white text-[#1B3B5A] shadow-sm' : 'text-slate-400 hover:text-slate-600'
                            }`}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[580px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            {['Name / Organisation', 'Email', 'Phone', 'Actions'].map(h => (
                              <th key={h} className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(() => {
                            const filtered = vendorList.filter(v =>
                              vendorView === 'pending' ? v.status === 'Pending' || !v.status : v.status === 'Approved'
                            );
                            if (filtered.length === 0) return (
                              <tr><td colSpan="4" className="p-10 text-center text-slate-400 font-serif">No {vendorView} applications.</td></tr>
                            );
                            return filtered.map(v => (
                              <tr key={v._id || v.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 bg-[#1B3B5A]/10 rounded-full flex items-center justify-center text-[#1B3B5A] text-sm font-bold uppercase">
                                      {(v.name || 'V').charAt(0)}
                                    </div>
                                    <span className="text-sm font-bold text-[#1B3B5A]">{v.name}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500 lowercase">{v.email}</td>
                                <td className="px-4 py-3 text-xs text-slate-500">{v.phone}</td>
                                <td className="px-4 py-3">
                                  {vendorView === 'pending' ? (
                                    <div className="flex gap-2">
                                      <button onClick={() => handleApproveVendor(v._id || v.id)}
                                        className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-all">
                                        ✓ Approve
                                      </button>
                                      <button onClick={() => handleRejectVendor(v._id || v.id)}
                                        className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 transition-all">
                                        ✕ Reject
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                                      ✓ Approved
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </main>
            </div>
          </div>
        ) : (
          /* ===== CUSTOMER PROFILE ===== */
          <div className="bg-white border border-slate-100 rounded-3xl shadow-sm p-6 md:p-8 w-full text-left">

            {/* Profile Header */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-6 pb-6 border-b border-slate-100">
              <div className="w-16 h-16 shrink-0 bg-gradient-to-br from-[#1B3B5A] to-[#00AEEF] rounded-full flex items-center justify-center text-white text-2xl font-serif font-bold shadow-lg ring-4 ring-sky-50">
                {(user.name || user.email).charAt(0).toUpperCase()}
              </div>
              <div className="text-center sm:text-left flex-1">
                <h1 className="text-2xl md:text-3xl font-serif text-[#1B3B5A]">{user.name || 'Friend'}</h1>
                <p className="text-xs text-slate-400 font-bold tracking-widest lowercase mt-0.5">{user.email}</p>
                <span className="inline-block mt-2 text-[9px] uppercase font-bold tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-1 rounded-full">
                  ✓ Verified Member
                </span>
              </div>
              <Link to="/" className="shrink-0 bg-[#1B3B5A] text-white px-5 py-2 rounded-full font-bold uppercase tracking-widest text-[9px] hover:bg-[#F47920] transition-all shadow-sm">
                Back to Store
              </Link>
            </div>

            {/* Tab Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-full mb-6 max-w-xs mx-auto sm:mx-0">
              {[['account', '👤 Account'], ['orders', '📦 My Orders']].map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setCustomerTab(tab)}
                  className={`flex-1 py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all ${customerTab === tab ? 'bg-white text-[#F47920] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ACCOUNT DETAILS TAB */}
            {customerTab === 'account' && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                  <p className="text-[9px] uppercase font-bold tracking-[0.2em] text-slate-400 mb-1">Full Name</p>
                  <p className="text-base font-serif text-[#1B3B5A] font-bold">{user.name || '—'}</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                  <p className="text-[9px] uppercase font-bold tracking-[0.2em] text-slate-400 mb-1">Email Address</p>
                  <p className="text-sm font-bold text-[#1B3B5A] break-all">{user.email}</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                  <p className="text-[9px] uppercase font-bold tracking-[0.2em] text-slate-400 mb-1">Phone Number</p>
                  <p className="text-sm font-bold text-[#1B3B5A]">{user.phone ? `+91 ${user.phone}` : '—'}</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                  <p className="text-[9px] uppercase font-bold tracking-[0.2em] text-slate-400 mb-1">Account Type</p>
                  <p className="text-sm font-bold text-[#1B3B5A] capitalize">{user.role || 'Customer'}</p>
                </div>

                <div className="bg-[#1B3B5A] rounded-2xl p-5 text-white sm:col-span-2">
                  <p className="text-[9px] uppercase font-bold tracking-[0.2em] text-slate-300 mb-1">Total Orders Placed</p>
                  <p className="text-3xl font-serif font-bold text-[#00AEEF]">{customerOrders.length}</p>
                  <button
                    onClick={() => setCustomerTab('orders')}
                    className="mt-2 text-[9px] uppercase font-bold tracking-widest text-[#F47920] hover:text-white transition-colors"
                  >
                    View All Orders →
                  </button>
                </div>

                <div className="sm:col-span-2 bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center">
                  <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                    🌟 Thank you for being part of the <span className="font-bold text-[#1B3B5A]">UPAY community</span>. Every purchase directly supports rural artisans and funds education for underprivileged children.
                  </p>
                </div>
              </div>
            )}

            {/* MY ORDERS TAB */}
            {customerTab === 'orders' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-serif text-[#1B3B5A]">Order History</h2>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                    {customerOrders.length} order{customerOrders.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {customerOrdersLoading ? (
                  <div className="flex items-center justify-center py-16 gap-3">
                    <div className="w-5 h-5 border-2 border-[#1B3B5A] border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-slate-400 font-bold uppercase tracking-widest">Loading orders...</span>
                  </div>
                ) : customerOrders.length === 0 ? (
                  <div className="bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-12 text-center">
                    <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">📦</div>
                    <p className="text-lg font-serif text-slate-500 mb-2">No orders yet</p>
                    <p className="text-xs text-slate-400 mb-5">Your order history will appear here once you make a purchase.</p>
                    <Link to="/" className="inline-block bg-[#F47920] text-white px-5 py-2 rounded-full font-bold uppercase tracking-widest text-[9px] hover:bg-[#D96516] transition-all shadow-sm">
                      Start Shopping
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {customerOrders.map(order => {
                      const statusLabels = ['Order Placed', 'Being Packed', 'Out for Delivery', 'Delivered'];
                      const statusColors = [
                        'bg-slate-50 text-slate-500 border-slate-200',
                        'bg-yellow-50 text-yellow-600 border-yellow-200',
                        'bg-orange-50 text-[#F47920] border-orange-200',
                        'bg-emerald-50 text-emerald-600 border-emerald-200'
                      ];
                      const statusEmojis = ['📋', '📦', '🚚', '✅'];
                      const statusIndex = order.status ?? 0;

                      // Items are stored as a comma-separated string in the DB
                      const itemsList = typeof order.items === 'string'
                        ? order.items.split(',').map(s => s.trim()).filter(Boolean)
                        : (order.items || []);

                      return (
                        <OrderCard
                          key={order.id}
                          order={order}
                          statusLabels={statusLabels}
                          statusColors={statusColors}
                          statusEmojis={statusEmojis}
                          statusIndex={statusIndex}
                          itemsList={itemsList}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Logout button for customer */}
            {user.role === 'customer' && (
              <div className="text-center mt-4">
                <button onClick={() => { setUser(null); navigate('/') }}
                  className="text-[#E31E24] font-bold uppercase tracking-widest text-[9px] hover:bg-red-50 border border-transparent hover:border-red-100 px-4 py-1.5 rounded-full transition-all">
                  Logout Account
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FaqPage() {
  const [openIndex, setOpenIndex] = useState(null);

  const faqData = [
    {
      category: "Registration",
      items: [
        { q: "Do I need to register before shopping on UPAY?", a: "While you can browse our collection as a guest, creating an account helps you track your orders and lifetime impact points." },
        { q: "Can I register multiple times using the same phone number/email ID?", a: "No, each email ID and phone number can only be associated with one UPAY account to ensure accurate impact tracking." }
      ]
    },
    {
      category: "Product / Price / Promotion",
      items: [
        { q: "How do I look for a particular Product?", a: "You can use the search bar at the top of the page to easily explore our handmade collection." },
        { q: "How will you ensure the quality of products?", a: "Every item is meticulously handcrafted by our rural artisans and undergoes strict quality checks before shipping." },
        { q: "How can I check if the product I am ordering is in stock?", a: "If a product is visible and allows you to add it to your basket, it is currently in stock. Items out of stock will be clearly marked." }
      ]
    },
    {
      category: "Ordering",
      items: [
        { q: "How do I know if I placed my order correctly?", a: "Once your payment is processed, you will see a success screen and order confirmation." },
        { q: "Can I call and place an order?", a: "Currently, to maintain transparency in our NGO operations, we only accept orders directly through our secure website." },
        { q: "How are the handmade products measured?", a: "Standard dimensions and details for all our bags, masks, and accessories are provided in their respective product descriptions." },
        { q: "How do I make changes to my order?", a: "Please contact our support team at info@upay.org.in within 24 hours of placing your order for any modifications." }
      ]
    }
  ];

  const toggleFaq = (idx) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="flex-grow flex justify-center items-start w-full px-6 py-6 md:py-10">
      <div className="bg-white w-full max-w-4xl shadow-lg rounded-[2.5rem] overflow-hidden border border-slate-200">
        <div className="bg-[#1B3B5A] text-white p-6 md:p-8 flex flex-col items-center text-center">
          <span className="text-[#00AEEF] font-bold tracking-[0.3em] uppercase text-xs mb-2 block">Knowledge Base</span>
          <h1 className="text-3xl md:text-4xl font-serif italic">Frequently Asked Questions</h1>
        </div>
        <div className="p-6 md:p-10">
          {faqData.map((section, sIdx) => (
            <div key={sIdx} className="mb-8 last:mb-0">
              <h2 className="text-sm font-bold tracking-widest uppercase text-slate-400 mb-4 pb-3 border-b border-slate-100">{section.category}</h2>
              <div className="flex flex-col space-y-3">
                {section.items.map((item, iIdx) => {
                  const globalIdx = `${sIdx}-${iIdx}`;
                  const isOpen = openIndex === globalIdx;
                  return (
                    <div key={iIdx} className={`border rounded-2xl transition-all ${isOpen ? 'border-[#00AEEF] bg-sky-50/30' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex items-center justify-between p-4 cursor-pointer select-none" onClick={() => toggleFaq(globalIdx)}>
                        <span className="text-base font-serif text-[#1B3B5A] pr-4">{item.q}</span>
                        <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 text-xs ${isOpen ? 'bg-[#00AEEF] text-white rotate-180' : 'bg-slate-100 text-slate-500'}`}>
                          ↓
                        </span>
                      </div>
                      <div className={`overflow-hidden transition-all duration-300 px-4 text-slate-600 text-sm leading-relaxed ${isOpen ? 'max-h-40 pb-4 opacity-100' : 'max-h-0 opacity-0'}`}>
                        {item.a}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// ORDER CARD — used in customer's My Orders tab
// Shows order summary with an expandable live-tracking panel
// =====================================================
function OrderCard({ order, statusLabels, statusColors, statusEmojis, statusIndex, itemsList }) {
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [liveOrder, setLiveOrder] = useState(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState('');

  const steps = ['Ordered', 'Packed', 'Shipped', 'Delivered'];
  const stepDescriptions = [
    'Your order has been received and confirmed.',
    'Our artisans are carefully packing your items.',
    'Your order is on its way to you!',
    'Your order has been delivered. Enjoy!'
  ];
  const stepIcons = ['📋', '📦', '🚚', '🏠'];

  const handleTrackToggle = async () => {
    if (trackingOpen) { setTrackingOpen(false); return; }
    setTrackingOpen(true);
    if (liveOrder) return; // already fetched — no need to fetch again
    setTrackLoading(true);
    setTrackError('');
    try {
      const res = await fetch(`https://upay-e-commerce-website.onrender.com/api/orders/${order.id}`);
      const data = await res.json();
      if (data.order) {
        setLiveOrder(data.order);
      } else {
        setTrackError('Could not load live tracking. Showing last known status.');
        setLiveOrder(order);
      }
    } catch {
      setTrackError('Cannot connect to server. Showing last known status.');
      setLiveOrder(order);
    }
    setTrackLoading(false);
  };

  const displayStatus = liveOrder ? (liveOrder.status ?? statusIndex) : statusIndex;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">

      {/* Order Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-slate-50 border-b border-slate-100">
        <div>
          <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-0.5">Order ID</p>
          <p className="text-base font-serif font-bold text-[#1B3B5A]">#{order.id}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-0.5">Placed On</p>
          <p className="text-xs font-bold text-slate-600">
            {order.date ? new Date(order.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-0.5">Total</p>
          <p className="text-lg font-serif font-bold text-[#F47920]">₹{order.total}</p>
        </div>
        <span className={`text-[9px] uppercase font-bold tracking-widest px-3 py-1.5 rounded-full border ${statusColors[statusIndex] || statusColors[0]}`}>
          {statusEmojis[statusIndex]} {statusLabels[statusIndex] || 'Processing'}
        </span>
      </div>

      {/* Items List */}
      <div className="px-5 pt-4 pb-3">
        <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-3">Items Ordered</p>
        <div className="flex flex-col gap-2 mb-4">
          {itemsList.length > 0 ? itemsList.map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F47920] shrink-0 mt-1.5"></span>
              <span className="text-slate-700">{item}</span>
            </div>
          )) : (
            <p className="text-xs text-slate-400">No item details available.</p>
          )}
        </div>

        {/* Track Order Toggle Button */}
        <button
          onClick={handleTrackToggle}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] border transition-all duration-200 ${
            trackingOpen
              ? 'bg-[#1B3B5A] text-white border-[#1B3B5A] shadow-md'
              : 'bg-slate-50 text-[#1B3B5A] border-slate-200 hover:bg-[#1B3B5A] hover:text-white hover:border-[#1B3B5A]'
          }`}
        >
          <span className="flex items-center gap-2">
            <span>🔍</span>
            {trackingOpen ? 'Hide Tracking' : 'Track This Order'}
          </span>
          <span className={`transition-transform duration-300 ${trackingOpen ? 'rotate-180' : ''}`}>↓</span>
        </button>
      </div>

      {/* Expandable Live Tracking Panel */}
      <div className={`overflow-hidden transition-all duration-500 ease-in-out ${trackingOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-5 pb-5 border-t border-slate-100 pt-5">

          {trackLoading ? (
            <div className="flex items-center justify-center gap-3 py-6">
              <div className="w-4 h-4 border-2 border-[#1B3B5A] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Fetching live status…</span>
            </div>
          ) : (
            <>
              {trackError && (
                <div className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4 flex items-center gap-2">
                  ⚠️ {trackError}
                </div>
              )}

              {/* Live Status Badge */}
              <div className="flex items-center justify-between mb-5">
                <p className="text-[9px] uppercase font-bold tracking-[0.2em] text-slate-400">Live Status</p>
                <span className={`text-[9px] uppercase font-bold tracking-widest px-3 py-1.5 rounded-full border ${statusColors[displayStatus] || statusColors[0]}`}>
                  {statusEmojis[displayStatus]} {statusLabels[displayStatus] || 'Processing'}
                </span>
              </div>

              {/* 4-Step Progress Tracker */}
              <div className="flex items-start">
                {steps.map((step, i) => (
                  <div key={step} className="flex items-start flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center text-base font-bold mb-2 transition-all shadow-sm ${
                        i < displayStatus
                          ? 'bg-[#1B3B5A] text-white shadow-[#1B3B5A]/20'
                          : i === displayStatus
                          ? 'bg-[#F47920] text-white ring-4 ring-[#F47920]/20 shadow-[#F47920]/30'
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}>
                        {i < displayStatus ? '✓' : stepIcons[i]}
                      </div>
                      <p className={`text-[9px] font-bold uppercase tracking-wider text-center leading-tight ${
                        i === displayStatus ? 'text-[#F47920]' :
                        i < displayStatus ? 'text-[#1B3B5A]' : 'text-slate-400'
                      }`}>{step}</p>
                      {i === displayStatus && (
                        <p className="text-[8px] text-slate-500 text-center mt-1 px-1 leading-relaxed max-w-[70px]">
                          {stepDescriptions[i]}
                        </p>
                      )}
                    </div>
                    {i < steps.length - 1 && (
                      <div className={`h-0.5 flex-1 mt-5 mx-1 rounded-full transition-all duration-500 ${
                        i < displayStatus ? 'bg-[#1B3B5A]' : 'bg-slate-200'
                      }`} />
                    )}
                  </div>
                ))}
              </div>

              {displayStatus === 3 && (
                <div className="mt-5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs font-bold text-emerald-600">🎉 Order Delivered! Thank you for supporting UPAY artisans.</p>
                </div>
              )}

              <p className="text-[10px] text-slate-400 text-center mt-4">
                Need help? Email us at{' '}
                <a href="mailto:info@upay.org.in" className="text-[#00AEEF] hover:underline font-bold">info@upay.org.in</a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// GUARD: Only logged-in customers can access /orders
// =====================================================
function CustomerOnlyGuard({ user }) {
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="flex-grow flex items-center justify-center w-full px-6 py-10">
        <div className="bg-white border border-slate-100 rounded-[2rem] shadow-md p-10 text-center max-w-sm w-full">
          <div className="w-14 h-14 bg-[#1B3B5A] rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl shadow-md">🔒</div>
          <h2 className="text-2xl font-serif text-[#1B3B5A] mb-2">Login Required</h2>
          <p className="text-xs text-slate-400 mb-6 leading-relaxed">You need to be logged in as a customer to track your orders.</p>
          <button
            onClick={() => navigate('/login')}
            className="bg-[#1B3B5A] text-white px-6 py-2.5 rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-[#F47920] transition-all shadow-sm"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Admin or vendor trying to access customer-only page
  return (
    <div className="flex-grow flex items-center justify-center w-full px-6 py-10">
      <div className="bg-white border border-slate-100 rounded-[2rem] shadow-md p-10 text-center max-w-sm w-full">
        <div className="w-14 h-14 bg-orange-50 border border-orange-200 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">⚠️</div>
        <h2 className="text-2xl font-serif text-[#1B3B5A] mb-2">Customers Only</h2>
        <p className="text-xs text-slate-400 mb-6 leading-relaxed">Order tracking is only available for customer accounts. Admin and vendor dashboards have their own order management section.</p>
        <button
          onClick={() => navigate('/dashboard')}
          className="bg-[#1B3B5A] text-white px-6 py-2.5 rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-[#F47920] transition-all shadow-sm"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}

function OrderTrackingPage({ user }) {
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const steps = ['Ordered', 'Packed', 'Shipped', 'Delivered'];
  const stepEmojis = ['✓', '✓', '🚚', '🏠'];

  const handleTrack = async (e) => {
    e.preventDefault();
    if (!orderId.trim()) {
      setError('Please enter an Order ID.');
      return;
    }
    setLoading(true);
    setError('');
    setOrder(null);
    try {
      const res = await fetch(`https://upay-e-commerce-website.onrender.com/api/orders/${orderId.trim()}`);
      const data = await res.json();
      if (data.order) {
        setOrder(data.order);
      } else {
        setError('Order not found. Please check your Order ID.');
      }
    } catch (err) {
      setError('Cannot connect to server. Make sure your backend is running.');
    }
    setLoading(false);
  };

  return (
    <div className="flex-grow w-full max-w-3xl mx-auto px-6 py-10">

      <h1 className="text-3xl md:text-4xl font-serif italic text-[#1B3B5A] mb-2">Track Your Order</h1>
      <p className="text-slate-500 text-sm mb-8">Enter your Order ID received in your confirmation to see live status.</p>

      {/* SEARCH BOX */}
      <form onSubmit={handleTrack} className="flex gap-3 mb-8">
        <input
          type="text"
          placeholder="Enter Order ID (e.g. 2847)"
          value={orderId}
          onChange={e => setOrderId(e.target.value)}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/50"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-[#1B3B5A] text-white px-6 py-3 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-[#F47920] transition-all disabled:opacity-60"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block"></span>
              Tracking...
            </span>
          ) : 'Track'}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-500 text-sm px-4 py-3 rounded-2xl mb-6 flex items-center gap-2">
          ⚠️ {error}
        </div>
      )}

      {order && (
        <div className="bg-white border border-slate-100 rounded-[2rem] shadow-md p-6 md:p-8">

          {/* Order Header */}
          <div className="flex justify-between items-center mb-8 pb-5 border-b border-slate-100">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Order ID</p>
              <p className="text-2xl font-serif font-bold text-[#1B3B5A]">#{order.id}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Placed on</p>
              <p className="text-sm text-slate-600">{order.date}</p>
            </div>
          </div>

          {/* Progress Tracker */}
          <div className="flex items-start mb-8">
            {steps.map((step, i) => (
              <div key={step} className="flex items-start flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mb-2 transition-all ${
                    i < order.status ? 'bg-[#1B3B5A] text-white' :
                    i === order.status ? 'bg-[#F47920] text-white' :
                    'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}>
                    {i <= order.status ? stepEmojis[i] : ''}
                  </div>
                  <p className={`text-[10px] font-bold uppercase tracking-widest text-center ${
                    i === order.status ? 'text-[#F47920]' :
                    i < order.status ? 'text-[#1B3B5A]' :
                    'text-slate-400'
                  }`}>{step}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 mt-5 mx-1 rounded-full transition-all ${
                    i < order.status ? 'bg-[#1B3B5A]' : 'bg-slate-200'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* Status Badge */}
          <div className="flex justify-center mb-6">
            <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
              order.status === 3 ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
              order.status === 2 ? 'bg-orange-50 text-[#F47920] border border-orange-200' :
              'bg-slate-50 text-slate-500 border border-slate-200'
            }`}>
              {order.status === 0 ? '📋 Order Placed' :
               order.status === 1 ? '📦 Being Packed' :
               order.status === 2 ? '🚚 Out for Delivery' :
               '✅ Delivered'}
            </span>
          </div>

          {/* Order Items */}
          <div className="border-t border-slate-100 pt-5">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-4">Items Ordered</p>
            <div className="space-y-3">
              {order.items && order.items.length > 0 ? (
                order.items.map((item, i) => (
                  <div key={i} className="flex justify-between items-center text-sm bg-slate-50 px-4 py-3 rounded-xl">
                    <span className="text-slate-700 font-medium">
                      {item.name}
                      {item.qty > 1 && <span className="text-slate-400 ml-2">× {item.qty}</span>}
                    </span>
                    {item.price > 0 && (
                      <span className="font-bold text-[#1B3B5A]">₹{item.price}</span>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-sm">No item details available.</p>
              )}

              {order.total > 0 && (
                <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-2">
                  <span className="font-bold text-slate-700 uppercase tracking-widest text-[10px]">Order Total</span>
                  <span className="font-bold text-[#F47920] text-xl font-serif">₹{order.total}</span>
                </div>
              )}
            </div>
          </div>

          {/* Help Text */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400">
              Need help? Contact us at{' '}
              <a href="mailto:info@upay.org.in" className="text-[#00AEEF] hover:underline">info@upay.org.in</a>
            </p>
          </div>

        </div>
      )}
    </div>
  );
}