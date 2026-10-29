import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface EnterpriseSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export const EnterpriseSearchBar = React.memo(function EnterpriseSearchBar({
  value,
  onChange,
  placeholder = 'بحث...',
  debounceMs = 300,
  className = '',
}: EnterpriseSearchBarProps) {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      onChange(localVal);
    }, debounceMs);

    return () => {
      clearTimeout(handler);
    };
  }, [localVal, debounceMs, onChange]);

  return (
    <div className={`relative ${className}`} dir="rtl">
      <Input
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        placeholder={placeholder}
        className="pr-10 text-xs text-right bg-white border-slate-200"
      />
      <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
    </div>
  );
});
