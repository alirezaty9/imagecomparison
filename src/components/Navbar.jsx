import React, { useState } from "react";
import { NavLink } from "react-router-dom";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const navItems = [
    {
      path: "/",
      icon: "🔍",
      label: "جستجوی تصاویر",
      description: "یافتن تصاویر مشابه"
    },
    {
      path: "/compare",
      icon: "⚖️",
      label: "مقایسه تصاویر",
      description: "مقایسه دو تصویر"
    },
    {
      path: "/about",
      icon: "⚙️",
      label: "تنظیمات",
      description: "اطلاعات و تنظیمات"
    }
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg border-b border-white/5">
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-gray-900/95 to-slate-950/95"></div>
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Enhanced Logo Section */}
          <div className="flex items-center gap-4 animate-fade-in">
            <div className="relative group cursor-pointer">
              <div className="absolute -inset-2 bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-purple-500/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
              <div className="relative w-14 h-14 bg-gradient-to-br from-blue-600 via-cyan-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl border border-white/10 group-hover:scale-105 transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-2xl"></div>
                <div className="relative">
                  <span className="text-white font-black text-xl drop-shadow-2xl tracking-tight">IS</span>
                  <div className="absolute -inset-1 bg-white/20 rounded blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
              </div>
            </div>
            <div className="hidden md:block space-y-1">
              <h1 className="text-xl font-black bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent leading-tight">
                جستجوگر تصاویر هوشمند
              </h1>
              <p className="text-xs text-slate-400/80 font-medium tracking-wide uppercase">
                AI-Powered Image Search
              </p>
            </div>
          </div>

          {/* Enhanced Desktop Menu */}
          <div className="hidden md:flex items-center space-x-3 space-x-reverse">
            {navItems.map((item, index) => (
              <NavLink
                key={item.path}
                to={item.path}
                className="group relative flex items-center gap-3 px-5 py-3 rounded-2xl transition-all duration-500 text-slate-300 hover:text-white overflow-hidden border border-slate-700/30 hover:border-blue-500/50 backdrop-blur-sm"
                style={{ 
                  animationDelay: `${index * 100}ms`,
                  animation: 'slideInFromRight 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards'
                }}
              >
                {/* Background Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/10 to-purple-600/0 opacity-0 group-hover:opacity-100 transition-all duration-500 scale-x-0 group-hover:scale-x-100"></div>
                
                {/* Shimmer Effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
                </div>
                
                <span className="relative z-10 text-2xl group-hover:scale-110 transition-all duration-300 drop-shadow-lg filter group-hover:drop-shadow-2xl">
                  {item.icon}
                </span>
                <div className="relative z-10 flex flex-col min-w-0">
                  <span className="font-bold text-sm leading-tight group-hover:text-blue-200 transition-colors duration-300">
                    {item.label}
                  </span>
                  <span className="text-xs opacity-60 leading-tight group-hover:opacity-90 transition-all duration-300 text-slate-400 group-hover:text-slate-300">
                    {item.description}
                  </span>
                </div>
                
                {/* Active Indicator */}
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-purple-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 rounded-full"></div>
                
                {/* Corner Accent */}
                <div className="absolute top-1 right-1 w-2 h-2 bg-gradient-to-br from-blue-400 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </NavLink>
            ))}
          </div>

          {/* Enhanced Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={toggleMenu}
              className="relative inline-flex items-center justify-center p-4 rounded-2xl text-slate-400 hover:text-white focus:outline-none transition-all duration-300 border border-slate-700/30 hover:border-blue-500/50 backdrop-blur-sm group overflow-hidden"
            >
              {/* Background Glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-2xl"></div>
              
              <span className="sr-only">باز کردن منو</span>
              <div className="relative w-7 h-7">
                <div className={`absolute inset-0 transition-all duration-500 ease-out ${
                  isMenuOpen ? 'rotate-180 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
                }`}>
                  <svg className="w-7 h-7 group-hover:scale-110 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </div>
                <div className={`absolute inset-0 transition-all duration-500 ease-out ${
                  isMenuOpen ? 'rotate-0 scale-100 opacity-100' : 'rotate-180 scale-0 opacity-0'
                }`}>
                  <svg className="w-7 h-7 group-hover:scale-110 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Mobile Menu */}
      <div className={`md:hidden transition-all duration-700 ease-out ${
        isMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
      }`}>
        <div className="relative px-4 pt-4 pb-6 space-y-3 bg-gradient-to-b from-slate-900/98 to-slate-950/98 border-t border-blue-500/30 backdrop-blur-xl">
          {/* Mobile Menu Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5"></div>
          {navItems.map((item, index) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsMenuOpen(false)}
              className="group relative flex items-center gap-4 px-5 py-4 rounded-2xl text-base font-medium transition-all duration-500 text-slate-300 hover:text-white border border-slate-700/30 hover:border-blue-500/50 overflow-hidden backdrop-blur-sm"
              style={{ 
                animationDelay: `${index * 150}ms`,
                animation: isMenuOpen ? 'slideUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'none',
                opacity: isMenuOpen ? 1 : 0,
                transform: isMenuOpen ? 'translateY(0)' : 'translateY(20px)'
              }}
            >
              {/* Enhanced Mobile Background */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/10 to-purple-600/0 opacity-0 group-hover:opacity-100 transition-all duration-500 scale-x-0 group-hover:scale-x-100"></div>
              
              {/* Mobile Shimmer */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>
              </div>
              
              <span className="relative z-10 text-2xl group-hover:scale-110 transition-all duration-300 drop-shadow-lg">
                {item.icon}
              </span>
              <div className="relative z-10 flex-1 space-y-1">
                <div className="font-bold text-white group-hover:text-blue-200 transition-colors duration-300">
                  {item.label}
                </div>
                <div className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors duration-300">
                  {item.description}
                </div>
              </div>
              
              {/* Enhanced Arrow Indicator */}
              <div className="relative z-10 transform transition-all duration-500 translate-x-3 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 group-hover:scale-110">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              
              {/* Mobile Active Indicator */}
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-purple-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 rounded-full"></div>
            </NavLink>
          ))}
        </div>
        
        {/* Enhanced Bottom Accent */}
        <div className="relative h-2 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/60 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 via-cyan-400/40 to-purple-500/30 animate-shimmer"></div>
        </div>
      </div>
    </nav>
  );
}