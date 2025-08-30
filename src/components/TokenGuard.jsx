import React, { useState, useEffect, useCallback, useRef } from 'react';

const TokenGuard = ({ children }) => {
  const [status, setStatus] = useState('checking');
  const [tokenInfo, setTokenInfo] = useState(null);
  const [error, setError] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastVerification, setLastVerification] = useState(null);
  const [hardwareConnected, setHardwareConnected] = useState(false);
  const [knownTokenId, setKnownTokenId] = useState(null);
  const [reconnectionAttempt, setReconnectionAttempt] = useState(false);

  // Enhanced refs for better state management
  const listenersSetup = useRef(false);
  const periodicCheckRef = useRef(null);
  const verificationInProgress = useRef(false);
  const currentTokenState = useRef({ connected: false, tokenId: null });
  const stateTransitionLock = useRef(false);

  const verifyToken = useCallback(async (showLoading = true, isReconnection = false) => {
    // Prevent concurrent verifications
    if (verificationInProgress.current) {
      console.log('Verification already in progress, skipping...');
      return;
    }
    
    verificationInProgress.current = true;

    try {
      if (showLoading) {
        setStatus('checking');
        setError(null);
      }
      
      // Wait for API to be ready with timeout
      let attempts = 0;
      while (!window.electronAPI && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!window.electronAPI) {
        setError('API الکترون در دسترس نیست. لطفاً برنامه را مجدداً راه‌اندازی کنید.');
        setStatus('error');
        return;
      }

      const startTime = Date.now();
      
      // First check hardware token presence
      const hardwareCheck = await checkHardwareToken();
      
      if (!hardwareCheck.connected) {
        const elapsed = Date.now() - startTime;
        if (elapsed < 1500 && showLoading) {
          await new Promise(resolve => setTimeout(resolve, 1500 - elapsed));
        }
        
        setHardwareConnected(false);
        currentTokenState.current = { connected: false, tokenId: null };
        setStatus('denied');
        setError('توکن سخت‌افزاری متصل نیست. لطفاً توکن را به کامپیوتر وصل کنید.');
        return;
      }

      // Update hardware state
      setHardwareConnected(true);
      currentTokenState.current = { 
        connected: true, 
        tokenId: hardwareCheck.tokenId 
      };
      
      // Check token status first
      const statusResult = await window.electronAPI.checkTokenStatus();
      
      if (statusResult.success && statusResult.data) {
        setTokenInfo(statusResult.data);
        
        if (statusResult.data.lastVerification && 
            statusResult.data.lastVerification.success &&
            isRecentVerification(statusResult.data.lastVerification.timestamp) &&
            !isReconnection) {
          
          const elapsed = Date.now() - startTime;
          if (elapsed < 1500 && showLoading) {
            await new Promise(resolve => setTimeout(resolve, 1500 - elapsed));
          }
          
          setLastVerification(statusResult.data.lastVerification);
          setStatus('granted');
          setReconnectionAttempt(false);
          return;
        }
      }

      // Perform new verification
      const verifyResult = await window.electronAPI.verifyToken({});
      
      const elapsed = Date.now() - startTime;
      if (elapsed < 1500 && showLoading) {
        await new Promise(resolve => setTimeout(resolve, 1500 - elapsed));
      }

      if (verifyResult.success) {
        setLastVerification(verifyResult);
        setTokenInfo(prev => ({ ...prev, lastVerification: verifyResult }));
        setStatus('granted');
        setRetryCount(0);
        setReconnectionAttempt(false);
        
        if (hardwareCheck.tokenId) {
          setKnownTokenId(hardwareCheck.tokenId);
          try {
            localStorage.setItem('knownTokenId', hardwareCheck.tokenId);
          } catch (e) {
            console.warn('Could not save token ID to localStorage:', e);
          }
        }
      } else {
        setError(verifyResult.message || 'تایید توکن ناموفق بود');
        setStatus('denied');
      }

    } catch (err) {
      console.error('Token verification error:', err);
      setError(err.message || 'خطا در تایید توکن');
      setStatus('error');
    } finally {
      verificationInProgress.current = false;
    }
  }, []);

  const checkHardwareToken = useCallback(async () => {
    try {
      const result = await window.electronAPI.checkHardwareToken(0x096e, 0x0703);
      
      if (result.success && result.connected) {
        const tokenId = `${0x096e}:${0x0703}`;
        return {
          connected: true,
          tokenId: tokenId
        };
      }
      
      return { connected: false };
    } catch (error) {
      console.error('Hardware token check failed:', error);
      return { connected: false };
    }
  }, []);

  const isRecentVerification = (timestamp) => {
    if (!timestamp) return false;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return new Date(timestamp) > fiveMinutesAgo;
  };

  const handleReconnection = useCallback(async () => {
    console.log('Starting reconnection process...');
    setReconnectionAttempt(true);
    await verifyToken(true, true);
  }, [verifyToken]);

  const retryVerification = useCallback(async () => {
    setIsRetrying(true);
    const newRetryCount = retryCount + 1;
    setRetryCount(newRetryCount);
    
    const delay = Math.min(Math.pow(2, newRetryCount) * 1000, 30000);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    await verifyToken();
    setIsRetrying(false);
  }, [retryCount, verifyToken]);

  // Enhanced state transition handlers
  const handleConnect = useCallback(async (data) => {
    console.log('Connect event received:', data);
    
    // Prevent race conditions
    if (stateTransitionLock.current) {
      console.log('State transition locked, queuing connect...');
      setTimeout(() => handleConnect(data), 500);
      return;
    }
    
    stateTransitionLock.current = true;
    
    try {
      const tokenId = `${data.vendorId}:${data.productId}`;
      const storedTokenId = localStorage.getItem('knownTokenId');
      
      // Update hardware state immediately
      setHardwareConnected(true);
      currentTokenState.current = { connected: true, tokenId };
      
      // Clear any error states
      setError(null);
      
      // Handle reconnection or new connection
      if (storedTokenId && tokenId === storedTokenId && status === 'disconnected') {
        console.log('Known token reconnected after disconnect - starting verification');
        setReconnectionAttempt(true);
        setStatus('checking');
        await handleReconnection();
      } else if (status === 'disconnected') {
        console.log('Token connected after disconnect - starting fresh verification');
        setStatus('checking');
        await verifyToken(true);
      } else if (status !== 'granted') {
        console.log('Token connected - starting verification');
        await verifyToken(false);
      }
      
    } catch (error) {
      console.error('Error in handleConnect:', error);
    } finally {
      stateTransitionLock.current = false;
    }
  }, [status, handleReconnection, verifyToken]);

  const handleDisconnect = useCallback((data) => {
    console.log('Disconnect event received:', data);
    
    // Prevent race conditions
    if (stateTransitionLock.current) {
      console.log('State transition locked, queuing disconnect...');
      setTimeout(() => handleDisconnect(data), 100);
      return;
    }
    
    stateTransitionLock.current = true;
    
    try {
      // Update state immediately
      setHardwareConnected(false);
      currentTokenState.current = { connected: false, tokenId: null };
      
      // Only change to disconnected if we were previously granted or checking
      if (status === 'granted' || status === 'checking') {
        setStatus('disconnected');
        setError('توکن سخت‌افزاری قطع شد. برای ادامه کار، آن را مجدداً وصل کنید.');
        setReconnectionAttempt(false);
      }
      
    } finally {
      stateTransitionLock.current = false;
    }
  }, [status]);

  // Setup event listeners only once
  useEffect(() => {
    // Prevent multiple setups
    if (listenersSetup.current || !window.electronAPI) return;
    
    console.log('Setting up TokenGuard event listeners...');
    listenersSetup.current = true;

    // Load known token ID from storage
    try {
      const storedTokenId = localStorage.getItem('knownTokenId');
      if (storedTokenId) {
        setKnownTokenId(storedTokenId);
      }
    } catch (e) {
      console.warn('Could not load token ID from localStorage:', e);
    }

    // Create event handlers
    const handleVerificationResult = (event, result) => {
      console.log('Verification result received:', result);
      setLastVerification(result);
      
      // Only update status if hardware is still connected
      if (currentTokenState.current.connected) {
        if (result.success) {
          setStatus('granted');
          setError(null);
          setRetryCount(0);
          setReconnectionAttempt(false);
        } else {
          setStatus('denied');
          setError(result.message || 'تایید توکن ناموفق');
        }
      } else {
        console.log('Ignoring verification result - hardware disconnected');
      }
    };

    // Register event listeners
    const removeVerificationListener = window.electronAPI.onTokenVerificationResult(handleVerificationResult);
    const removeConnectedListener = window.electronAPI.onTokenConnected((event, data) => {
      handleConnect(data);
    });
    const removeDisconnectedListener = window.electronAPI.onTokenDisconnected((event, data) => {
      handleDisconnect(data);
    });

    // Initial verification
    verifyToken();

    // Cleanup function
    return () => {
      console.log('Cleaning up TokenGuard event listeners...');
      listenersSetup.current = false;
      stateTransitionLock.current = false;
      verificationInProgress.current = false;
      
      if (typeof removeVerificationListener === 'function') removeVerificationListener();
      if (typeof removeConnectedListener === 'function') removeConnectedListener();
      if (typeof removeDisconnectedListener === 'function') removeDisconnectedListener();
      
      if (periodicCheckRef.current) {
        clearInterval(periodicCheckRef.current);
        periodicCheckRef.current = null;
      }
    };
  }, []); // Empty dependency array - runs only once

  // Enhanced periodic checking
  useEffect(() => {
    // Only setup periodic check when granted
    if (status === 'granted') {
      if (periodicCheckRef.current) {
        clearInterval(periodicCheckRef.current);
      }

      periodicCheckRef.current = setInterval(async () => {
        try {
          const hardwareStatus = await checkHardwareToken();
          
          if (!hardwareStatus.connected && currentTokenState.current.connected) {
            console.log('Periodic check detected hardware disconnect');
            handleDisconnect({ source: 'periodic-check' });
          } else if (hardwareStatus.connected && !currentTokenState.current.connected) {
            console.log('Periodic check detected hardware reconnect');
            handleConnect({ 
              vendorId: 0x096e, 
              productId: 0x0703,
              source: 'periodic-check'
            });
          }
        } catch (error) {
          console.error('Periodic check error:', error);
        }
      }, 3000); // Check every 3 seconds
      
    } else {
      if (periodicCheckRef.current) {
        clearInterval(periodicCheckRef.current);
        periodicCheckRef.current = null;
      }
    }

    return () => {
      if (periodicCheckRef.current) {
        clearInterval(periodicCheckRef.current);
        periodicCheckRef.current = null;
      }
    };
  }, [status, checkHardwareToken, handleConnect, handleDisconnect]);

  // Test driver functionality
  const testDriver = useCallback(async () => {
    try {
      if (window.electronAPI && window.electronAPI.testDriver) {
        const result = await window.electronAPI.testDriver();
        
        if (result.success) {
          alert(`درایور یافت شد!\n\nمسیر: ${result.driverPath}\nتعداد اسلات: ${result.slots?.length || 0}`);
        } else {
          alert(`خطا در تست درایور:\n\n${result.error}`);
        }
      } else {
        alert('تابع تست درایور در دسترس نیست');
      }
    } catch (error) {
      alert(`خطا در تست درایور:\n\n${error.message}`);
    }
  }, []);

  // Helper function to safely render object details
  const renderObjectDetails = (obj) => {
    if (!obj || typeof obj !== 'object') return 'نامشخص';
    
    try {
      return Object.entries(obj).map(([key, value]) => {
        let displayValue = value;
        if (typeof value === 'object') {
          displayValue = JSON.stringify(value);
        } else if (typeof value === 'boolean') {
          displayValue = value ? 'بله' : 'خیر';
        }
        return `${key}: ${displayValue}`;
      }).join(', ');
    } catch (error) {
      return 'خطا در نمایش جزئیات';
    }
  };

  // Debug info
  useEffect(() => {
    console.log('TokenGuard State:', {
      status,
      hardwareConnected,
      currentTokenState: currentTokenState.current,
      verificationInProgress: verificationInProgress.current,
      stateTransitionLock: stateTransitionLock.current
    });
  }, [status, hardwareConnected]);

  // Industrial Loading Screen
  if (status === 'checking') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900">
        <div className="text-center p-8 max-w-md bg-gray-800 rounded-lg shadow-2xl border border-gray-700">
          <div className="mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white mb-2">
              سیستم امنیتی PKCS#11
            </h1>
          </div>

          <div className="space-y-3">
            <p className="text-lg font-medium text-gray-300">
              {reconnectionAttempt ? 'در حال اتصال مجدد...' : 'در حال تایید توکن امنیتی'}
            </p>
            <p className="text-gray-400 text-sm">لطفاً کمی صبر کنید</p>

            {!hardwareConnected && (
              <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-3">
                <p className="text-yellow-300 text-sm">بررسی اتصال سخت‌افزاری...</p>
              </div>
            )}
          </div>

          <div className="mt-6 w-64 h-2 bg-gray-700 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  // Industrial Token Disconnected State
  if (status === 'disconnected') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 p-4">
        <div className="text-center p-8 bg-gray-800 rounded-lg shadow-2xl max-w-lg w-full border border-gray-700">
          <div className="mb-6">
            <div className="w-16 h-16 bg-orange-700 rounded-lg flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-3">
              ارتباط قطع شده
            </h2>
          </div>

          <div className="mb-8">
            <p className="font-semibold text-lg text-orange-300">توکن سخت‌افزاری قطع شده است</p>

            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 text-gray-300 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 bg-orange-700 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">!</span>
                </div>
                <strong className="text-orange-300">برای ادامه کار:</strong>
              </div>
              <div className="space-y-2 text-sm text-left">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  <span>توکن را مجدداً به کامپیوتر وصل کنید</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  <span>سیستم به صورت خودکار آن را تشخیص خواهد داد</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  <span>در صورت نیاز دکمه تلاش مجدد را بزنید</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {reconnectionAttempt ? (
              <div className="p-4 bg-yellow-900 border border-yellow-700 rounded-lg">
                <div className="flex items-center justify-center gap-3 text-yellow-300">
                  <div className="w-6 h-6 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-semibold">در حال اتصال مجدد...</span>
                </div>
              </div>
            ) : (
              <button
                onClick={() => verifyToken()}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-lg"
              >
                تلاش مجدد اتصال
              </button>
            )}

            <button
              onClick={testDriver}
              className="w-full bg-gray-600 text-white py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors font-medium"
            >
              تست درایور PKCS#11
            </button>
          </div>

          <div className="mt-6 p-4 bg-gray-700 rounded-lg border border-gray-600">
            <div className="flex items-center justify-center gap-3">
              <div className="w-3 h-3 bg-orange-600 rounded-full"></div>
              <span className="text-gray-300 font-medium">وضعیت: قطع شده</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Industrial Access Denied State
  if (status === 'denied' || status === 'error') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 p-4">
        <div className="text-center p-8 bg-gray-800 rounded-lg shadow-2xl max-w-md w-full border border-gray-700">
          <div className="mb-6">
            <div className="w-16 h-16 bg-orange-700 rounded-lg flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 15c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-3">
              {status === 'error' ? 'خطای سیستمی' : 'دسترسی محدود'}
            </h2>

            <div className="text-gray-300 leading-relaxed space-y-2">
              {error ? (
                <div className="bg-orange-950 border border-orange-700 rounded-lg p-3 text-orange-200 text-sm">
                  <strong>جزئیات خطا:</strong><br />
                  {error}
                </div>
              ) : (
                <p>برای استفاده از این سیستم، توکن امنیتی باید متصل و معتبر باشد.</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => verifyToken()}
              disabled={isRetrying}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRetrying ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  در حال تلاش مجدد...
                </span>
              ) : (
                <span>تلاش مجدد</span>
              )}
            </button>

            <button
              onClick={testDriver}
              className="w-full bg-gray-600 text-white py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors font-medium"
            >
              تست درایور PKCS#11
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Industrial Access Granted - Success State
  return (
    <>
      {/* Industrial Security Banner */}
      <div className="bg-gray-800 border-b-2 border-blue-600 px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4 rtl:space-x-reverse">
            <div className="flex items-center space-x-3 rtl:space-x-reverse bg-gray-700 rounded-lg p-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <div className="flex flex-col">
              <span className="text-white font-bold text-base">دسترسی امن فعال</span>
              <span className="text-gray-300 text-xs">سیستم امنیتی PKCS#11</span>
            </div>
          </div>

          <div className="flex items-center space-x-6 rtl:space-x-reverse">
            <div className="flex items-center space-x-3 rtl:space-x-reverse bg-gray-700 rounded-lg p-2">
              <div className={`w-2 h-2 rounded-full ${hardwareConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <div className="flex flex-col">
                <span className={`text-xs font-medium ${hardwareConnected ? 'text-green-400' : 'text-yellow-400'}`}>
                  {hardwareConnected ? 'سخت‌افزار متصل' : 'بررسی سخت‌افزار'}
                </span>
                <span className="text-xs text-gray-400">
                  {hardwareConnected ? 'فعال' : 'نظارت'}
                </span>
              </div>
            </div>

            <button
              onClick={() => verifyToken(false)}
              className="bg-gray-700 text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-600 transition-colors"
              title="تایید مجدد"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            <div className="bg-blue-600 text-white px-3 py-1 rounded-lg">
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="font-bold text-xs">SECURE</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Industrial Main Content Area */}
      <div className="min-h-screen bg-gray-900">
        {children}
      </div>
    </>
  );
};

export default TokenGuard;