import React, { useState, useEffect } from 'react';
import { FaSearch } from 'react-icons/fa';

export default function SearchBar({ value, onChange, placeholder = 'Search...', onSearch }) {
  const [localValue, setLocalValue] = useState(value || '');

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (onChange && localValue !== value) {
        onChange(localValue);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [localValue, onChange, value]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(localValue);
    } else if (onChange) {
      onChange(localValue);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative flex-1 max-w-lg">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <FaSearch className="h-4 w-4 text-gray-400" />
      </div>
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className="input-field pl-10"
        placeholder={placeholder}
      />
    </form>
  );
}
