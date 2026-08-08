import { createContext, useContext, useState, type ReactNode } from 'react';

// Lives above the router (see App.tsx) so the header search box — rendered once in Layout,
// visible on every protected route — and HomePage's product grid always share the same query,
// without threading it through route params for a single-page catalog.
interface SearchContextValue {
  query: string;
  setQuery: (query: string) => void;
}

const SearchContext = createContext<SearchContextValue | undefined>(undefined);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');

  return <SearchContext.Provider value={{ query, setQuery }}>{children}</SearchContext.Provider>;
}

export function useSearch(): SearchContextValue {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}
