import React, { useState, useEffect } from 'react';

export default function ImageComparison() {
  const [image1, setImage1] = useState(null);
  const [image2, setImage2] = useState(null);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiUrl, setApiUrl] = useState('http://192.168.1.101:8000');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [dragOver, setDragOver] = useState({ image1: false, image2: false });
  const [apiInfo, setApiInfo] = useState(null);

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
    checkConnection();
  }, []);

  const loadSettings = () => {
    try {
      // استفاده از localStorage به جای window.storage
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedSettings = localStorage.getItem('appSettings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          if (settings.apiUrl) {
            setApiUrl(settings.apiUrl);
          }
        }
      }
      // اگر storage API وجود داشت، از آن استفاده کن
      else if (typeof window !== 'undefined' && window.storage && typeof window.storage.get === 'function') {
        const settings = window.storage.get('appSettings', {});
        if (settings && settings.apiUrl) {
          setApiUrl(settings.apiUrl);
        }
      }
    } catch (error) {
      console.warn('Error loading settings:', error);
      // در صورت خطا، از مقدار پیش‌فرض استفاده می‌کنیم
    }
  };

  const saveSettings = () => {
    try {
      // استفاده از localStorage به جای window.storage
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('appSettings', JSON.stringify({ apiUrl }));
      }
      // اگر storage API وجود داشت، از آن هم استفاده کن
      else if (typeof window !== 'undefined' && window.storage && typeof window.storage.set === 'function') {
        window.storage.set('appSettings', { apiUrl });
      }
    } catch (error) {
      console.warn('Error saving settings:', error);
    }
  };

  // Check server connection
  const checkConnection = async () => {
    setConnectionStatus('checking');
    try {
      const response = await fetch(`${apiUrl}/api/health`);
      if (response.ok) {
        const health = await response.json();
        setApiInfo(health);
        setConnectionStatus('connected');
        setError(null);
      } else {
        throw new Error('سرور پاسخ نداد');
      }
    } catch (error) {
      setConnectionStatus('disconnected');
      setError('عدم اتصال به سرور. لطفاً آدرس سرور را بررسی کنید.');
    }
  };

  // Handle file upload for specific image slot
  const handleFileUpload = (event, imageSlot) => {
    const file = event.target.files[0];
    if (file) {
      processFile(file, imageSlot);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e, imageSlot) => {
    e.preventDefault();
    setDragOver(prev => ({ ...prev, [imageSlot]: true }));
  };

  const handleDragLeave = (e, imageSlot) => {
    e.preventDefault();
    setDragOver(prev => ({ ...prev, [imageSlot]: false }));
  };

  const handleDrop = (e, imageSlot) => {
    e.preventDefault();
    setDragOver(prev => ({ ...prev, [imageSlot]: false }));
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    if (imageFile) {
      processFile(imageFile, imageSlot);
    }
  };

  // Process selected file
  const processFile = (file, imageSlot) => {
    // Basic file validation
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
    const maxSize = 50 * 1024 * 1024; // 50MB

    if (!validTypes.includes(file.type)) {
      setError('فرمت فایل پشتیبانی نمی‌شود. لطفاً فایل JPG، PNG، GIF یا BMP انتخاب کنید.');
      return;
    }

    if (file.size > maxSize) {
      setError('حجم فایل بیش از حد مجاز است. حداکثر حجم مجاز 50 مگابایت است.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = {
        id: Date.now(),
        name: file.name,
        url: e.target.result,
        file: file,
        size: file.size,
        type: file.type
      };

      if (imageSlot === 'image1') {
        setImage1(imageData);
      } else {
        setImage2(imageData);
      }

      setError(null);
      setSuccess(null);
      setComparisonResult(null);
    };
    reader.readAsDataURL(file);
  };

  // Open file dialog using Electron
  const openFileDialog = async (imageSlot) => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.selectImageFiles === 'function') {
        const result = await window.electronAPI.selectImageFiles();
        
        if (result.success && result.files && result.files.length > 0) {
          const file = result.files[0];
          const imageData = {
            id: Date.now(),
            name: file.name,
            url: `data:${file.mimeType};base64,${file.data}`,
            file: file,
            size: file.size,
            type: file.mimeType
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
  };

  // Compare two images
  const compareImages = async () => {
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
      
      // Handle first image
      if (image1.file && image1.file.data) {
        // Convert base64 to blob (from Electron)
        const base64Data = image1.file.data;
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: image1.type });
        formData.append('image1', blob, image1.name);
      } else if (image1.file instanceof File) {
        formData.append('image1', image1.file);
      }

      // Handle second image
      if (image2.file && image2.file.data) {
        // Convert base64 to blob (from Electron)
        const base64Data = image2.file.data;
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: image2.type });
        formData.append('image2', blob, image2.name);
      } else if (image2.file instanceof File) {
        formData.append('image2', image2.file);
      }

      const response = await fetch(`${apiUrl}/api/similarity`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`خطای سرور: ${response.status}`);
      }

      const result = await response.json();
      setComparisonResult(result);
      setSuccess(`مقایسه انجام شد. میزان شباهت: ${result.similarity_score.toFixed(1)}%`);

    } catch (error) {
      setError('خطا در مقایسه تصاویر. لطفاً اتصال اینترنت و تنظیمات را بررسی کنید.');
    } finally {
      setIsLoading(false);
    }
  };

  // Remove image
  const removeImage = (imageSlot) => {
    if (imageSlot === 'image1') {
      setImage1(null);
    } else {
      setImage2(null);
    }
    setComparisonResult(null);
    setError(null);
    setSuccess(null);
  };

  // Clear all
  const clearAll = () => {
    setImage1(null);
    setImage2(null);
    setComparisonResult(null);
    setError(null);
    setSuccess(null);
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 بایت';
    const k = 1024;
    const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Get similarity description
  const getSimilarityDescription = (score) => {
    if (score >= 90) return { text: 'شباهت بسیار بالا', color: 'text-green-700', bg: 'bg-green-100' };
    if (score >= 80) return { text: 'شباهت بالا', color: 'text-green-600', bg: 'bg-green-50' };
    if (score >= 60) return { text: 'شباهت متوسط', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    if (score >= 40) return { text: 'شباهت کم', color: 'text-orange-600', bg: 'bg-orange-50' };
    return { text: 'شباهت بسیار کم', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const ImageUploadBox = ({ imageSlot, image, title }) => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {image && (
          <button
            onClick={() => removeImage(imageSlot)}
            className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
          >
            حذف
          </button>
        )}
      </div>

      {!image ? (
        <div 
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragOver[imageSlot] ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
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
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              انتخاب تصویر
            </button>
            <p className="text-gray-500 text-sm">یا اینجا بکشید</p>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg p-4 bg-gray-50">
          <img 
            src={image.url} 
            alt={image.name}
            className="w-full h-48 object-cover rounded-lg mb-3"
          />
          <div>
            <h4 className="font-medium truncate" title={image.name}>{image.name}</h4>
            <p className="text-sm text-gray-600">{formatFileSize(image.size)}</p>
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

      {/* Connection Status */}
      <div className="mb-6">
        {connectionStatus === 'connected' && apiInfo && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-green-800 text-sm font-medium">متصل به سرور</span>
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
            <span className="text-red-800 text-sm">عدم اتصال به سرور</span>
            <button 
              onClick={checkConnection}
              className="mr-auto px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
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

      {/* Server Settings */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">تنظیمات سرور</h2>
        <div className="flex gap-4 items-center">
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
          <div className="pt-6">
            <button
              onClick={checkConnection}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              تست اتصال
            </button>
          </div>
        </div>
      </div>

      {/* Image Upload Section */}
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

      {/* Action Buttons */}
      <div className="text-center mb-6 space-x-4 space-x-reverse">
        <button
          onClick={compareImages}
          disabled={!image1 || !image2 || isLoading || connectionStatus !== 'connected'}
          className="px-8 py-3 bg-green-500 text-white rounded-lg text-lg font-semibold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            پاک کردن همه
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-red-800">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-green-800">
            <span>✅</span>
            <span>{success}</span>
          </div>
        </div>
      )}

      {/* Comparison Result */}
      {comparisonResult && (
        <div className="bg-white rounded-lg shadow-md p-6">
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
                <p className="text-sm font-medium text-gray-700">{image1.name}</p>
              </div>
            </div>

            {/* Similarity Score */}
            <div className="flex items-center justify-center">
              <div className="text-center p-6 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-5xl font-bold text-blue-600 mb-2">
                  {comparisonResult.similarity_score.toFixed(1)}%
                </div>
                <div className={`inline-block px-4 py-2 rounded-lg text-sm font-medium ${
                  getSimilarityDescription(comparisonResult.similarity_score).bg
                } ${getSimilarityDescription(comparisonResult.similarity_score).color}`}>
                  {getSimilarityDescription(comparisonResult.similarity_score).text}
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-3 mt-4 overflow-hidden">
                  <div 
                    className={`h-3 rounded-full transition-all duration-1000 ${
                      comparisonResult.similarity_score >= 80 ? 'bg-green-500' : 
                      comparisonResult.similarity_score >= 60 ? 'bg-yellow-500' : 
                      comparisonResult.similarity_score >= 40 ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${comparisonResult.similarity_score}%` }}
                  ></div>
                </div>
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
                <p className="text-sm font-medium text-gray-700">{image2.name}</p>
              </div>
            </div>
          </div>

          {/* Detailed Results */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">جزئیات مقایسه</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white rounded-lg p-4">
                <div className="text-gray-600 mb-1">تصویر اول</div>
                <div className="font-medium">{comparisonResult.image1}</div>
              </div>
              <div className="bg-white rounded-lg p-4">
                <div className="text-gray-600 mb-1">تصویر دوم</div>
                <div className="font-medium">{comparisonResult.image2}</div>
              </div>
              <div className="bg-white rounded-lg p-4">
                <div className="text-gray-600 mb-1">امتیاز شباهت</div>
                <div className="font-bold text-lg text-blue-600">
                  {comparisonResult.similarity_score.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* Show message if available */}
            {comparisonResult.message && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-700">
                  پیام سرور: {comparisonResult.message}
                </div>
              </div>
            )}

            {/* Interpretation Guide */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">راهنمای تفسیر نتایج:</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <div>• بالای 90%: تصاویر تقریباً یکسان هستند</div>
                <div>• 80-89%: شباهت بسیار بالا</div>
                <div>• 60-79%: شباهت قابل توجه</div>
                <div>• 40-59%: شباهت متوسط</div>
                <div>• زیر 40%: شباهت کم یا عدم شباهت</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-8 text-gray-500 text-sm">
        نسخه 1.0.0 • مقایسه تصاویر
      </div>
    </div>
  );
}