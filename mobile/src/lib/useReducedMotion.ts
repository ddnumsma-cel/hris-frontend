import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** True when the phone asks for reduced motion: slide and fade animations snap instead. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}
