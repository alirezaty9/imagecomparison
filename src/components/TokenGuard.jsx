import React, { useState, useEffect } from 'react';

const TokenGuard = ({ children }) => {
  const [status, setStatus] = useState('checking'); // 'checking' | 'granted' | 'denied'

  useEffect(() => {
    checkToken();
    setupListeners();
  }, []);

  const checkToken = async () => {
    setStatus('checking');
    
    // صبر تا API آماده بشه
    while (!window.electronAPI) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // حداقل 1.5 ثانیه loading (تا کاربر ببینه)
    const startTime = Date.now();

    try {
      // اول چک کن
      let result = await window.electronAPI.checkHardwareToken(0x096e, 0x0703);
      
      // اگه نبود، add کن
      if (!result.connected) {
        await window.electronAPI.requestTokenAccess(0x096e, 0x0703);
        result = await window.electronAPI.checkHardwareToken(0x096e, 0x0703);
      }

      // حداقل 1.5 ثانیه loading
      const elapsed = Date.now() - startTime;
      if (elapsed < 1500) {
        await new Promise(resolve => setTimeout(resolve, 1500 - elapsed));
      }

      // نتیجه
      setStatus(result.connected ? 'granted' : 'denied');
    } catch {
      const elapsed = Date.now() - startTime;
      if (elapsed < 1500) {
        await new Promise(resolve => setTimeout(resolve, 1500 - elapsed));
      }
      setStatus('denied');
    }
  };

  const setupListeners = () => {
    if (!window.electronAPI) return;

    window.electronAPI.onTokenConnected(() => {
      console.log('🔌 Token connected - Access granted');
      setStatus('granted');
    });

    window.electronAPI.onTokenDisconnected(() => {
      console.log('🔌 Token disconnected - Access revoked');
      setStatus('denied');
    });
  };

  // Loading Screen - بهتر و جذاب‌تر
  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center p-8">
          {/* Logo/Icon */}
          <div className="mb-8">
            <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">سیستم امنیتی</h1>
          </div>

          {/* Loading Animation */}
          <div className="mb-6">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <div className="flex justify-center space-x-1 rtl:space-x-reverse mb-4">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
          </div>

          {/* Status Text */}
          <div className="space-y-2">
            <p className="text-xl font-semibold text-gray-700">در حال بررسی توکن امنیتی</p>
            <p className="text-gray-500">لطفاً کمی صبر کنید...</p>
          </div>

          {/* Progress Bar */}
          <div className="mt-6 w-64 h-2 bg-gray-200 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  // Access Denied - بهتر و واضح‌تر
  if (status === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md w-full">
          {/* Error Icon */}
          <div className="mb-6">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 15c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>

          {/* Content */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">🔒 دسترسی محدود</h2>
            <p className="text-gray-600 leading-relaxed">
              برای استفاده از این سیستم، توکن امنیتی باید متصل باشد.
            </p>
          </div>

          {/* Action Button */}
          <button
            onClick={checkToken}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:scale-105"
          >
            🔄 بررسی مجدد
          </button>

          {/* Help Text */}
          <p className="text-gray-400 text-sm mt-4">
            توکن سخت‌افزاری را به کامپیوتر وصل کنید
          </p>
        </div>
      </div>
    );
  }

  // Access Granted - نوار وضعیت بهتر
  return (
    <>
      <div className="bg-gradient-to-r from-green-100 to-emerald-100 border-b border-green-200 px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-green-800 font-medium">دسترسی امن فعال</span>
          </div>
          <div className="text-green-700 text-sm">
            🔐 محافظت شده
          </div>
        </div>
      </div>
      <div className="min-h-screen bg-gray-50">
        {children}
      </div>
    </>
  );
};

export default TokenGuard;