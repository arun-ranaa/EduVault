import React from 'react';

export default function EmptyState({ icon, title, message, action }) {
  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return icon;
    }
    const IconComponent = icon;
    return <IconComponent className="h-6 w-6 text-gray-500" />;
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl border border-dashed border-gray-300">
      {icon && (
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mb-4">
          {renderIcon()}
        </div>
      )}
      <h3 className="text-sm font-medium text-gray-900">{title}</h3>
      {message && <p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">{message}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
