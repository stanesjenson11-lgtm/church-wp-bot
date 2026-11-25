"use client";
// TanStack Table returns functions React Compiler cannot safely memoize; this
// is the library's documented opt-out for that specific interaction.
"use no memo";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  rows: TData[];
  /** Text, or an <EmptyState> with its next action. */
  emptyMessage?: React.ReactNode;
};

/**
 * Renders whatever rows it is handed.
 *
 * It deliberately does NO filtering, sorting or pagination of its own. Every
 * one of those happens in SQL, because a client-side table model needs the
 * whole dataset in the browser first — which for this application means
 * shipping the entire member directory to anyone who opens the page.
 */
export function DataTable<TData, TValue>({
  columns,
  rows,
  emptyMessage = "Nothing to show.",
}: Props<TData, TValue>) {
  // TanStack Table returns functions React Compiler cannot memoize. The
  // "use no memo" directive at the top of this file is the library's
  // documented opt-out; this silences the lint rule reporting the same thing.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
