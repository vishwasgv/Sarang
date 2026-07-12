import React, { useState, useRef } from 'react'
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  getPaginationRowModel, flexRender,
  type ColumnDef, type SortingState, type ColumnFiltersState
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { cn } from '@shared/utils/cn'

interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  searchPlaceholder?: string
  pageSize?: number
  onRowClick?: (row: T) => void
  emptyMessage?: string
  loading?: boolean
  toolbar?: React.ReactNode
  virtualize?: boolean
}

export function DataTable<T>({
  data, columns, searchPlaceholder = 'Search…',
  pageSize = 20, onRowClick, emptyMessage = 'No records found.', loading, toolbar,
  virtualize = false
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(virtualize ? {} : { getPaginationRowModel: getPaginationRowModel() }),
    initialState: { pagination: { pageSize } }
  })

  const filteredRows = virtualize ? table.getFilteredRowModel().rows : table.getRowModel().rows

  const rowVirtualizer = useVirtualizer({
    count: virtualize ? filteredRows.length : 0,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 44,
    overscan: 10,
    enabled: virtualize,
  })

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full h-11 pl-10 pr-3 text-base rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-colors placeholder:text-slate-400"
          />
        </div>
        {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
        <div
          ref={virtualize ? scrollContainerRef : undefined}
          className={cn('overflow-x-auto', virtualize && 'overflow-y-auto')}
          style={virtualize ? { maxHeight: '65vh' } : undefined}
        >
          <table className="w-full text-base">
            <thead className={virtualize ? 'sticky top-0 z-10' : undefined}>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={cn('px-4 py-4 text-left text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide select-none whitespace-nowrap',
                        header.column.getCanSort() ? 'cursor-pointer hover:text-slate-700 dark:hover:text-slate-200' : ''
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' && <ChevronUp size={12} />}
                        {header.column.getIsSorted() === 'desc' && <ChevronDown size={12} />}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50 dark:border-slate-800">
                    {columns.map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className={cn('h-4 bg-slate-100 dark:bg-slate-700 rounded animate-pulse', j === 0 ? 'w-2/5' : 'w-3/5')} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-base text-slate-400 dark:text-slate-500">{emptyMessage}</td>
                </tr>
              ) : virtualize ? (
                <>
                  <tr aria-hidden style={{ height: `${rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px` }}><td /></tr>
                  {rowVirtualizer.getVirtualItems().map(virtualRow => {
                    const row = filteredRows[virtualRow.index]
                    return (
                      <tr
                        key={row.id}
                        ref={rowVirtualizer.measureElement}
                        data-index={virtualRow.index}
                        onClick={() => onRowClick?.(row.original)}
                        className={cn('border-b border-slate-50 dark:border-slate-800 transition-colors', onRowClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60' : '')}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-4 text-slate-700 dark:text-slate-300">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                  <tr aria-hidden style={{ height: `${rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems().at(-1)?.end ?? 0)}px` }}><td /></tr>
                </>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick?.(row.original)}
                    className={cn('border-b border-slate-50 dark:border-slate-800 last:border-0 transition-colors', onRowClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60' : '')}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination — only shown when not virtualizing */}
      {!virtualize && table.getPageCount() > 1 && (
        <div className="flex items-center justify-between text-base text-slate-500 dark:text-slate-400">
          <span>{table.getFilteredRowModel().rows.length} records</span>
          <div className="flex items-center gap-2">
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft size={16} />
            </button>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </span>
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
