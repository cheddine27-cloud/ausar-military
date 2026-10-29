import React, { useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface DataTableColumn<T> {
  key: string;
  headerAr: string;
  headerFr: string;
  render: (item: T, index: number) => React.ReactNode;
  className?: string;
}

interface EnterpriseDataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  lang?: 'ar' | 'fr';
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  emptyState?: React.ReactNode;
  className?: string;
}

function EnterpriseDataTableInner<T>({
  data,
  columns,
  lang = 'ar',
  pagination,
  emptyState,
  className = '',
}: EnterpriseDataTableProps<T>) {
  const isAr = lang === 'ar';

  const renderedRows = useMemo(() => {
    if (data.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={columns.length} className="text-center py-8">
            {emptyState || (isAr ? 'لا توجد بيانات متاحة' : 'Aucune donnée disponible')}
          </TableCell>
        </TableRow>
      );
    }

    return data.map((item, index) => (
      <TableRow key={((item as Record<string, unknown>).id as string) || index} className="hover:bg-slate-50/50">
        {columns.map((col) => (
          <TableCell key={col.key} className={`text-right p-4 ${col.className || ''}`}>
            {col.render(item, index)}
          </TableCell>
        ))}
      </TableRow>
    ));
  }, [data, columns, emptyState, isAr]);

  return (
    <div className={`space-y-4 ${className}`} dir={isAr ? 'rtl' : 'ltr'}>
      <div className="rounded-3xl border border-slate-100 bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={`text-right font-bold text-slate-500 text-xs p-4 ${col.className || ''}`}>
                  {isAr ? col.headerAr : col.headerFr}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>{renderedRows}</TableBody>
        </Table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-[10px] text-slate-400">
            {isAr
              ? `الصفحة ${pagination.currentPage} من ${pagination.totalPages}`
              : `Page ${pagination.currentPage} sur ${pagination.totalPages}`}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.currentPage >= pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              className="h-8 w-8 p-0 rounded-xl"
            >
              {isAr ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.currentPage <= 1}
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              className="h-8 w-8 p-0 rounded-xl"
            >
              {isAr ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// React.memo with generic props wrapper
export const EnterpriseDataTable = React.memo(EnterpriseDataTableInner) as <T>(
  props: EnterpriseDataTableProps<T>
) => React.ReactElement;
