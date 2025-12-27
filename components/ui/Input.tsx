

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  labelClassName?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', labelClassName = '', ...props }) => {
  const isDarkBg = 
    className.includes('bg-black') || 
    className.includes('bg-slate-900') || 
    className.includes('bg-slate-800') || 
    className.includes('bg-gray-900') || 
    className.includes('bg-gray-800') || 
    className.includes('bg-brand-900');
    
  const textColorClass = isDarkBg ? 'text-white placeholder:text-gray-400' : 'text-gray-900 placeholder:text-gray-500';

  return (
    <div className="w-full">
      {label && (
        <label className={`block text-sm font-medium mb-1 ${labelClassName || 'text-gray-700'}`}>
          {label}
        </label>
      )}
      <input
        className={`
          w-full rounded-md shadow-sm border p-2 transition-all
          focus:ring-2 focus:ring-brand-500 focus:border-brand-500
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-red-500' : 'border-gray-300'}
          ${textColorClass}
          ${className}
        `}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600 font-medium">{error}</p>}
    </div>
  );
};
