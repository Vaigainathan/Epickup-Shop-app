import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useState } from 'react';

export type LocationPickerResult = {
  address: string;
  latitude: number;
  longitude: number;
};

type LocationPickerContextValue = {
  pendingResult: LocationPickerResult | null;
  publishResult: (result: LocationPickerResult) => void;
  clearResult: () => void;
};

const LocationPickerContext = createContext<LocationPickerContextValue | null>(null);

export function LocationPickerProvider({ children }: PropsWithChildren) {
  const [pendingResult, setPendingResult] = useState<LocationPickerResult | null>(null);

  const publishResult = useCallback((result: LocationPickerResult) => {
    setPendingResult(result);
  }, []);

  const clearResult = useCallback(() => {
    setPendingResult(null);
  }, []);

  const value = useMemo(
    () => ({ pendingResult, publishResult, clearResult }),
    [clearResult, pendingResult, publishResult],
  );

  return <LocationPickerContext.Provider value={value}>{children}</LocationPickerContext.Provider>;
}

export function useLocationPicker() {
  const context = useContext(LocationPickerContext);
  if (!context) {
    throw new Error('useLocationPicker must be used inside LocationPickerProvider');
  }

  return context;
}
