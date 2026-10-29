import React from 'react';
import type { AuditLogFilters } from '../AuditTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Filter, RefreshCw } from 'lucide-react';

interface AuditFiltersProps {
  filters: AuditLogFilters;
  onChange: (filters: AuditLogFilters) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onReset: () => void;
  lang?: 'ar' | 'fr';
}

export default function AuditFilters({
  filters,
  onChange,
  searchQuery,
  onSearchChange,
  onReset,
  lang = 'ar',
}: AuditFiltersProps) {
  const handleFilterChange = (field: keyof AuditLogFilters, value: string) => {
    onChange({
      ...filters,
      [field]: value || undefined,
    });
  };

  return (
    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 space-y-4 text-right" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-col md:flex-row gap-3">
        {/* General Search Box */}
        <div className="flex-1 relative">
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={lang === 'ar' ? 'بحث بالحدث أو الملاحظات أو اسم الفاعل...' : 'Recherche par action, acteur, notes...'}
            className="pr-10 text-xs text-right bg-white border-slate-200"
          />
          <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Module ID */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400">{lang === 'ar' ? 'الوحدة النشطة' : 'Module'}</label>
          <select
            value={filters.moduleId || ''}
            onChange={(e) => handleFilterChange('moduleId', e.target.value)}
            className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
          >
            <option value="">{lang === 'ar' ? 'الكل' : 'Tous'}</option>
            <option value="school">{lang === 'ar' ? 'وحدة المدارس' : 'Écoles'}</option>
            <option value="university">{lang === 'ar' ? 'وحدة الجامعات' : 'Universités'}</option>
            <option value="company">{lang === 'ar' ? 'وحدة الشركات' : 'Entreprises'}</option>
            <option value="training">{lang === 'ar' ? 'وحدة التدريب' : 'Centres'}</option>
            <option value="system">{lang === 'ar' ? 'النظام' : 'Système'}</option>
          </select>
        </div>

        {/* Action Type */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400">{lang === 'ar' ? 'العملية' : 'Action'}</label>
          <Input
            value={filters.action || ''}
            onChange={(e) => handleFilterChange('action', e.target.value)}
            placeholder="e.g. login, submit"
            className="h-9 text-xs bg-white border-slate-200"
          />
        </div>

        {/* Result Status */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400">{lang === 'ar' ? 'الحالة' : 'Résultat'}</label>
          <select
            value={filters.result || ''}
            onChange={(e) => handleFilterChange('result', e.target.value)}
            className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-xs focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
          >
            <option value="">{lang === 'ar' ? 'الكل' : 'Tous'}</option>
            <option value="success">{lang === 'ar' ? 'ناجح' : 'Succès'}</option>
            <option value="failure">{lang === 'ar' ? 'فشل' : 'Échec'}</option>
            <option value="warning">{lang === 'ar' ? 'تحذير' : 'Avertissement'}</option>
          </select>
        </div>

        {/* Start Date */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400">{lang === 'ar' ? 'من تاريخ' : 'Du'}</label>
          <Input
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="h-9 text-xs bg-white border-slate-200"
          />
        </div>

        {/* End Date */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-400">{lang === 'ar' ? 'إلى تاريخ' : 'Au'}</label>
          <Input
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="h-9 text-xs bg-white border-slate-200"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={onReset} className="gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          {lang === 'ar' ? 'إعادة ضبط' : 'Réinitialiser'}
        </Button>
      </div>
    </div>
  );
}
