import { useState, useCallback } from 'react';

export const useHistory = <T,>(initialState: T) => {
  const [history, setHistory] = useState<T[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const state = history[currentIndex];
  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  const setState = useCallback((value: T) => {
    const currentState = history[currentIndex];

    // Perform a shallow comparison for our specific state object {name, content}
    if (currentState && typeof currentState === 'object' && value && typeof value === 'object') {
        const currentKeys = Object.keys(currentState);
        const nextKeys = Object.keys(value);
        if (currentKeys.length === nextKeys.length && currentKeys.every(key => (currentState as any)[key] === (value as any)[key])) {
            return; // State is identical, do nothing.
        }
    } else if (currentState === value) {
        return; // Also handle primitives
    }

    // When a new state is set after an undo, the "future" history is cleared.
    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push(value);
    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  }, [currentIndex, history]);

  const undo = useCallback(() => {
    setCurrentIndex(prevIndex => (prevIndex > 0 ? prevIndex - 1 : prevIndex));
  }, []);

  const redo = useCallback(() => {
    // We depend on `history` to know the upper bound.
    // The `history` object in the closure is from the render when this function was created.
    setCurrentIndex(prevIndex => (prevIndex < history.length - 1 ? prevIndex + 1 : prevIndex));
  }, [history]);

  const reset = useCallback((newState: T) => {
    setHistory([newState]);
    setCurrentIndex(0);
  }, []);

  return { state, setState, undo, redo, canUndo, canRedo, reset };
};
