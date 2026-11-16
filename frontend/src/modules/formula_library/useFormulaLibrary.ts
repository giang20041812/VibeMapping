import { useEffect, useState } from 'react';
import { loadFormulaLibrary } from './formula.service';
import type { FormulaLibrary } from './formula.types';

export function useFormulaLibrary() {
  const [library, setLibrary] = useState<FormulaLibrary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadFormulaLibrary()
      .then((result) => {
        if (!active) return;
        setLibrary(result);
        setError(null);
      })
      .catch(() => active && setError('Không tải được thư viện công thức.'))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return { library, isLoading, error };
}
