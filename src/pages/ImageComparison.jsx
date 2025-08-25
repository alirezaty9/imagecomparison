
import React, { useState, useEffect, useCallback } from 'react';

export default function ImageComparison() {
  const [image1, setImage1] = useState(null);
  const [image2, setImage2] = useState(null);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiUrl, setApiUrl] = useState('http://192.168.88.69:8000');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [dragOver, setDragOver] = useState({ image1: false, image2: false });
  const [apiInfo, setApiInfo] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({ image1: 0, image2: 0 });

  // Load settings and check connection on component mount
  useEffect(() => {
    loadSettings();
    checkConnection();
  }, []);

  // Enhanced settings management
  const loadSettings = useCallback(() => {
    try {
      if (window.storage && typeof window.storage.get === 'function') {
        const settings = window.storage.get('imageComparisonSettings', {});
        if (settings && settings.apiUrl) {
          setApiUrl(settings.apiUrl);
        }
      } else if (typeof localStorage !== 'undefined') {
        const savedSettings = localStorage.getItem('imageComparisonSettings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          if (settings.apiUrl) {
            setApiUrl(settings.apiUrl);
          }
        }
      }
    } catch (error) {
      console.warn('Error loading settings:', error);
    }
  }, []);

  const saveSettings = useCallback(() => {
    try {
      const settings = { apiUrl, lastUpdated: new Date().toISOString() };
      
      if (window.storage && typeof window.storage.set === 'function') {
        window.storage.set('imageComparisonSettings', settings);
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem('imageComparisonSettings', JSON.stringify(settings));
      }
    } catch (error) {
      console.warn('Error saving settings:', error);
    }
  }, [apiUrl]);

  // Enhanced connection checker using electronFetch
  const checkConnection = useCallback(async () => {
    setConnectionStatus('checking');
    try {
      let response;
      
      // Use electronFetch if available (solves CORS issues)
      if (window.electronFetch) {
        response = await window.electronFetch(`${apiUrl}/api/health`);
      } else {
        // Fallback to regular fetch
        response = await fetch(`${apiUrl}/api/health`);
      }
      
      if (response.ok) {
        const health = await response.json();
        setApiInfo(health);
        setConnectionStatus('connected');
        setError(null);
      } else {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      setConnectionStatus('disconnected');
      setError(`عدم اتصال به سرور: ${error.message}`);
      console.error('Connection check failed:', error);
    }
  }, [apiUrl]);

  // Enhanced file upload handler with progress tracking
  const handleFileUpload = useCallback((event, imageSlot) => {
    const file = event.target.files[0];
    if (file) {
      processFile(file, imageSlot);
    }
  }, []);

  // Enhanced drag and drop handlers
  const handleDragOver = useCallback((e, imageSlot) => {
    e.preventDefault();
    setDragOver(prev => ({ ...prev, [imageSlot]: true }));
  }, []);

  const handleDragLeave = useCallback((e, imageSlot) => {
    e.preventDefault();
    setDragOver(prev => ({ ...prev, [imageSlot]: false }));
  }, []);

  const handleDrop = useCallback((e, imageSlot) => {
    e.preventDefault();
    setDragOver(prev => ({ ...prev, [imageSlot]: false }));
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    if (imageFile) {
      processFile(imageFile, imageSlot);
    }
  }, []);

  // Enhanced file processing with validation using imageUtils
  const processFile = useCallback((file, imageSlot) => {
    // Reset progress
    setUploadProgress(prev => ({ ...prev, [imageSlot]: 0 }));

    // Enhanced validation using imageUtils if available
    let validation = { isValid: true };
    if (window.imageUtils && window.imageUtils.validateImageFile) {
      validation = window.imageUtils.validateImageFile(file);
    } else {
      // Fallback validation
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
      const maxSize = 50 * 1024 * 1024; // 50MB
      validation = {
        isValid: validTypes.includes(file.type) && file.size <= maxSize,
        unsupportedType: !validTypes.includes(file.type),
        maxSizeExceeded: file.size > maxSize
      };
    }

    if (!validation.isValid) {
      if (validation.unsupportedType) {
        setError('فرمت فایل پشتیبانی نمی‌شود. لطفاً فایل JPG، PNG، GIF یا BMP انتخاب کنید.');
      } else if (validation.maxSizeExceeded) {
        setError('حجم فایل بیش از حد مجاز است. حداکثر حجم مجاز 50 مگابایت است.');
      }
      return;
    }

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        const newProgress = Math.min(prev[imageSlot] + 10, 90);
        if (newProgress >= 90) {
          clearInterval(progressInterval);
        }
        return { ...prev, [imageSlot]: newProgress };
      });
    }, 100);

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = {
        id: Date.now(),
        name: file.name,
        url: e.target.result,
        file: file,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString()
      };

      if (imageSlot === 'image1') {
        setImage1(imageData);
      } else {
        setImage2(imageData);
      }

      setUploadProgress(prev => ({ ...prev, [imageSlot]: 100 }));
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, [imageSlot]: 0 }));
      }, 1000);

      setError(null);
      setSuccess(null);
      setComparisonResult(null);
    };

    reader.onerror = () => {
      clearInterval(progressInterval);
      setUploadProgress(prev => ({ ...prev, [imageSlot]: 0 }));
      setError('خطا در خواندن فایل');
    };

    reader.readAsDataURL(file);
  }, []);

  // Enhanced file dialog opener using electronAPI
  const openFileDialog = useCallback(async (imageSlot) => {
    try {
      if (window.electronAPI && window.electronAPI.selectImageFiles) {
        const result = await window.electronAPI.selectImageFiles();
        
        if (result.success && result.files && result.files.length > 0) {
          const file = result.files[0];
          const imageData = {
            id: Date.now(),
            name: file.name,
            url: `data:${file.mimeType};base64,${file.data}`,
            file: file,
            size: file.size,
            type: file.mimeType,
            uploadedAt: new Date().toISOString()
          };

          if (imageSlot === 'image1') {
            setImage1(imageData);
          } else {
            setImage2(imageData);
          }

          setError(null);
          setSuccess(null);
          setComparisonResult(null);
        }
      } else {
        // Web fallback
        const input = document.getElementById(`${imageSlot}Input`);
        if (input) {
          input.click();
        }
      }
    } catch (error) {
      setError('خطا در انتخاب فایل. لطفاً دوباره تلاش کنید.');
    }
  }, []);

  // Enhanced image comparison using electronFetch
  const compareImages = useCallback(async () => {
    if (!image1 || !image2) {
      setError('لطفاً هر دو تصویر را انتخاب کنید');
      return;
    }

    if (connectionStatus !== 'connected') {
      setError('اتصال به سرور برقرار نیست. لطفاً اتصال اینترنت و آدرس سرور را بررسی کنید.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    saveSettings();

    try {
      const formData = new FormData();
      
      // Helper function to handle different file formats
      const processImageFile = (imageData, fieldName) => {
        if (imageData.file && imageData.file.data) {
          // Convert base64 to blob (from Electron)
          const base64Data = imageData.file.data;
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: imageData.type });
          formData.append(fieldName, blob, imageData.name);
        } else if (imageData.file instanceof File) {
          formData.append(fieldName, imageData.file);
        }
      };

      processImageFile(image1, 'image1');
      processImageFile(image2, 'image2');

      let response;
      
      // Use electronFetch if available (CORS-free solution)
      if (window.electronFetch) {
        response = await window.electronFetch(`${apiUrl}/api/similarity`, {
          method: 'POST',
          body: formData
        });
      } else {
        // Fallback to regular fetch
        response = await fetch(`${apiUrl}/api/similarity`, {
          method: 'POST',
          body: formData
        });
      }

      if (!response.ok) {
        throw new Error(`خطای سرور: ${response.status}`);
      }

      const result = await response.json();
      setComparisonResult({
        ...result,
        comparedAt: new Date().toISOString(),
        image1Name: image1.name,
        image2Name: image2.name
      });
      
      setSuccess(`مقایسه انجام شد. میزان شباهت: ${result.similarity_score.toFixed(1)}%`);

      // Log comparison for analytics
      if (window.commandLogger) {
        window.commandLogger.log('info', 'Image comparison completed', {
          similarity: result.similarity_score,
          image1: image1.name,
          image2: image2.name
        });
      }

    } catch (error) {
      setError(`خطا در مقایسه تصاویر: ${error.message}`);
      
      if (window.commandLogger) {
        window.commandLogger.log('error', 'Image comparison failed', {
          error: error.message,
          apiUrl
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [image1, image2, connectionStatus, apiUrl, saveSettings]);

  // Remove image handler
  const removeImage = useCallback((imageSlot) => {
    if (imageSlot === 'image1') {
      setImage1(null);
    } else {
      setImage2(null);
    }
    setComparisonResult(null);
    setError(null);
    setSuccess(null);
  }, []);

  // Clear all handler
  const clearAll = useCallback(() => {
    setImage1(null);
    setImage2(null);
    setComparisonResult(null);
    setError(null);
    setSuccess(null);
  }, []);

  // Enhanced file size formatter
  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 بایت';
    const k = 1024;
    const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }, []);

  // Enhanced similarity description
  const getSimilarityDescription = useCallback((score) => {
    if (score >= 95) return { text: 'تطابق کامل', color: 'text-emerald-700', bg: 'bg-emerald-100' };
    if (score >= 90) return { text: 'شباهت بسیار بالا', color: 'text-green-700', bg: 'bg-green-100' };
    if (score >= 80) return { text: 'شباهت بالا', color: 'text-green-600', bg: 'bg-green-50' };
    if (score >= 60) return { text: 'شباهت متوسط', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    if (score >= 40) return { text: 'شباهت کم', color: 'text-orange-600', bg: 'bg-orange-50' };
    return { text: 'شباهت بسیار کم', color: 'text-red-600', bg: 'bg-red-50' };
  }, []);

  // Enhanced Image Upload Component
  const ImageUploadBox = ({ imageSlot, image, title }) => (
    <div className="bg-white rounded-lg shadow-md p-6 transition-all duration-200 hover:shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {image && (
          <button
            onClick={() => removeImage(imageSlot)}
            className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
          >
            حذف
          </button>
        )}
      </div>

      {!image ? (
        <div 
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 ${
            dragOver[imageSlot] 
              ? 'border-blue-500 bg-blue-50 scale-105' 
              : 'border-gray-300 hover:border-blue-400 hover:bg-blue-25'
          }`}
          onDragOver={(e) => handleDragOver(e, imageSlot)}
          onDragLeave={(e) => handleDragLeave(e, imageSlot)}
          onDrop={(e) => handleDrop(e, imageSlot)}
        >
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileUpload(e, imageSlot)}
            className="hidden"
            id={`${imageSlot}Input`}
          />
          
          <div className="space-y-3">
            <div className="text-4xl text-gray-400">📷</div>
            <button
              onClick={() => openFileDialog(imageSlot)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors transform hover:scale-105"
            >
              انتخاب تصویر
            </button>
            <p className="text-gray-500 text-sm">یا اینجا بکشید</p>
          </div>

          {/* Upload Progress */}
          {uploadProgress[imageSlot] > 0 && uploadProgress[imageSlot] < 100 && (
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress[imageSlot]}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-600 mt-1">در حال آپلود... {uploadProgress[imageSlot]}%</p>
            </div>
          )}
        </div>
      ) : (
        <div className="border rounded-lg p-4 bg-gray-50">
          <img 
            src={image.url} 
            alt={image.name}
            className="w-full h-48 object-cover rounded-lg mb-3 transition-transform hover:scale-105"
          />
          <div>
            <h4 className="font-medium truncate" title={image.name}>{image.name}</h4>
            <p className="text-sm text-gray-600">{formatFileSize(image.size)}</p>
            {image.uploadedAt && (
              <p className="text-xs text-gray-500">
                آپلود شده: {new Date(image.uploadedAt).toLocaleTimeString('fa-IR')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">مقایسه دو تصویر</h1>
        <p className="text-gray-600">دو تصویر را آپلود کنید و میزان شباهت آن‌ها را محاسبه کنید</p>
      </div>

      {/* Enhanced Connection Status */}
      <div className="mb-6">
        {connectionStatus === 'connected' && apiInfo && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-800 text-sm font-medium">متصل به سرور</span>
              <span className="text-green-600 text-xs">({apiUrl})</span>
            </div>
            <div className="text-sm text-green-700 grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>وضعیت: {apiInfo.status}</div>
              <div>مدل: {apiInfo.model_loaded ? '✓ بارگذاری شده' : '✗ بارگذاری نشده'}</div>
              <div>تعداد تصاویر: {apiInfo.index_size || 0}</div>
            </div>
          </div>
        )}
        {connectionStatus === 'disconnected' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-red-800 text-sm flex-1">{error || 'عدم اتصال به سرور'}</span>
            <button 
              onClick={checkConnection}
              className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
            >
              تلاش مجدد
            </button>
          </div>
        )}
        {connectionStatus === 'checking' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-blue-800 text-sm">در حال بررسی اتصال...</span>
          </div>
        )}
      </div>

      {/* Enhanced Server Settings */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">تنظیمات سرور</h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              آدرس سرور
            </label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              placeholder="http://192.168.88.69:8000"
            />
          </div>
          <div>
            <button
              onClick={checkConnection}
              disabled={connectionStatus === 'checking'}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {connectionStatus === 'checking' ? 'در حال بررسی...' : 'تست اتصال'}
            </button>
          </div>
          <div>
            <button
              onClick={saveSettings}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              ذخیره
            </button>
          </div>
        </div>
      </div>

      {/* Enhanced Image Upload Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <ImageUploadBox 
          imageSlot="image1" 
          image={image1} 
          title="تصویر اول" 
        />
        <ImageUploadBox 
          imageSlot="image2" 
          image={image2} 
          title="تصویر دوم" 
        />
      </div>

      {/* Enhanced Action Buttons */}
      <div className="text-center mb-6 space-x-4 space-x-reverse">
        <button
          onClick={compareImages}
          disabled={!image1 || !image2 || isLoading || connectionStatus !== 'connected'}
          className="px-8 py-3 bg-green-500 text-white rounded-lg text-lg font-semibold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
        >
          {isLoading ? (
            <span className="flex items-center gap-2 justify-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              در حال مقایسه...
            </span>
          ) : (
            '⚖️ مقایسه تصاویر'
          )}
        </button>

        {(image1 || image2) && (
          <button
            onClick={clearAll}
            className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-all duration-200 transform hover:scale-105"
          >
            🗑️ پاک کردن همه
          </button>
        )}
      </div>

      {/* Enhanced Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 animate-fadeIn">
          <div className="flex items-center gap-2 text-red-800">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 animate-fadeIn">
          <div className="flex items-center gap-2 text-green-800">
            <span>✅</span>
            <span>{success}</span>
          </div>
        </div>
      )}

      {/* Enhanced Comparison Result */}
      {comparisonResult && (
        <div className="bg-white rounded-lg shadow-md p-6 animate-fadeIn">
          <h2 className="text-xl font-semibold mb-6 text-center">نتیجه مقایسه</h2>
          
          {/* Visual Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Image 1 */}
            <div className="text-center">
              <div className="border rounded-lg p-4 bg-gray-50">
                <img 
                  src={image1.url} 
                  alt="تصویر اول"
                  className="w-full h-40 object-cover rounded-lg mb-2"
                />
                <p className="text-sm font-medium text-gray-700">{comparisonResult.image1Name || image1.name}</p>
              </div>
            </div>

            {/* Enhanced Similarity Score */}
            <div className="flex items-center justify-center">
              <div className="text-center p-6 rounded-lg border-2 border-dashed border-gray-300 bg-gradient-to-br from-blue-50 to-indigo-50">
                <div className="text-6xl font-bold text-blue-600 mb-3 animate-pulse">
                  {comparisonResult.similarity_score.toFixed(1)}%
                </div>
                <div className={`inline-block px-4 py-2 rounded-lg text-sm font-medium mb-4 ${
                  getSimilarityDescription(comparisonResult.similarity_score).bg
                } ${getSimilarityDescription(comparisonResult.similarity_score).color}`}>
                  {getSimilarityDescription(comparisonResult.similarity_score).text}
                </div>
                
                {/* Enhanced Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-4 mt-4 overflow-hidden shadow-inner">
                  <div 
                    className={`h-4 rounded-full transition-all duration-2000 ease-out ${
                      comparisonResult.similarity_score >= 90 ? 'bg-gradient-to-r from-emerald-500 to-green-500' : 
                      comparisonResult.similarity_score >= 80 ? 'bg-gradient-to-r from-green-500 to-lime-500' : 
                      comparisonResult.similarity_score >= 60 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 
                      comparisonResult.similarity_score >= 40 ? 'bg-gradient-to-r from-orange-500 to-red-500' : 
                      'bg-gradient-to-r from-red-500 to-red-700'
                    }`}
                    style={{ width: `${comparisonResult.similarity_score}%` }}
                  ></div>
                </div>
                
                {/* Comparison timestamp */}
                {comparisonResult.comparedAt && (
                  <p className="text-xs text-gray-500 mt-2">
                    مقایسه شده در: {new Date(comparisonResult.comparedAt).toLocaleString('fa-IR')}
                  </p>
                )}
              </div>
            </div>

            {/* Image 2 */}
            <div className="text-center">
              <div className="border rounded-lg p-4 bg-gray-50">
                <img 
                  src={image2.url} 
                  alt="تصویر دوم"
                  className="w-full h-40 object-cover rounded-lg mb-2"
                />
                <p className="text-sm font-medium text-gray-700">{comparisonResult.image2Name || image2.name}</p>
              </div>
            </div>
          </div>

          {/* Enhanced Detailed Results */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">جزئیات مقایسه</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div className="bg-white rounded-lg p-4 border-l-4 border-blue-500">
                <div className="text-gray-600 mb-1">تصویر اول</div>
                <div className="font-medium">{comparisonResult.image1Name || comparisonResult.image1}</div>
                <div className="text-xs text-gray-500">{formatFileSize(image1.size)}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border-l-4 border-green-500">
                <div className="text-gray-600 mb-1">تصویر دوم</div>
                <div className="font-medium">{comparisonResult.image2Name || comparisonResult.image2}</div>
                <div className="text-xs text-gray-500">{formatFileSize(image2.size)}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border-l-4 border-purple-500">
                <div className="text-gray-600 mb-1">امتیاز شباهت</div>
                <div className="font-bold text-lg text-purple-600">
                  {comparisonResult.similarity_score.toFixed(2)}%
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border-l-4 border-indigo-500">
                <div className="text-gray-600 mb-1">وضعیت</div>
                <div className={`font-medium ${getSimilarityDescription(comparisonResult.similarity_score).color}`}>
                  {getSimilarityDescription(comparisonResult.similarity_score).text}
                </div>
              </div>
            </div>

            {/* Server message */}
            {comparisonResult.message && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-sm text-blue-700">
                  <strong>پیام سرور:</strong> {comparisonResult.message}
                </div>
              </div>
            )}

            {/* Enhanced Interpretation Guide */}
            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-3 flex items-center gap-2">
                <span>📊</span>
                راهنمای تفسیر نتایج:
              </h4>
              <div className="text-sm text-blue-700 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                  <span>بالای 95%: تطابق کامل - تصاویر یکسان یا تقریباً یکسان</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span>80-94%: شباهت بسیار بالا - تصاویر بسیار مشابه</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span>60-79%: شباهت قابل توجه - ویژگی‌های مشترک قابل تشخیص</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span>40-59%: شباهت متوسط - برخی شباهت‌ها موجود</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span>زیر 40%: شباهت کم یا عدم شباهت</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-8 text-gray-500 text-sm">
        <p>نسخه 2.0.0 • مقایسه تصاویر با رفع مشکل CORS</p>
        <p className="text-xs mt-1">
          {window.electronAPI ? '🖥️ Electron Mode' : '🌐 Web Mode'} • 
          {window.electronFetch ? ' CORS-Free ✅' : ' Standard Fetch ⚠️'}
        </p>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        
        .transition-all {
          transition: all 0.2s ease-in-out;
        }
        
        .hover\\:scale-105:hover {
          transform: scale(1.05);
        }
      `}</style>
    </div>
  );
}