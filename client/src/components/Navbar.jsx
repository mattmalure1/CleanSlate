import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, BookOpen, HelpCircle, Layers } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function Navbar() {
  const { itemCount } = useCart();
  const navigate = useNavigate();

  function handleHowItWorks(e) {
    e.preventDefault();
    const section = document.getElementById('how-it-works');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/');
      setTimeout(() => {
        document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
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
        </div>
      </div>
    </nav>
  );
}
