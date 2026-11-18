import * as React from "react"

const cn = (...classes: (string | undefined | null | false)[]) => {
  return classes.filter(Boolean).join(' ')
}

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead 
    ref={ref} 
    className={cn(className)} 
    style={{
      borderBottom: '1px solid var(--color-border)',
      ...((props.style as any) || {})
    }}
    {...props} 
  />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => {
  const originalBgColor = (props.style as any)?.backgroundColor || '';
  const hasFixedBg = !!originalBgColor;
  const defaultBg = hasFixedBg ? originalBgColor : 'var(--table-row-bg)';

  return (
    <tr
      ref={ref}
      className={cn(
        "transition-all data-[state=selected]:bg-muted",
        className
      )}
      style={{
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: defaultBg,
        ...((props.style as any) || {}),
      }}
      onMouseEnter={(e) => {
        if (hasFixedBg || e.currentTarget.closest('thead')) return;

        const isDark = document.documentElement.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
          e.currentTarget.style.backgroundColor = '#2a2a2a';
        } else {
          e.currentTarget.style.backgroundColor = '#f1f5f9';
        }
      }}
      onMouseLeave={(e) => {
        if (hasFixedBg || e.currentTarget.closest('thead')) return;

        e.currentTarget.style.backgroundColor = defaultBg;
      }}
      {...props}
    />
  );
})
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-3 py-2 text-left align-middle [&:has([role=checkbox])]:pr-0",
      className
    )}
    style={{
      fontWeight: 600,
      fontSize: '0.875rem',
      letterSpacing: '0.025em',
      ...((props.style as any) || {})
    }}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("px-3 py-2 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
