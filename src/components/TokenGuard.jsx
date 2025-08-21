import React, { useState, useEffect } from 'react';

const TokenGuard = ({ children }) => {
  const [status, setStatus] = useState('checking');
  const [verificationResult, setVerificationResult] = useState(null);
  const [lastCheck, setLastCheck] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    checkToken();
    setupListeners();
    
    const interval = setInterval(checkTokenInBackground, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkToken = async () => {
    if (isInitialLoad) {
      setStatus('checking');
    }
    
    while (!window.electronAPI) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      const result = await window.electronAPI.verifyToken();
      
      setVerificationResult(result);
      setLastCheck(new Date());
      setStatus(result.success ? 'valid' : 'invalid');
      
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
      
    } catch (error) {
      // فقط خطاهای مهم لاگ میشن
      console.error('Token verification failed:', error.message);
      setStatus('invalid');
      setLastCheck(new Date());
      
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    }
  };

  const checkTokenInBackground = async () => {
    if (!window.electronAPI) return;

    try {
      const result = await window.electronAPI.verifyToken();
      
      setVerificationResult(result);
      setLastCheck(new Date());
      
      const newStatus = result.success ? 'valid' : 'invalid';
      if (newStatus !== status) {
        setStatus(newStatus);
        
        // فقط تغییر وضعیت لاگ میشه
        if (newStatus === 'invalid') {
          console.warn('Token access revoked');
        } else {
          console.log('Token access restored');
        }
      }
      
    } catch (error) {
      console.error('Background token check failed:', error.message);
      if (status === 'valid') {
        setStatus('invalid');
        setLastCheck(new Date());
      }
    }
  };

  const setupListeners = () => {
    if (!window.electronAPI) return;

    const cleanup = window.electronAPI.onTokenVerificationResult((event, result) => {
      setVerificationResult(result);
      setLastCheck(new Date());
      
      const newStatus = result.success ? 'valid' : 'invalid';
      if (newStatus !== status) {
        setStatus(newStatus);
      }
    });

    return cleanup;
  };

  const manualRefresh = async () => {
    setStatus('checking');
    await checkToken();
  };

  if (status === 'checking' && isInitialLoad) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center p-8">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-800 mb-2">بررسی امنیت</h1>
          <p className="text-gray-600 mb-6">در حال تایید توکن سخت‌افزاری...</p>
          
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md w-full">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 15c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">دسترسی غیرمجاز</h2>
          <p className="text-gray-600 mb-6">
            توکن سخت‌افزاری معتبر نیست یا متصل نمی‌باشد.
          </p>

          {verificationResult && (
            <div className="mb-6 p-4 bg-red-50 rounded-lg text-left">
              <p className="text-sm text-red-700 font-medium mb-2">خطا:</p>
              <p className="text-sm text-red-600">{verificationResult.message}</p>
            </div>
          )}

          <button
            onClick={manualRefresh}
            disabled={status === 'checking'}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-all duration-200 font-medium"
          >
            {status === 'checking' ? (
              <div className="flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                در حال بررسی...
              </div>
            ) : (
              'تلاش مجدد'
            )}
          </button>

          {lastCheck && (
            <p className="text-gray-400 text-sm mt-4">
              آخرین بررسی: {lastCheck.toLocaleTimeString('fa-IR')}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-gradient-to-r from-green-100 to-emerald-100 border-b border-green-200 px-4 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-green-800 font-medium">توکن معتبر</span>
          </div>
          
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            {status === 'checking' && !isInitialLoad && (
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <div className="w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-green-700 text-sm">بررسی...</span>
              </div>
            )}
            
            <button
              onClick={manualRefresh}
              disabled={status === 'checking'}
              className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:bg-green-400 transition-colors"
            >
              بررسی
            </button>
            
            {lastCheck && (
              <span className="text-green-700 text-sm">
                {lastCheck.toLocaleTimeString('fa-IR')}
              </span>
            )}
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