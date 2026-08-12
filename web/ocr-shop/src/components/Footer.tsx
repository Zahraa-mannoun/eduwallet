export function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 border-b border-slate-100 pb-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 text-base shadow-sm">
              🔍
            </div>
            <div className="leading-tight">
              <p className="font-extrabold tracking-tight text-primary-700">ScanMart</p>
              <p className="text-xs text-slate-400">The student essentials store</p>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            Payments powered by <span className="font-semibold text-primary-600">EduWallet</span>
          </p>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400 sm:text-left">
          Demo prototype — no real money processing
        </p>
      </div>
    </footer>
  );
}
