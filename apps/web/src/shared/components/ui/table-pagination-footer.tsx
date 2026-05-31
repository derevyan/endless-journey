/**
 * Table Pagination Footer Component
 *
 * Reusable pagination controls for data tables.
 * Includes page size selector, page info, and navigation buttons.
 *
 * @module shared/components/ui/table-pagination-footer
 */

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";

// =============================================================================
// TYPES
// =============================================================================

export interface TablePaginationFooterProps {
  /** Total number of items (after filtering) */
  totalCount: number;
  /** Current page index (0-based) */
  currentPageIndex: number;
  /** Total number of pages */
  pageCount: number;
  /** Current page size */
  pageSize: number;
  /** Callback when page changes */
  onPageChange: (pageIndex: number) => void;
  /** Callback when page size changes */
  onPageSizeChange: (pageSize: number) => void;
  /** Label for items (e.g., "event", "activity") - will be pluralized */
  itemLabel?: string;
  /** Available page size options */
  pageSizeOptions?: number[];
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TablePaginationFooter({
  totalCount,
  currentPageIndex,
  pageCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = "item",
  pageSizeOptions = [10, 20, 30, 40, 50],
}: TablePaginationFooterProps) {
  const isFirstPage = currentPageIndex === 0;
  const isLastPage = currentPageIndex >= pageCount - 1;

  return (
    <div className="flex flex-col gap-2 pt-1.5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="pl-4">
        {totalCount} {itemLabel}{totalCount !== 1 ? "s" : ""} total
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex items-center gap-2">
          <span className="hidden text-sm sm:block">Rows per page</span>
          <Select value={`${pageSize}`} onValueChange={(value) => onPageSizeChange(Number(value))}>
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-center text-sm">
          Page {currentPageIndex + 1} of {pageCount}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => onPageChange(0)}
            disabled={isFirstPage}
          >
            <span className="sr-only">Go to first page</span>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(Math.max(currentPageIndex - 1, 0))}
            disabled={isFirstPage}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(Math.min(currentPageIndex + 1, pageCount - 1))}
            disabled={isLastPage}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => onPageChange(pageCount - 1)}
            disabled={isLastPage}
          >
            <span className="sr-only">Go to last page</span>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
