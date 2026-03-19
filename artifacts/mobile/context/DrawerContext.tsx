import React, { createContext, useCallback, useContext, useRef } from 'react';
import { Animated } from 'react-native';

interface DrawerContextValue {
  isOpen: boolean;
  animValue: Animated.Value;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const animValue = useRef(new Animated.Value(0)).current;
  const isOpenRef = useRef(false);
  const [isOpen, setIsOpen] = React.useState(false);

  const open = useCallback(() => {
    isOpenRef.current = true;
    setIsOpen(true);
    Animated.timing(animValue, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [animValue]);

  const close = useCallback(() => {
    isOpenRef.current = false;
    Animated.timing(animValue, {
      toValue: 0,
      duration: 280,
      useNativeDriver: true,
    }).start(() => setIsOpen(false));
  }, [animValue]);

  const toggle = useCallback(() => {
    if (isOpenRef.current) {
      close();
    } else {
      open();
    }
  }, [open, close]);

  return (
    <DrawerContext.Provider value={{ isOpen, animValue, open, close, toggle }}>
      {children}
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error('useDrawer must be used inside DrawerProvider');
  return ctx;
}
