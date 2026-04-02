
import React, { useCallback, useState } from 'react';
import { useApp } from '../contexts/AppContext';

interface ImageUploaderProps {
  onImageSelected: (file: File) => void;
  disabled?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const { t } = useApp();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(false);
  }, [disabled]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        onImageSelected(file);
      }
    }
  }, [onImageSelected, disabled]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onImageSelected(e.target.files[0]);
    }
  }, [onImageSelected]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative group overflow-hidden rounded-2xl transition-all duration-500 ease-out cursor-pointer
        flex flex-col items-center justify-center p-8 sm:p-12 text-center h-full min-h-[350px]
        border border-dashed
        ${isDragging 
          ? 'border-trading-green bg-trading-green/5 shadow-[0_0_50px_rgba(0,240,255,0.15)] scale-[1.02]' 
          : 'border-gray-300 dark:border-gray-700/50 hover:border-trading-green/50 bg-white dark:bg-gray-900/30 hover:bg-gray-50 dark:hover:bg-gray-900/60'}
        ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
      `}
    >
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
        disabled={disabled}
      />
      
      {/* Scanning Grid Animation (Background) */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-0 ${isDragging ? 'opacity-100' : ''}`}>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,240,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
        <div className="absolute top-0 left-0 w-full h-1 bg-trading-green/30 shadow-[0_0_15px_rgba(0,240,255,0.5)] animate-scan"></div>
      </div>

      {/* Icon Container */}
      <div className="relative z-10 mb-6 group-hover:scale-110 transition-transform duration-500">
        <div className="absolute -inset-4 bg-trading-green/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div className="bg-gray-100 dark:bg-gray-800/80 p-5 rounded-2xl ring-1 ring-gray-200 dark:ring-gray-700 shadow-xl dark:shadow-2xl relative transition-colors duration-300">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-gray-500 dark:text-gray-400 group-hover:text-trading-green transition-colors duration-300">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
      </div>

      {/* Text */}
      <div className="relative z-10 space-y-2">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-trading-green transition-colors duration-300 tracking-wide">
          {t('upload.title')}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto font-mono leading-relaxed">
          {t('upload.desc')}<br/>
          <span className="text-xs text-gray-400 dark:text-gray-600">{t('upload.sub')}</span>
        </p>
      </div>

      {/* Decorative Corners */}
      <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-gray-300 dark:border-gray-600 group-hover:border-trading-green transition-colors duration-300 rounded-tl-lg m-2"></div>
      <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-gray-300 dark:border-gray-600 group-hover:border-trading-green transition-colors duration-300 rounded-tr-lg m-2"></div>
      <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-gray-300 dark:border-gray-600 group-hover:border-trading-green transition-colors duration-300 rounded-bl-lg m-2"></div>
      <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-gray-300 dark:border-gray-600 group-hover:border-trading-green transition-colors duration-300 rounded-br-lg m-2"></div>
    </div>
  );
};

export default ImageUploader;
