// src/pages/License.jsx
import React, { useState } from 'react';

const License = () => {
  const [tokenId, setTokenId] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGetTokenId = async () => {
    setIsLoading(true);
    setError('');
    setTokenId('');
    
    // Check if the electronAPI is available
    if (!window.electronAPI || !window.electronAPI.getTokenId) {
      setError('API الکترون در دسترس نیست. لطفاً از داخل برنامه اجرا کنید.');
      setIsLoading(false);
      return;
    }

    const result = await window.electronAPI.getTokenId();
    if (result.success) {
      setTokenId(result.tokenId);
    } else {
      setError(result.error);
    }
    setIsLoading(false);
  };

  const copyToClipboard = () => {
    if (tokenId) {
      navigator.clipboard.writeText(tokenId);
      alert('شناسه توکن در کلیپ‌بورد کپی شد!');
    }
  };

  return (
    <div className="p-8 text-white max-w-4xl mx-auto">
      <div className="p-6 bg-gray-800 rounded-lg border border-gray-700 shadow-lg">
        <h1 className="text-3xl font-bold mb-3 text-blue-400">مدیریت لایسنس و فعال‌سازی</h1>
        <p className="text-gray-400 mb-6">
          برای فعال‌سازی قابلیت‌های کامل برنامه، باید شناسه یکتای توکن سخت‌افزاری خود را برای پشتیبانی ارسال کنید تا یک فایل لایسنس اختصاصی برای شما صادر شود.
        </p>
        
        <div className="flex flex-col items-start">
          <button
            onClick={handleGetTokenId}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-wait"
          >
            {isLoading ? 'در حال خواندن شناسه از توکن...' : '۱. دریافت شناسه توکن'}
          </button>

          {error && (
            <div className="mt-4 w-full p-4 bg-red-900 border border-red-700 text-red-200 rounded-lg animate-pulse">
              <strong>خطا:</strong> {error}
            </div>
          )}

          {tokenId && (
            <div className="mt-6 w-full animate-fade-in">
              <p className="text-gray-200 font-semibold mb-2">۲. شناسه یکتای توکن شما آماده است:</p>
              <pre className="bg-gray-900 p-4 rounded-md text-sm text-gray-300 whitespace-pre-wrap break-all border border-gray-600">
                {tokenId}
              </pre>
              <button
                onClick={copyToClipboard}
                className="mt-3 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200"
              >
                کپی کردن شناسه
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default License;