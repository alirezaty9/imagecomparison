import React, { useState, useEffect, useCallback } from 'react';

const TokenGuard = ({ children }) => {
  const [status, setStatus] = useState('checking'); // 'checking' | 'granted' | 'denied' | 'error'
  const [tokenInfo, setTokenInfo] = useState(null);
  const [error, setError] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastVerification, setLastVerification] = useState(null);

  // Enhanced token verification with better error handling
  const verifyToken = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setStatus('checking');
      setError(null);
    }
    
    // Wait for API to be ready
    while (!window.electronAPI) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Minimum loading time for better UX
    const startTime = Date.now();
    
    try {
      // First check token status
      const statusResult = await window.electronAPI.checkTokenStatus();
      
      if (statusResult.success && statusResult.data) {
        setTokenInfo(statusResult.data);
        
        // If we have a recent successful verification, use it
        if (statusResult.data.lastVerification && 
            statusResult.data.lastVerification.success &&
            isRecentVerification(statusResult.data.lastVerification.timestamp)) {
          
          const elapsed = Date.now() - startTime;
          if (elapsed < 1500 && showLoading) {
            await new Promise(resolve => setTimeout(resolve, 1500 - elapsed));
          }
          
          setLastVerification(statusResult.data.lastVerification);
          setStatus('granted');
          return;
        }
      }

      // Perform new verification
      const verifyResult = await window.electronAPI.verifyToken({});
      
      // Minimum loading time
      const elapsed = Date.now() - startTime;
      if (elapsed < 1500 && showLoading) {
        await new Promise(resolve => setTimeout(resolve, 1500 - elapsed));
      }

      if (verifyResult.success) {
        setLastVerification(verifyResult);
        setTokenInfo(prev => ({ ...prev, lastVerification: verifyResult }));
        setStatus('granted');
        setRetryCount(0);
      } else {
        setError(verifyResult.message || 'تایید توکن ناموفق بود');
        setStatus('denied');
      }

    } catch (err) {
      const elapsed = Date.now() - startTime;
      if (elapsed < 1500 && showLoading) {
        await new Promise(resolve => setTimeout(resolve, 1500 - elapsed));
      }
      
      setError(err.message || 'خطا در تایید توکن');
      setStatus('error');
    }
  }, []);

  // Check if verification is recent (within last 10 minutes)
  const isRecentVerification = (timestamp) => {
    if (!timestamp) return false;
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    return new Date(timestamp) > tenMinutesAgo;
  };

  // Retry with exponential backoff
  const retryVerification = useCallback(async () => {
    setIsRetrying(true);
    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);
    
    // Exponential backoff: 2^n seconds, max 30 seconds
    const delay = Math.min(Math.pow(2, newRetryCount) * 1000, 30000);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    await verifyToken();
    setIsRetrying(false);
  }, [retryCount, verifyToken]);

  // Setup event listeners and initial verification
  useEffect(() => {
    let cleanup = [];

    const setupListeners = () => {
      if (!window.electronAPI) return;

      // Token verification result listener
      const removeVerificationListener = window.electronAPI.onTokenVerificationResult((event, result) => {
        console.log('🔐 Token verification result:', result);
        setLastVerification(result);
        
        if (result.success) {
          setStatus('granted');
          setError(null);
          setRetryCount(0);
        } else {
          setStatus('denied');
          setError(result.message || 'تایید توکن ناموفق');
        }
      });

      // Hardware token connection listeners
      const removeConnectedListener = window.electronAPI.onTokenConnected((event, data) => {
        console.log('🔌 Hardware token connected:', data);
        // Auto-verify when token is connected
        setTimeout(() => verifyToken(false), 1000);
      });

      const removeDisconnectedListener = window.electronAPI.onTokenDisconnected((event, data) => {
        console.log('🔌 Hardware token disconnected:', data);
        setStatus('denied');
        setError('توکن سخت‌افزاری قطع شد');
      });

      cleanup.push(removeVerificationListener, removeConnectedListener, removeDisconnectedListener);
    };

    // Initial setup
    setupListeners();
    verifyToken();

    // Periodic verification (every 5 minutes)
    const periodicCheck = setInterval(() => {
      if (status === 'granted') {
        verifyToken(false);
      }
    }, 5 * 60 * 1000);

    cleanup.push(() => clearInterval(periodicCheck));

    return () => {
      cleanup.forEach(fn => typeof fn === 'function' && fn());
    };
  }, [verifyToken, status]);

  // Test driver functionality
  const testDriver = useCallback(async () => {
    try {
      if (window.electronAPI && window.electronAPI.testDriver) {
        const result = await window.electronAPI.testDriver();
        
        if (result.success) {
          alert(`✅ درایور یافت شد!\n\nمسیر: ${result.driverPath}\nتعداد اسلات: ${result.slots?.length || 0}\nاسلات‌ها: ${result.slots?.map(s => s.description).join(', ') || 'نامشخص'}`);
        } else {
          alert(`❌ خطا در تست درایور:\n\n${result.error}`);
        }
      } else {
        alert('❌ تابع تست درایور در دسترس نیست');
      }
    } catch (error) {
      alert(`❌ خطا در تست درایور:\n\n${error.message}`);
    }
  }, []);

  // Loading Screen - Enhanced & Beautiful
  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center p-8">
          {/* Logo/Icon */}
          <div className="mb-8">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              {/* Rotating ring around the icon */}
              <div className="absolute inset-0 w-24 h-24 border-4 border-transparent border-t-blue-500 rounded-full animate-spin mx-auto"></div>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">سیستم امنیتی PKCS#11</h1>
          </div>

          {/* Loading Animation */}
          <div className="mb-6">
            <div className="flex justify-center space-x-1 rtl:space-x-reverse mb-4">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
          </div>

          {/* Status Text */}
          <div className="space-y-2">
            <p className="text-xl font-semibold text-gray-700">در حال تایید توکن امنیتی</p>
            <p className="text-gray-500">لطفاً کمی صبر کنید...</p>
            {tokenInfo && (
              <p className="text-sm text-blue-600">
                {tokenInfo.driverPath && `درایور: ${tokenInfo.driverPath.split('/').pop()}`}
                {tokenInfo.isInitialized && ' • آماده'}
              </p>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mt-6 w-64 h-2 bg-gray-200 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  // Access Denied - Enhanced with More Options
  if (status === 'denied' || status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md w-full">
          {/* Error Icon */}
          <div className="mb-6">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {status === 'error' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 15c-.77.833.192 2.5 1.732 2.5z" />
                )}
              </svg>
            </div>
          </div>

          {/* Content */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              {status === 'error' ? '⚠️ خطای سیستمی' : '🔒 دسترسی محدود'}
            </h2>
            
            <div className="text-gray-600 leading-relaxed space-y-2">
              {error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                  <strong>جزئیات خطا:</strong><br />
                  {error}
                </div>
              ) : (
                <p>برای استفاده از این سیستم، توکن امنیتی باید متصل و معتبر باشد.</p>
              )}
              
              {lastVerification && (
                <div className="mt-4 text-xs text-gray-500 bg-gray-50 rounded p-2">
                  <strong>آخرین تلاش:</strong> {new Date(lastVerification.timestamp).toLocaleString('fa-IR')}<br />
                  {lastVerification.details && (
                    <span><strong>جزئیات:</strong> {lastVerification.details}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => verifyToken()}
              disabled={isRetrying}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isRetrying ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  در حال تلاش مجدد...
                </span>
              ) : (
                '🔄 تلاش مجدد'
              )}
            </button>

            {/* Auto-retry button for persistent errors */}
            {retryCount > 0 && !isRetrying && (
              <button
                onClick={retryVerification}
                className="w-full bg-yellow-500 text-white py-2 px-4 rounded-lg hover:bg-yellow-600 transition-colors font-medium text-sm"
              >
                🔁 تلاش مجدد خودکار ({retryCount} بار تلاش شده)
              </button>
            )}

            {/* Driver test button */}
            <button
              onClick={testDriver}
              className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors font-medium text-sm"
            >
              🔧 تست درایور PKCS#11
            </button>
          </div>

          {/* Help Text */}
          <div className="mt-6 text-gray-400 text-sm space-y-1">
            <p>💡 راهنمایی:</p>
            <ul className="text-xs space-y-1 text-right">
              <li>• توکن سخت‌افزاری را به کامپیوتر وصل کنید</li>
              <li>• مطمئن شوید درایور PKCS#11 نصب است</li>
              <li>• PIN توکن را صحیح وارد کرده‌اید</li>
              <li>• کلید مورد نظر روی توکن موجود است</li>
            </ul>
          </div>

          {/* Technical Details (collapsible) */}
          {tokenInfo && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                جزئیات فنی
              </summary>
              <div className="mt-2 text-xs bg-gray-50 rounded p-2 space-y-1">
                <div><strong>درایور:</strong> {tokenInfo.driverPath || 'نامشخص'}</div>
                <div><strong>وضعیت:</strong> {tokenInfo.isInitialized ? 'آماده' : 'غیرآماده'}</div>
                <div><strong>PKCS#11:</strong> {tokenInfo.grapheneAvailable ? 'موجود' : 'غیرموجود'}</div>
                {lastVerification && (
                  <div><strong>آخرین تایید:</strong> {lastVerification.success ? '✓ موفق' : '✗ ناموفق'}</div>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    );
  }

  // Access Granted - Enhanced Status Bar
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
            {lastVerification && (
              <span className="text-green-700 text-sm">
                (آخرین تایید: {new Date(lastVerification.timestamp).toLocaleTimeString('fa-IR')})
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-4 rtl:space-x-reverse">
            {/* Token info */}
            {tokenInfo && (
              <div className="text-green-700 text-xs">
                {tokenInfo.driverPath && (
                  <span title={tokenInfo.driverPath}>
                    📱 {tokenInfo.driverPath.split('/').pop()}
                  </span>
                )}
              </div>
            )}
            
            {/* Manual refresh button */}
            <button
              onClick={() => verifyToken(false)}
              className="text-green-700 hover:text-green-900 p-1 rounded hover:bg-green-200 transition-colors"
              title="تایید مجدد"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            
            <div className="text-green-700 text-sm font-medium">
              🔐 محافظت شده
            </div>
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