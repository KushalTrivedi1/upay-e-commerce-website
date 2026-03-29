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
  const [cart, setCart] = useState([])
  const [user, setUser] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [extraDonation, setExtraDonation] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  
  // --- DYNAMIC CATEGORY STATE ---
  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('upay_categories');
    return saved ? JSON.parse(saved) : ['Bags', 'Accessories', 'Masks'];
  });

  const navigate = useNavigate();
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  const searchRef = useRef(null)
useEffect(() => {
  const handleClickOutside = (e) => {
    if (searchRef.current && !searchRef.current.contains(e.target)) {
      setShowSuggestions(false)
    }
  }
  document.addEventListener('mousedown', handleClickOutside)
  return () => document.removeEventListener('mousedown', handleClickOutside)
}, [])

  // Save categories to local storage whenever they change
  useEffect(() => {
    localStorage.setItem('upay_categories', JSON.stringify(categories));
  }, [categories]);

  const fetchProducts = () => {
    fetch('http://localhost:5001/api/products')
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
        
        // Auto-add any new categories found in the database that aren't in state
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
  }

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      (activeCategory === 'All' || p.category === activeCategory) &&
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [products, searchTerm, activeCategory])

  const suggestions = useMemo(() => {
  if (!searchTerm.trim() || searchTerm.length < 1) return [];
  return products
    .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .slice(0, 5);
}, [products, searchTerm])

  const addToCart = (p) => {
    if (p.inStock === false) return; 
    const ex = cart.find(i => i.id === p.id)
    ex ? setCart(cart.map(i => i.id === p.id ? {...i, quantity: i.quantity + 1} : i)) : setCart([...cart, {...p, quantity: 1}])
  }

  const updateCartItemQuantity = (id, delta) => {
    setCart(prevCart => {
      return prevCart.map(item => {
        if (item.id === id) {
          const newQuantity = item.quantity + delta;
          return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
        }
        return item;
      }).filter(Boolean);
    });
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

          {/* ✅ NEW SEARCH WITH DROPDOWN */}
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
            <Link to="/orders" className="hover:text-[#F47920] transition-colors">Orders</Link>
            {user ? <Link to="/dashboard" className="text-[#1B3B5A] hover:text-[#F47920] transition-colors">{user.role === 'admin' || user.role === 'vendor' ? (user.role === 'admin' ? 'Admin' : 'Vendor') : 'Profile'}</Link> : <Link to="/login" className="hover:text-[#F47920] transition-colors">Login</Link>}
           
            <Link to="/cart" className="bg-[#F47920] text-white px-4 py-2 rounded-full shadow-md hover:bg-[#D96516] hover:shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center gap-2">
  Cart          <span className="bg-white/20 px-2 py-0.5 rounded-full">{cart.reduce((s,i)=>s+i.quantity,0)}</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* DYNAMIC CONTENT WRAPPER */}
      <div className="flex-grow flex flex-col">
        <Routes>
          <Route path="/" element={<Home products={filteredProducts} categories={categories} setActiveCategory={setActiveCategory} activeCategory={activeCategory} loading={loading} addToCart={addToCart} cart={cart} updateQuantity={updateCartItemQuantity} />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/product/:id" element={<ProductDetail addToCart={addToCart} allProducts={products} cart={cart} updateQuantity={updateCartItemQuantity} />} />
          <Route path="/cart" element={<CartPage cart={cart} setCart={setCart} user={user} donation={extraDonation} setDonation={setExtraDonation} updateQuantity={updateCartItemQuantity} />} />
          <Route path="/login" element={<LoginPage setUser={setUser} />} />
          <Route path="/dashboard" element={<Dashboard user={user} setUser={setUser} products={products} setProducts={setProducts} refreshProducts={fetchProducts} categories={categories} setCategories={setCategories} />} />
          <Route path="/contact" element={<ContactPage products={products} />} />
          <Route path="/orders" element={<OrderTrackingPage user={user} />} />
        </Routes>
      </div>

      {/* FOOTER SECTION */}
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
  )
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
      
      <header className="relative py-14 text-center overflow-hidden rounded-[2rem] mb-10 shadow-lg bg-slate-900 flex items-center justify-center min-h-[260px]">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?q=80&w=2000')] bg-cover bg-center opacity-40 mix-blend-overlay"></div>
        <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-[1px]"></div>
        
        <div className="relative z-10 px-6 w-full max-w-3xl mx-auto">
          <span className="text-[#F47920] font-bold tracking-[0.3em] uppercase text-[10px] mb-3 block drop-shadow-md">
            Handcrafted with Purpose
          </span>
          <h1 className="text-5xl md:text-6xl font-serif italic mb-4 text-white drop-shadow-xl tracking-wider">
            UPAY
          </h1>
          <div className="w-16 h-1 bg-[#00AEEF] mx-auto mb-5 rounded-full"></div>
          <p className="text-base md:text-lg font-serif text-slate-200 leading-relaxed drop-shadow-md max-w-xl mx-auto mb-8">
            Empowering underprivileged children, building brighter futures.
          </p>
          <div>
            <button 
              onClick={() => window.scrollTo({ top: 400, behavior: 'smooth' })} 
              className="bg-[#F47920] text-white px-8 py-3 rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-[#D96516] hover:scale-105 transition-all duration-300 shadow-[0_0_15px_rgba(244,121,32,0.4)]"
            >
              Explore Collection
            </button>
          </div>
        </div>
      </header>

      {/* DYNAMIC CATEGORY FILTERS */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar mb-10 py-2 justify-center">
        {['All', ...categories].map(cat => (
          <button 
            key={cat} 
            onClick={() => setActiveCategory(cat)} 
            className={`px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${
              activeCategory === cat 
                ? 'bg-[#1B3B5A] text-white shadow-lg transform -translate-y-0.5' 
                : 'bg-white text-slate-500 border border-slate-200 hover:border-[#1B3B5A] hover:text-[#1B3B5A] hover:shadow-md'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* PRODUCT CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
        {products.map(p => {
          const cartItem = cart?.find(i => i.id === p.id);
          const isOutOfStock = p.inStock === false; 
          
          return (
  <div key={p.id} className={`group bg-white rounded-[2rem] p-4 shadow-md border border-slate-100 flex flex-col relative transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 hover:border-[#F47920]/30 ${isOutOfStock ? 'opacity-75 hover:translate-y-0 hover:shadow-sm' : ''}`}>
    
    {p.subCategory && (
      <div className="absolute top-6 right-6 z-10 bg-white/95 backdrop-blur-sm text-[#1B3B5A] text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm border border-slate-100">
        {p.subCategory}
      </div>
    )}

    <Link to={`/product/${p.id}`} className="w-full mb-4 overflow-hidden rounded-2xl h-48 bg-gradient-to-b from-slate-50 to-gray-100 relative block">
      <img 
        src={p.img} 
        alt={p.name} 
        className={`w-full h-full object-contain transition-transform duration-700 ease-out ${isOutOfStock ? 'grayscale opacity-60' : 'group-hover:scale-110'}`} 
      />
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white/40 to-transparent pointer-events-none rounded-b-2xl" />
      {isOutOfStock && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/10 backdrop-blur-[2px]">
          <span className="bg-[#E31E24] text-white px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-xl">
            Out of Stock
          </span>
        </div>
      )}
    </Link>
    
    <div className="flex-grow flex flex-col px-2">
      <div className="mb-4">
        <h3 className="text-base font-bold text-[#1B3B5A] leading-snug line-clamp-2 group-hover:text-[#F47920] transition-colors duration-300" title={p.name}>{p.name}</h3>
        <p className="text-[10px] text-slate-500 mt-1.5 font-medium">Sold by: <span className="text-[#00AEEF]">{p.vendor}</span></p>
      </div>
      
      <div className="mt-auto w-full flex flex-col gap-3 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <p className={`font-bold text-xl ${isOutOfStock ? 'text-slate-400 line-through' : 'text-[#F47920]'}`}>₹{p.price}</p>
          {p.deliveryDays && !isOutOfStock && (
            <span className="text-[9px] text-slate-400 font-medium">{p.deliveryDays}</span>
          )}
        </div>

        {cartItem ? (
          <div className="flex items-center justify-between bg-slate-50 rounded-full px-3 py-1 border border-slate-200">
            <button onClick={(e) => { e.preventDefault(); updateQuantity(p.id, -1); }} className="text-xl text-slate-600 hover:text-[#F47920] w-8 h-8 flex items-center justify-center leading-none transition-colors rounded-full hover:bg-slate-200">-</button>
            <span className="font-serif text-sm w-4 text-center text-[#1B3B5A] font-bold">{cartItem.quantity}</span>
            <button onClick={(e) => { e.preventDefault(); updateQuantity(p.id, 1); }} className="text-xl text-slate-600 hover:text-[#F47920] w-8 h-8 flex items-center justify-center leading-none transition-colors rounded-full hover:bg-slate-200">+</button>
          </div>
        ) : (
          <button 
            onClick={(e) => { e.preventDefault(); if (!isOutOfStock) addToCart(p); }} 
            disabled={isOutOfStock}
            className={`w-full py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${isOutOfStock ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-[#1B3B5A] text-white hover:bg-[#F47920] hover:shadow-lg hover:scale-105'}`}
            aria-label="Add to cart"
          >
            {isOutOfStock ? 'Sold Out' : 'Add to Cart'}
          </button>
        )}
      </div>
    </div>
  </div>
);
            
        })}
      </div>
    </div>
  )
}

function ContactPage({ products }) {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '', vendorEmail: 'admin@upay.com' });
  const [submitted, setSubmitted] = useState(false);

  // Extract unique vendors from products
  const uniqueVendors = [...new Set(products?.map(p => p.vendor).filter(Boolean))] || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch('http://localhost:5001/api/queries', {
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
                onChange={e => setForm({...form, vendorEmail: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/50 cursor-pointer"
              >
                <option value="admin@upay.com">General Inquiry (Admin)</option>
                {uniqueVendors.filter(v => v !== 'admin@upay.com').map(v => (
                  <option key={v} value={v}>Specific Vendor: {v}</option>
                ))}
              </select>
              
              <div className="grid md:grid-cols-2 gap-4">
                <input type="text" placeholder="Full Name" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/50" required onChange={e => setForm({...form, name: e.target.value})} />
                <input type="email" placeholder="Email Address" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/50" required onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <input type="text" placeholder="Subject" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/50" required onChange={e => setForm({...form, subject: e.target.value})} />
              <textarea placeholder="Your Message" rows="4" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/50 resize-none" required onChange={e => setForm({...form, message: e.target.value})}></textarea>
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
  const { id } = useParams()
  const p = allProducts.find(item => item.id === parseInt(id)) || PRODUCTS_BACKUP.find(item => item.id === parseInt(id))
  
  if (!p) return <div className="flex-grow flex items-center justify-center text-slate-500 font-serif text-2xl">Product not found.</div>
  
  const cartItem = cart?.find(i => i.id === p.id);
  const isOutOfStock = p.inStock === false;

  return (
    <div className="flex-grow flex items-center justify-center w-full max-w-5xl mx-auto px-6 py-4">
      <div className="grid md:grid-cols-2 gap-8 items-center w-full bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        
        {/* Left Side: Product Image */}
        <div className="relative w-full max-w-sm mx-auto">
          <img src={p.img} alt={p.name} className={`w-full aspect-square object-cover rounded-3xl shadow-sm border border-slate-50 ${isOutOfStock ? 'grayscale opacity-70' : ''}`} />
          {isOutOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/10 backdrop-blur-[2px] rounded-3xl">
              <span className="bg-[#E31E24] text-white px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-xl">
                Out of Stock
              </span>
            </div>
          )}
        </div>
        
        {/* Right Side: Product Info */}
        <div className="space-y-4 md:space-y-5 flex flex-col justify-center">
          <div>
            <span className="text-[#F47920] font-bold tracking-widest uppercase text-[10px] mb-1.5 block">{p.category} {p.subCategory && `• ${p.subCategory}`}</span>
            <h1 className="text-3xl md:text-4xl font-serif leading-tight text-[#1B3B5A] mb-2">{p.name}</h1>
            <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-widest">Vendor: <span className="text-[#00AEEF] lowercase">{p.vendor}</span></p>
            <p className="text-sm text-slate-500 leading-relaxed max-w-md">
              {p.description || "Every purchase directly supports our rural artisans and funds educational programs for underprivileged children. Handcrafted with care and purpose."}
            </p>
          </div>

          <div className="flex flex-col py-3 border-y border-slate-100">
            <div className="flex items-center gap-5 mb-2">
              <p className={`text-3xl font-serif ${isOutOfStock ? 'text-slate-400 line-through' : 'text-[#F47920]'}`}>₹{p.price}</p>
              {isOutOfStock && <span className="bg-red-50 text-[#E31E24] px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border border-red-100">Unavailable</span>}
            </div>
            {p.deliveryDays && (
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                🚚 Expected Delivery: <span className="text-[#00AEEF]">{p.deliveryDays}</span>
              </p>
            )}
          </div>
          
          <div className="pt-1">
            {isOutOfStock ? (
              <button disabled className="w-full max-w-xs bg-slate-100 text-slate-400 py-3 rounded-xl font-bold uppercase tracking-widest cursor-not-allowed text-xs shadow-inner">Sold Out</button>
            ) : cartItem ? (
              <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-1.5 shadow-inner border border-slate-200 w-full max-w-xs">
                <button onClick={(e) => { e.preventDefault(); updateQuantity(p.id, -1); }} className="text-2xl text-slate-600 hover:text-[#F47920] w-10 h-10 flex items-center justify-center leading-none transition-colors rounded-lg hover:bg-slate-200">-</button>
                <span className="font-serif text-xl text-[#1B3B5A] font-bold">{cartItem.quantity}</span>
                <button onClick={(e) => { e.preventDefault(); updateQuantity(p.id, 1); }} className="text-2xl text-slate-600 hover:text-[#F47920] w-10 h-10 flex items-center justify-center leading-none transition-colors rounded-lg hover:bg-slate-200">+</button>
              </div>
            ) : (
              <button onClick={() => addToCart(p)} className="w-full max-w-xs bg-[#F47920] text-white py-3 rounded-xl font-bold uppercase tracking-widest text-xs shadow-md hover:bg-[#1B3B5A] hover:-translate-y-0.5 transition-all">Add to Basket</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CartPage({ cart, setCart, donation, setDonation, updateQuantity, user }) { 
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState(''); 
  const [showPaymentModal, setShowPaymentModal] = useState(false); 
  const [paymentMethod, setPaymentMethod] = useState('COD'); 
  const navigate = useNavigate();

  const subtotal = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
  const total = subtotal + donation;
  const FREE_SHIPPING_THRESHOLD = 499;
  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const shippingProgress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  // 1. EXTRACTED ORDER PROCESSING LOGIC
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
        
        return fetch('http://localhost:5001/api/orders', { 
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


  // 2. THE SECURE CHECKOUT HANDLER
  const handleCheckout = async () => { 
    if (cart.length === 0) return;

    if (paymentMethod === 'UPI') { 
      // Step A: Load the Razorpay SDK
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        alert("Razorpay SDK failed to load. Are you online?");
        return;
      }

      // Step B: Ask backend to create a Razorpay Order
      const orderRes = await fetch("http://localhost:5001/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: total })
      });
      const orderData = await orderRes.json();
      
      if (!orderData.success) {
        alert("Server error. Are you sure the backend is running?");
        return;
      }

      // Step C: Open Razorpay Checkout securely
      const options = { 
        key: "YOUR_RAZORPAY_KEY_ID", // <-- Replace with your real Key ID
        amount: orderData.order.amount, 
        currency: "INR", 
        name: "UPAY NGO", 
        description: "Order Payment", 
        order_id: orderData.order.id, // <-- Pass the secure order ID generated by backend
        handler: async function (response) { 
          // Step D: Verify Payment Signature with backend before fulfilling order
          const verifyRes = await fetch("http://localhost:5001/api/razorpay/verify", {
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
            // Step E: If successful and verified, save order in DB
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
      rzp.on('payment.failed', function (response){
        alert("Payment Failed: " + response.error.description);
      });
      rzp.open(); 
    } else {
      // Cash on Delivery Flow
      await processOrderAfterPayment("COD");
    }
  };

// ... keep your return statement exactly as it is ...


  return (
    <div className="flex-grow w-full max-w-6xl mx-auto px-6 py-6 md:py-10 relative">
      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-end justify-between mb-4 border-b border-slate-200 pb-3">
             <h2 className="text-3xl md:text-4xl font-serif italic text-[#1B3B5A]">My Cart</h2>
             <span className="text-slate-500 text-sm font-bold uppercase tracking-widest">{cart.length} items</span>
          </div>
          
          {cart.length === 0 ? (
            <div className="bg-white p-12 rounded-[2rem] text-center border border-dashed border-slate-300">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300 text-2xl">🛒</div>
              <p className="text-xl font-serif text-slate-500 mb-5">Your basket is feeling empty.</p>
              <Link to="/" className="inline-block bg-[#1B3B5A] text-white px-6 py-2.5 rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-[#F47920] transition-colors">Explore Collection</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map(item => (
                <div key={item.id} className="flex flex-col md:flex-row gap-5 items-center bg-white p-4 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                  <img src={item.img} alt={item.name} className="w-20 h-20 object-cover rounded-2xl bg-slate-50" />
                  <div className="flex-1 text-center md:text-left">
                    <div className="font-serif text-xl text-[#1B3B5A] mb-1">{item.name}</div>
                    <div className="text-slate-400 text-xs font-bold uppercase tracking-widest">{item.category}</div>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-2 py-1 border border-slate-200">
                    <button onClick={() => updateQuantity(item.id, -1)} className="text-xl text-slate-600 hover:text-[#F47920] w-8 h-8 flex items-center justify-center leading-none rounded-lg hover:bg-slate-200 transition-colors">-</button>
                    <span className="font-serif text-lg w-6 text-center text-[#1B3B5A] font-bold">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="text-xl text-slate-600 hover:text-[#F47920] w-8 h-8 flex items-center justify-center leading-none rounded-lg hover:bg-slate-200 transition-colors">+</button>
                  </div>

                  <div className="text-[#F47920] font-bold text-xl min-w-[100px] text-center md:text-right">₹{item.price * item.quantity}</div>
                </div>
              ))}
            </div>
          )}
          
          <div className="bg-[#1B3B5A] text-white p-6 md:p-8 rounded-[2rem] shadow-md relative overflow-hidden mt-8">
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
            <h4 className="text-xl font-serif mb-3 text-[#00AEEF]">Donate a Little Extra?</h4>
            <p className="text-slate-300 text-xs mb-5 max-w-md leading-relaxed">100% of your extra donation goes directly to funding our "Reach & Teach" street classrooms.</p>
            <input type="range" min="0" max="2000" step="50" value={donation} onChange={(e)=>setDonation(parseInt(e.target.value))} className="w-full mb-5 accent-[#F47920] h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Amount</span>
              <p className="text-3xl font-serif text-white">₹{donation}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 md:p-8 rounded-[2rem] h-fit sticky top-24 shadow-md border border-slate-100">
          <h3 className="text-lg font-bold uppercase tracking-widest mb-4 text-slate-800">Order Summary</h3>

          {/* FREE SHIPPING PROGRESS BAR */}
          <div className="mb-5 pb-5 border-b border-slate-100">
            {remainingForFreeShipping === 0 ? (
              <p className="text-[11px] font-bold text-emerald-600 mb-2">🎉 You've unlocked free shipping!</p>
            ) : (
              <p className="text-[11px] text-slate-500 mb-2">
                Add <span className="font-bold text-[#F47920]">₹{remainingForFreeShipping}</span> more for free shipping!
              </p>
            )}
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#1B3B5A] to-[#F47920] rounded-full transition-all duration-500"
                style={{ width: `${shippingProgress}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[9px] text-slate-400">₹0</span>
              <span className="text-[9px] text-slate-400">Free shipping at ₹499</span>
            </div>
          </div>
          <div className="space-y-4 text-sm mb-8 text-slate-600">
            <div className="flex justify-between"><span>Subtotal</span><span className="font-bold text-slate-800">₹{subtotal}</span></div>
            {donation > 0 && (
              <div className="flex justify-between text-[#F47920]"><span>NGO Donation</span><span className="font-bold">₹{donation}</span></div>
            )}
            <div className="flex justify-between text-xs text-slate-400"><span>Shipping</span><span>Calculated at next step</span></div>
            <hr className="border-slate-200 my-4" />
            <div className="flex justify-between text-2xl font-serif font-bold text-[#1B3B5A]"><span>Total</span><span className="text-[#F47920]">₹{total}</span></div>
          </div>
          
          <button onClick={() => setShowPaymentModal(true)} className="w-full bg-[#F47920] text-white py-3.5 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-[#1B3B5A] hover:shadow-md transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-none" disabled={cart.length === 0}>Proceed to Checkout</button>
        </div>
      </div>

      {/* --- NEW PAYMENT MODAL JSX --- */}
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
  )
}

function LoginPage({ setUser }) {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true); 
  const [role, setRole] = useState('customer'); // Options: 'customer', 'vendor', or 'admin'

  // Force login view for admin so they can't sign up
  useEffect(() => {
    if (role === 'admin') {
      setIsLogin(true); 
    }
  }, [role]);

  const [name, setName] = useState(''); 
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); 

    if (!isLogin) {
      if (phone.length !== 10) {
        setError("Phone number must be exactly 10 digits.");
        return;
      }
    }
    
    const endpoint = isLogin ? 'http://localhost:5001/api/login' : 'http://localhost:5001/api/register';
    
    // Include the selected role in the payload
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

        // --- VENDOR APPROVAL LOGIC ---
        // If it's a new vendor signing up, show message instead of logging in
        if (!isLogin && role === 'vendor') {
          alert("Application received! Please wait for admin approval before logging in.");
          setIsLogin(true); // Switch back to login screen for them
          return;
        }

        setUser({ 
          name: data.user.name, 
          email: data.user.email, 
          role: assignedRole, 
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
        
        {/* Dynamic Title based on Role & Login State */}
        <h2 className="text-2xl font-serif mb-1 text-[#1B3B5A]">
          {isLogin ? 'Welcome Back' : (role === 'vendor' ? 'Apply as Vendor' : 'Join UPAY')}
        </h2>
        <p className="text-slate-500 mb-4 text-xs">
          {isLogin ? 'Sign in to access your profile' : (role === 'vendor' ? 'Register your NGO/SHG for admin review' : 'Create an account to track your orders')}
        </p>

        {/* --- 3-WAY ROLE SELECTOR --- */}
        <div className="flex bg-slate-100 p-1 rounded-full mb-6 mx-2">
          {['customer', 'vendor', 'admin'].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRole(r);
                setError('');
              }}
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
        
        {/* Hide Sign Up link if Admin is selected */}
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

        {isLogin && (
          <div className="mt-4 pt-4 border-t border-slate-100">                   
          </div>
        )}
      </div>
    </div>
  )
}

function Dashboard({ user, setUser, products, setProducts, refreshProducts, categories, setCategories }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('add'); 
  const [orderView, setOrderView] = useState('pending'); // 'pending' or 'delivered'
  const [vendorView, setVendorView] = useState('pending'); // 'pending' or 'approved'
  
  const [queries, setQueries] = useState([]);
  const [orders, setOrders] = useState([]);
  const [vendorList, setVendorList] = useState([]); // Stores the fetched vendors

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

  const displayedProducts = user?.role === 'admin' 
    ? products 
    : products.filter(p => p.vendor === user?.email);

  useEffect(() => {
  if (user?.role === 'admin' || user?.role === 'vendor') {
    // Fetch Queries
    fetch('http://localhost:5001/api/queries')
      .then(res => res.json())
      .then(data => {
        if (user.role === 'admin') setQueries(data);
        else setQueries(data.filter(q => q.vendorEmail === user.email));
      });
      
    // Fetch Orders
    fetch('http://localhost:5001/api/orders')
      .then(res => res.json())
      .then(data => {
        if (user.role === 'admin') setOrders(data);
        else setOrders(data.filter(o => o.vendors && o.vendors.includes(user.email)));
      });

    // CHANGE THIS SECTION: Fetch from /api/applications instead of /api/vendors
    if (user.role === 'admin') {
      fetch('http://localhost:5001/api/applications') // Updated endpoint 
        .then(res => res.json())
        .then(data => {
          // data.vendors || data is no longer needed if the backend returns a simple array
          setVendorList(data); 
        })
        .catch(err => console.error("Error fetching vendor applications:", err));
    }
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
      const payload = { 
        ...newProduct, 
        price: Number(newProduct.price),
        vendor: user.email 
      };

      const res = await fetch('http://localhost:5001/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if(res.ok) {
        setMsg('Product added successfully!');
        setNewProduct({name: '', price: '', category: categories[0] || 'Bags', subCategory: '', img: '', description: '', vendor: user.email, deliveryDays: ''});
        document.getElementById('file-upload').value = ""; 
        refreshProducts(); 
      }
    } catch(err) { setMsg('Failed to add product.'); }
  };

  const handleDeleteProduct = async (id) => {
    if(window.confirm("Are you sure you want to permanently delete this product?")) {
      try {
        const res = await fetch(`http://localhost:5001/api/products/${id}`, {
          method: 'DELETE'
        });
        if(res.ok) {
          refreshProducts(); 
        } else {
          alert("Failed to delete from server.");
        }
      } catch (err) {
        alert("Failed to connect to server.");
      }
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === false ? true : false;
    
    setProducts(products.map(p => p.id === id ? { ...p, inStock: newStatus } : p));

    try {
      await fetch(`http://localhost:5001/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inStock: newStatus })
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
        await fetch('http://localhost:5001/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmedCat })
        });
      } catch(err) { console.error("Failed to post to backend."); }
      
      setCategories([...categories, trimmedCat]);
      setNewCategoryName('');
      setMsg(`Category "${trimmedCat}" added successfully!`);
    } else {
      setMsg('Category already exists or is invalid.');
    }
  };

  const handleDeleteCategory = async (catToDelete) => {
    if(window.confirm(`Are you sure you want to permanently delete the category "${catToDelete}"?`)) {
      try {
        await fetch(`http://localhost:5001/api/categories/${encodeURIComponent(catToDelete)}`, {
          method: 'DELETE'
        });
      } catch(err) { console.error("Failed to delete from backend."); }
      
      setCategories(categories.filter(c => c !== catToDelete));
      setMsg(`Category "${catToDelete}" deleted!`);
    }
  };

  const handleApproveVendor = async (vendorId) => {
    try {
      const response = await fetch(`http://localhost:5001/api/vendors/${vendorId}/approve`, {
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
    // Change /api/vendors to /api/applications
    const response = await fetch(`http://localhost:5001/api/applications/${vendorId}`, { 
      method: 'DELETE' 
    });
    if (response.ok) {
      setVendorList(vendorList.filter(v => v.id !== vendorId && v._id !== vendorId)); // [cite: 38]
      alert("Application Rejected!");
    }
  } catch (err) { console.error(err); }
};

  const handleUpdateOrderStatus = async (id, newStatus) => {
  setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
  try {
    await fetch(`http://localhost:5001/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
  } catch (err) { console.error("Failed to update order status"); }
};

  const handleResolveQuery = async (id) => {
    setQueries(queries.map(q => q.id === id ? { ...q, status: 'Resolved' } : q));
    try {
      await fetch(`http://localhost:5001/api/queries/${id}`, {
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
      await fetch(`http://localhost:5001/api/queries/${id}`, { method: 'DELETE' });
    } catch (err) { console.error("Failed to delete query"); }
  };

  const sortedOrders = [...orders].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="flex-grow flex items-center justify-center w-full px-6 py-2">
      <div className={`bg-white p-5 md:p-6 rounded-[2rem] shadow-sm border border-slate-100 text-center w-full ${user.role === 'admin' || user.role === 'vendor' ? 'max-w-6xl' : 'max-w-lg'}`}>
        {user.role === 'admin' || user.role === 'vendor' ? (
          <div>
            <h1 className="text-3xl md:text-4xl font-serif mb-2 text-[#1B3B5A]">{user.role === 'admin' ? 'Admin' : 'Vendor'} Dashboard</h1>
            <p className="text-xs md:text-sm font-bold tracking-widest lowercase text-slate-400 mb-6 border-b border-slate-100 pb-4">
              {user.email.toLowerCase()}
            </p>
            
            {/* --- DASHBOARD NAVIGATION BUTTONS --- */}
            <div className="flex flex-wrap justify-center gap-2 mb-5">
              <button onClick={() => {setActiveTab('add'); setMsg('');}} className={`px-4 py-2 rounded-full font-bold uppercase tracking-widest text-[9px] transition-all ${activeTab === 'add' ? 'bg-[#1B3B5A] text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'}`}>Add Product</button>
              <button onClick={() => {setActiveTab('addCategory'); setMsg('');}} className={`px-4 py-2 rounded-full font-bold uppercase tracking-widest text-[9px] transition-all ${activeTab === 'addCategory' ? 'bg-[#1B3B5A] text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'}`}>Manage Categories</button>
              <button onClick={() => {setActiveTab('inventory'); setMsg('');}} className={`px-4 py-2 rounded-full font-bold uppercase tracking-widest text-[9px] transition-all ${activeTab === 'inventory' ? 'bg-[#1B3B5A] text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'}`}>Manage Inventory</button>
              <button onClick={() => {setActiveTab('orders'); setMsg('');}} className={`px-4 py-2 rounded-full font-bold uppercase tracking-widest text-[9px] transition-all ${activeTab === 'orders' ? 'bg-[#1B3B5A] text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'}`}>Recent Orders</button>
              <button onClick={() => {setActiveTab('queries'); setMsg('');}} className={`px-4 py-2 rounded-full font-bold uppercase tracking-widest text-[9px] transition-all ${activeTab === 'queries' ? 'bg-[#1B3B5A] text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'}`}>Customer Queries</button>
              
              {/* NEW VENDOR APPROVALS BUTTON */}
              {user.role === 'admin' && (
                <button onClick={() => {setActiveTab('vendors'); setMsg('');}} className={`px-4 py-2 rounded-full font-bold uppercase tracking-widest text-[9px] transition-all ${activeTab === 'vendors' ? 'bg-[#1B3B5A] text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200'}`}>Vendor Approvals</button>
              )}
            </div>

            {/* Manage Categories Tab */}
            {activeTab === 'addCategory' && (
              <div className="bg-slate-50 p-5 md:p-6 rounded-2xl border border-slate-200 mb-4 text-left max-w-2xl mx-auto">
                <h2 className="text-xl font-serif mb-3 text-[#1B3B5A]">Manage Categories</h2>
                {msg && <p className="text-[#00AEEF] font-bold mb-3 bg-sky-50 p-2 rounded-lg border border-sky-100 text-center text-xs">{msg}</p>}
                
                <form onSubmit={handleAddCategory} className="flex gap-3 mb-4">
                  <input type="text" placeholder="New Category Name (e.g. Wallets)" required value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="flex-grow px-4 py-2 text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/30" />
                  <button type="submit" className="bg-[#F47920] text-white px-5 py-2 rounded-lg font-bold tracking-widest uppercase text-xs hover:bg-[#D96516] transition-all shadow-sm">Add</button>
                </form>

                <div>
                  <h3 className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-widest">Current Active Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(c => (
                      <div key={c} className="bg-white border border-slate-200 pl-3 pr-1 py-1 rounded-full text-xs font-bold text-[#1B3B5A] shadow-sm flex items-center gap-1">
                        <span>{c}</span>
                        <button 
                          type="button"
                          onClick={() => handleDeleteCategory(c)} 
                          className="text-slate-400 hover:text-[#E31E24] hover:bg-red-50 rounded-full w-5 h-5 flex items-center justify-center transition-colors pb-0.5"
                          title="Delete category"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Add Product Tab */}
            {activeTab === 'add' && (
              <div className="bg-slate-50 p-5 md:p-6 rounded-2xl border border-slate-200 mb-4 text-left max-w-2xl mx-auto">
                <h2 className="text-xl font-serif mb-3 text-[#1B3B5A]">Add New Product</h2>
                {msg && <p className="text-[#00AEEF] font-bold mb-3 bg-sky-50 p-2 rounded-lg border border-sky-100 text-center text-xs">{msg}</p>}
                <form onSubmit={handleAddProduct} className="grid md:grid-cols-2 gap-3">
                  <input type="text" placeholder="Product Name" required value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="px-4 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/30" />
                  <input type="number" placeholder="Price (₹)" required value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} className="px-4 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/30" />
                  
                  <select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="px-4 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/30 cursor-pointer">
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

                  <input type="text" placeholder="Sub Category" value={newProduct.subCategory} onChange={e => setNewProduct({...newProduct, subCategory: e.target.value})} className="px-4 py-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/30" />
                  
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 pl-1">Product Image Upload</label>
                    <input 
                      type="file" 
                      id="file-upload"
                      accept="image/*"
                      onChange={handleImageUpload} 
                      className="w-full px-4 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/30 file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-[#F47920]/10 file:text-[#F47920] hover:file:bg-[#F47920]/20 cursor-pointer" 
                    />
                  </div>

                  <input type="text" placeholder="Expected Delivery (e.g., 3-5 working days)" required value={newProduct.deliveryDays} onChange={e => setNewProduct({...newProduct, deliveryDays: e.target.value})} className="px-4 py-2 text-xs rounded-lg border border-slate-200 bg-white md:col-span-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/30" />

                  <textarea placeholder="Product Description" required value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} className="px-4 py-2 text-xs rounded-lg border border-slate-200 bg-white md:col-span-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#F47920]/30" rows="2"></textarea>
                  
                  <button type="submit" className="md:col-span-2 mt-1 bg-[#F47920] text-white py-2 rounded-lg font-bold tracking-widest uppercase text-[10px] hover:bg-[#D96516] transition-all shadow-sm">Upload to Website</button>
                </form>
              </div>
            )}

            {/* Inventory Tab */}
            {activeTab === 'inventory' && (
              <div className="bg-white rounded-2xl border border-slate-200 mb-4 text-left overflow-x-auto shadow-sm">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-widest text-[9px]">
                      <th className="p-3 font-bold">Product</th><th className="p-3 font-bold">Category</th><th className="p-3 font-bold">Price</th><th className="p-3 font-bold">Vendor</th><th className="p-3 font-bold">Status</th><th className="p-3 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedProducts.length === 0 ? (
                      <tr><td colSpan="6" className="p-6 text-center text-slate-400 font-serif text-sm">No products found in your inventory.</td></tr>
                    ) : displayedProducts.map(p => (
                      <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="p-2 flex items-center gap-3">
                          <img src={p.img || 'https://via.placeholder.com/50'} alt={p.name} className="w-8 h-8 object-cover rounded-lg border border-slate-200" />
                          <span className="font-serif text-sm text-[#1B3B5A]">{p.name}</span>
                        </td>
                        <td className="p-2 text-xs text-slate-500">{p.category || 'N/A'}</td>
                        <td className="p-2 font-bold text-[#F47920] text-xs">₹{p.price}</td>
                        <td className="p-2 text-xs text-slate-400 lowercase">{p.vendor || 'admin@upay.com'}</td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded-full text-[8px] uppercase font-bold tracking-widest border ${p.inStock !== false ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-[#E31E24] border-red-200'}`}>
                            {p.inStock !== false ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </td>
                        <td className="p-2">
                           <div className="flex justify-end gap-1.5">
                             <button 
                               onClick={() => handleToggleStatus(p.id, p.inStock)} 
                               className={`font-bold uppercase tracking-widest text-[8px] border px-2 py-1 rounded transition-all ${p.inStock !== false ? 'bg-white border-red-200 text-[#E31E24] hover:bg-red-50' : 'bg-white border-sky-200 text-[#00AEEF] hover:bg-sky-50'}`}
                             >
                               {p.inStock !== false ? 'Mark Out' : 'Mark In'}
                             </button>
                             <button 
                               onClick={() => handleDeleteProduct(p.id)} 
                               className="text-white bg-red-500 hover:bg-red-600 font-bold uppercase tracking-widest text-[8px] px-2 py-1 rounded shadow-sm transition-all"
                             >
                               Delete
                             </button>
                           </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div className="flex flex-col space-y-4 mb-4 text-left">
                <div className="flex space-x-6 border-b border-slate-200 px-2">
                  <button onClick={() => setOrderView('pending')} className={`pb-3 text-sm font-bold tracking-wide transition-all ${orderView === 'pending' ? 'text-[#1B3B5A] border-b-2 border-[#1B3B5A]' : 'text-slate-400 hover:text-slate-600'}`}>
                    Pending Orders
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${orderView === 'pending' ? 'bg-orange-100 text-[#F47920]' : 'bg-slate-100 text-slate-500'}`}>
                      {sortedOrders.filter(o => o.status !== 'Delivered').length}
                    </span>
                  </button>
                  <button onClick={() => setOrderView('delivered')} className={`pb-3 text-sm font-bold tracking-wide transition-all ${orderView === 'delivered' ? 'text-[#1B3B5A] border-b-2 border-[#1B3B5A]' : 'text-slate-400 hover:text-slate-600'}`}>
                    Delivered Orders
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${orderView === 'delivered' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                      {sortedOrders.filter(o => o.status === 'Delivered').length}
                    </span>
                  </button>
                </div>

                {orderView === 'pending' && (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-sm mt-4 animate-fadeIn">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-widest text-[9px]">
                          <th className="p-3 font-bold">Order #</th><th className="p-3 font-bold">Date</th><th className="p-3 font-bold">Customer Email</th><th className="p-3 font-bold">Items</th><th className="p-3 font-bold">Total</th><th className="p-3 font-bold">Payment</th><th className="p-3 font-bold text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedOrders.filter(o => o.status !== 'Delivered').length === 0 ? (
                          <tr><td colSpan="7" className="p-6 text-center text-slate-400 font-serif text-sm">No pending orders.</td></tr>
                        ) : sortedOrders.filter(o => o.status !== 'Delivered').map(o => (
                          <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-xs font-bold text-slate-400">#{o.id}</td>
                            <td className="p-3 text-xs text-slate-500">{o.date}</td>
                            <td className="p-3 text-xs text-[#1B3B5A] font-medium lowercase">{o.customer}</td>
                            <td className="p-3 text-[10px] text-slate-500 max-w-[150px] truncate leading-relaxed">{o.items}</td>
                            <td className="p-3 font-bold text-[#1B3B5A] text-xs">₹{o.total}</td>
                            <td className="p-3 text-[10px] font-bold text-[#F47920] uppercase tracking-widest">{o.paymentMethod || 'COD'}</td>
                            <td className="p-3 text-center">
                              <select
                                value={o.status || 'Pending'}
                                onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)}
                                className="text-[9px] font-bold px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#F47920]/50"
                              >
                                <option value="Pending">Pending</option>
                                <option value="Packed">Packed</option>
                                <option value="Shipped">Shipped</option>
                                <option value="Delivered">Delivered</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {orderView === 'delivered' && (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-sm mt-4 animate-fadeIn">
                    <table className="w-full text-left border-collapse min-w-[700px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-widest text-[9px]">
                          <th className="p-3 font-bold">Order #</th><th className="p-3 font-bold">Date</th><th className="p-3 font-bold">Customer Email</th><th className="p-3 font-bold">Items</th><th className="p-3 font-bold">Total</th><th className="p-3 font-bold">Payment</th><th className="p-3 font-bold text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedOrders.filter(o => o.status === 'Delivered').length === 0 ? (
                          <tr><td colSpan="7" className="p-6 text-center text-slate-400 font-serif text-sm">No delivered orders yet.</td></tr>
                        ) : sortedOrders.filter(o => o.status === 'Delivered').map(o => (
                          <tr key={o.id} className="border-b border-slate-100 bg-slate-50/30 opacity-80">
                            <td className="p-3 text-xs font-bold text-slate-400">#{o.id}</td>
                            <td className="p-3 text-xs text-slate-500">{o.date}</td>
                            <td className="p-3 text-xs text-slate-500 font-medium lowercase">{o.customer}</td>
                            <td className="p-3 text-[10px] text-slate-400 max-w-[150px] truncate leading-relaxed">{o.items}</td>
                            <td className="p-3 font-bold text-slate-500 text-xs">₹{o.total}</td>
                            <td className="p-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{o.paymentMethod || 'COD'}</td>
                            <td className="p-3 text-center">
                              <button disabled className="px-2 py-1.5 rounded-full text-[8px] uppercase font-bold tracking-widest border transition-all shadow-sm bg-emerald-50 text-emerald-600 border-emerald-200 cursor-default">
                                Delivered
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Queries Tab */}
            {activeTab === 'queries' && (
              <div className="grid md:grid-cols-2 gap-4 text-left">
                {queries.length > 0 ? queries.map(q => (
                  <div key={q.id} className={`p-5 rounded-2xl border shadow-sm transition-all relative ${q.status === 'Resolved' ? 'bg-slate-50/50 border-slate-200 opacity-80' : 'bg-white border-slate-200 hover:shadow-md'}`}>
                    <div className="absolute top-4 right-4 flex gap-2">
                      {q.status !== 'Resolved' && (
                        <button onClick={() => handleResolveQuery(q.id)} className="text-[9px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-1 rounded hover:bg-emerald-100 transition-colors shadow-sm">
                          Resolve
                        </button>
                      )}
                      <button onClick={() => handleDeleteQuery(q.id)} className="text-[9px] font-bold uppercase tracking-widest bg-red-50 text-[#E31E24] border border-red-200 px-2 py-1 rounded hover:bg-red-100 transition-colors shadow-sm">
                        Delete
                      </button>
                    </div>

                    <div className="flex items-center gap-2 mb-1 pr-24">
                      <p className="font-serif text-lg text-[#1B3B5A] truncate">{q.subject}</p>
                      {q.status === 'Resolved' && (
                        <span className="bg-emerald-100 text-emerald-700 text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm">Resolved</span>
                      )}
                    </div>
                    
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">{q.name} • <span className="lowercase">{q.email}</span></p>
                    {user.role === 'admin' && q.vendorEmail && (
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#F47920] mb-2">Targeted to: <span className="lowercase">{q.vendorEmail}</span></p>
                    )}
                    <p className={`text-xs leading-relaxed p-3 rounded-lg border ${q.status === 'Resolved' ? 'text-slate-500 bg-transparent border-transparent px-0' : 'text-slate-600 bg-slate-50 border-slate-100'}`}>
                      {q.message}
                    </p>
                  </div>
                )) : <div className="col-span-2 text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400 font-serif text-sm">No customer queries currently.</div>}
              </div>
            )}

            {/* --- NEW VENDOR APPROVALS TAB SECTION --- */}
            {activeTab === 'vendors' && user.role === 'admin' && (
              <div className="flex flex-col space-y-4 mb-4 text-left animate-fadeIn">
                <div className="flex space-x-6 border-b border-slate-200 px-2">
                  <button onClick={() => setVendorView('pending')} className={`pb-3 text-sm font-bold tracking-wide transition-all ${vendorView === 'pending' ? 'text-[#1B3B5A] border-b-2 border-[#1B3B5A]' : 'text-slate-400 hover:text-slate-600'}`}>
                    Pending Applications
                  </button>
                  <button onClick={() => setVendorView('approved')} className={`pb-3 text-sm font-bold tracking-wide transition-all ${vendorView === 'approved' ? 'text-[#1B3B5A] border-b-2 border-[#1B3B5A]' : 'text-slate-400 hover:text-slate-600'}`}>
                    Approved Vendors
                  </button>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-sm mt-4">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-widest text-[9px]">
                        <th className="p-3 font-bold">Organization / Name</th>
                        <th className="p-3 font-bold">Email</th>
                        <th className="p-3 font-bold">Phone</th>
                        <th className="p-3 font-bold text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendorList.filter(v => (vendorView === 'pending' ? v.status === 'Pending' || !v.status : v.status === 'Approved')).length === 0 ? (
                        <tr><td colSpan="4" className="p-6 text-center text-slate-400 font-serif text-sm">No {vendorView} applications found.</td></tr>
                      ) : vendorList.filter(v => (vendorView === 'pending' ? v.status === 'Pending' || !v.status : v.status === 'Approved')).map(v => (
                        <tr key={v._id || v.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="p-3 text-xs font-bold text-[#1B3B5A]">{v.name}</td>
                          <td className="p-3 text-xs text-slate-500">{v.email}</td>
                          <td className="p-3 text-xs text-slate-500">{v.phone}</td>
                          <td className="p-3 text-center space-x-2">
                            {vendorView === 'pending' && (
                              <>
                                <button onClick={() => handleApproveVendor(v._id || v.id)} className="px-3 py-1.5 rounded-full text-[9px] uppercase font-bold tracking-widest border transition-all shadow-sm bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100">Approve</button>
                                <button onClick={() => handleRejectVendor(v._id || v.id)} className="px-3 py-1.5 rounded-full text-[9px] uppercase font-bold tracking-widest border transition-all shadow-sm bg-red-50 text-red-600 border-red-200 hover:bg-red-100">Reject</button>
                              </>
                            )}
                            {vendorView === 'approved' && (
                              <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">Approved</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <h1 className="text-3xl md:text-4xl font-serif mb-2 text-[#1B3B5A]">Customer Profile</h1>
            <p className="text-xs md:text-sm font-bold tracking-widest lowercase text-slate-400 mb-6 border-b border-slate-100 w-full pb-4">
              {user.email.toLowerCase()}
            </p>
            <div className="w-12 h-12 bg-[#00AEEF] rounded-full flex items-center justify-center mb-3 text-white text-xl shadow-md ring-4 ring-sky-50 mt-2">✓</div>
            <h2 className="text-2xl font-serif mb-2 text-[#1B3B5A]">Welcome, {user.name || 'Friend'}!</h2>
            <p className="text-xs text-slate-500 mb-5 max-w-sm mx-auto leading-relaxed">
              Thank you for being part of the UPAY community. Every purchase you make directly supports rural artisans and educates underprivileged children.
            </p>
            <Link to="/" className="bg-[#1B3B5A] text-white px-6 py-2.5 rounded-full font-bold uppercase tracking-widest text-[10px] hover:bg-[#F47920] transition-all shadow-sm">
              Return to Store
            </Link>
          </div>
        )}
        
        <button onClick={() => { setUser(null); navigate('/') }} className="mt-5 text-[#E31E24] font-bold uppercase tracking-widest text-[9px] hover:bg-red-50 border border-transparent hover:border-red-100 px-4 py-1.5 rounded-full transition-all">Logout Account</button>
      </div>
    </div>
  )
}

function FaqPage() {
  const [vendorView, setVendorView] = useState('pending'); // 'pending' or 'approved'
  const [vendorList, setVendorList] = useState([]);
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
      const res = await fetch(`http://localhost:5001/api/orders/${orderId.trim()}`);
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
      
      {/* PAGE HEADER */}
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

      {/* ERROR */}
      {error && (
        <div className="bg-red-50 border border-red-100 text-red-500 text-sm px-4 py-3 rounded-2xl mb-6 flex items-center gap-2">
          ⚠️ {error}
        </div>
      )}

      {/* ORDER RESULT */}
      {order && (
        <div className="bg-white border border-slate-100 rounded-[2rem] shadow-md p-6 md:p-8">

          {/* ORDER HEADER */}
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

          {/* PROGRESS TRACKER */}
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

          {/* STATUS BADGE */}
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

          {/* ORDER ITEMS */}
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

              {/* TOTAL */}
              {order.total > 0 && (
                <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-2">
                  <span className="font-bold text-slate-700 uppercase tracking-widest text-[10px]">Order Total</span>
                  <span className="font-bold text-[#F47920] text-xl font-serif">₹{order.total}</span>
                </div>
              )}
            </div>
          </div>

          {/* HELP TEXT */}
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