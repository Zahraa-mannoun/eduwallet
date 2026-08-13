export function SkeletonRows({ rows = 5, columns }: { rows?: number; columns: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="px-4 py-3">
              <div className="h-4 max-w-[140px] animate-pulse rounded bg-slate-200" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
