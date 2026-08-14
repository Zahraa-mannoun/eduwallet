export function SkeletonRows({
  rows = 5,
  columns,
  avatarColumn = true,
}: {
  rows?: number;
  columns: number;
  // Most tables now lead with an avatar + name/email column — shape the first skeleton cell to
  // match instead of a plain bar, so the loading state doesn't visibly "jump" once real rows land.
  avatarColumn?: boolean;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="px-6 py-4">
              {colIndex === 0 && avatarColumn ? (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-200" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-28 animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-36 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              ) : (
                <div className="h-4 max-w-[140px] animate-pulse rounded bg-slate-200" />
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
