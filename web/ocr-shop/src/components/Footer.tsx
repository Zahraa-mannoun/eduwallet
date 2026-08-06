export function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-base">
              🔍
            </div>
            <span className="font-bold text-primary-600">ScanMart</span>
          </div>
          <p className="text-sm text-slate-500">
            Payments powered by <span className="font-semibold text-primary-600">EduWallet</span>
          </p>
          <p className="text-xs text-slate-400">Demo prototype — no real money processing</p>
        </div>
      </div>
    </footer>
  );
}
