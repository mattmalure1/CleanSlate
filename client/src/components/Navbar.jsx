import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, BookOpen, Layers, User, LogOut, ChevronDown } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { itemCount } = useCart();
  const { user, customer, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    navigate('/');
  }

  return (
    <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-border/60 shadow-sm shadow-black/[0.03]">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-[var(--spacing-page)] h-16">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <img src="/logo-icon.jpg" alt="CleanSlate" className="h-9 w-auto rounded-lg" />
          <div className="flex flex-col justify-center">
            <span className="font-display font-bold text-lg text-brand-800 tracking-tight leading-none group-hover:text-brand-600">
              CleanSlate
            </span>
            <span className="hidden sm:block text-[10px] text-text-muted leading-tight mt-0.5 tracking-wide uppercase">
              Media Buyback
            </span>
          </div>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          <Link
            to="/bulk"
            className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-brand-700 min-h-[44px] px-3 rounded-lg hover:bg-brand-50 cursor-pointer"
          >
            <Layers size={16} />
            Bulk Sell
          </Link>

          <Link
            to="/conditions"
            className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-brand-700 min-h-[44px] px-3 rounded-lg hover:bg-brand-50 cursor-pointer"
          >
            <BookOpen size={16} />
            What We Accept
          </Link>

          {/* Cart */}
          {itemCount > 0 ? (
            <Link
              to="/checkout"
              className="relative flex items-center justify-center min-w-[44px] min-h-[44px] text-brand-700 hover:bg-brand-50 rounded-lg cursor-pointer"
              aria-label={`Cart with ${itemCount} items`}
            >
              <ShoppingCart size={22} />
              <span className="absolute -top-0.5 -right-0.5 bg-brand-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ring-2 ring-white">
                {itemCount}
              </span>
            </Link>
          ) : (
            <div className="relative flex items-center justify-center min-w-[44px] min-h-[44px] text-text-muted">
              <ShoppingCart size={22} />
            </div>
          )}

          {/* Auth: Login button or User menu */}
          {!authLoading && (
            user ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-brand-700 min-h-[44px] px-3 rounded-lg hover:bg-brand-50"
                >
                  <div className="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">
                    {(customer?.name || user.email)?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="hidden sm:inline max-w-[100px] truncate">
                    {customer?.name?.split(' ')[0] || 'Account'}
                  </span>
                  <ChevronDown size={14} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-[var(--radius-lg)] border border-border shadow-lg py-1 z-50">
                    <Link
                      to="/account"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-primary hover:bg-brand-50 min-h-[40px]"
                    >
                      <User size={16} className="text-text-muted" />
                      My Account
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-reject hover:bg-reject-light min-h-[40px]"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 min-h-[44px] px-3 rounded-lg hover:bg-brand-50"
              >
                <User size={18} />
                <span className="hidden sm:inline">Sign In</span>
              </Link>
            )
          )}
        </div>
      </div>
    </nav>
  );
}
