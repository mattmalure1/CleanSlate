import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-brand-900 text-white mt-auto">
      <div className="max-w-5xl mx-auto px-[var(--spacing-page)] py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <img src="/logo-icon.jpg" alt="CleanSlate" className="h-9 w-auto rounded-lg" />
              <span className="font-display font-bold text-lg tracking-tight">CleanSlate</span>
            </div>
            <p className="text-brand-300 text-sm leading-relaxed">
              Turn your used media into cash
            </p>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-display font-semibold text-sm uppercase tracking-wider mb-4">Company</h3>
            <ul className="space-y-3">
              <li><Link to="/" className="text-brand-300 hover:text-white text-sm min-h-[44px] flex items-center">Home</Link></li>
              <li><Link to="/conditions" className="text-brand-300 hover:text-white text-sm min-h-[44px] flex items-center">What We Accept</Link></li>
              <li><Link to="/bulk" className="text-brand-300 hover:text-white text-sm min-h-[44px] flex items-center">Bulk Sell</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-display font-semibold text-sm uppercase tracking-wider mb-4">Support</h3>
            <ul className="space-y-3">
              <li><Link to="/track" className="text-brand-300 hover:text-white text-sm min-h-[44px] flex items-center">Track Your Order</Link></li>
              <li>
                <a href="mailto:support@cleanslatemedia.com" className="text-brand-300 hover:text-white text-sm min-h-[44px] flex items-center gap-1.5">
                  <Mail size={14} /> Contact Us
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-display font-semibold text-sm uppercase tracking-wider mb-4">Legal</h3>
            <ul className="space-y-3">
              <li><Link to="/privacy" className="text-brand-300 hover:text-white text-sm min-h-[44px] flex items-center">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-brand-300 hover:text-white text-sm min-h-[44px] flex items-center">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-brand-800">
        <div className="max-w-5xl mx-auto px-[var(--spacing-page)] py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-brand-300 text-xs">&copy; 2026 CleanSlate Media. All rights reserved.</p>
          <a href="mailto:support@cleanslatemedia.com" className="text-brand-300 hover:text-white text-xs flex items-center gap-1.5">
            <Mail size={12} /> support@cleanslatemedia.com
          </a>
        </div>
      </div>
    </footer>
  );
}
