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
    <nav className="bg-white shadow-lg border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo/Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">IS</span>
            </div>
            <div className="hidden md:block">
              <h1 className="text-lg font-bold text-gray-800">جستجوگر تصاویر</h1>
              <p className="text-xs text-gray-500">Image Search Tool</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6 space-x-reverse">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
                  }`
                }
              >
                <span className="text-lg">{item.icon}</span>
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{item.label}</span>
                  <span className="text-xs opacity-75">{item.description}</span>
                </div>
              </NavLink>
            ))}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={toggleMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              <span className="sr-only">باز کردن منو</span>
              {!isMenuOpen ? (
                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      <div className={`md:hidden transition-all duration-300 ease-in-out ${
        isMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
      }`}>
        <div className="px-2 pt-2 pb-3 space-y-1 bg-gray-50 border-t border-gray-200">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-md text-base font-medium transition-colors duration-200 ${
                  isActive
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-700 hover:text-blue-600 hover:bg-white'
                }`
              }
            >
              <span className="text-xl">{item.icon}</span>
              <div>
                <div className="font-medium">{item.label}</div>
                <div className="text-sm opacity-75">{item.description}</div>
              </div>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}