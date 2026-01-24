import { useState, useEffect, useRef, useCallback } from 'react';

interface UseTimerOptions {
  autoStart?: boolean;
  onComplete?: () => void;
}

interface TimerState {
  seconds: number;
  isRunning: boolean;
  isComplete: boolean;
}

export function useTimer(
  initialSeconds: number,
  options: UseTimerOptions = {}
) {
  const { autoStart = false, onComplete } = options;

  const [state, setState] = useState<TimerState>({
    seconds: initialSeconds,
    isRunning: autoStart,
    isComplete: false,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const start = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: true }));
  }, []);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: false }));
  }, []);

  const reset = useCallback(() => {
    setState({
      seconds: initialSeconds,
      isRunning: false,
      isComplete: false,
    });
  }, [initialSeconds]);

  const toggle = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: !prev.isRunning }));
  }, []);

  useEffect(() => {
    if (state.isRunning && state.seconds > 0) {
      intervalRef.current = setInterval(() => {
        setState((prev) => {
          if (prev.seconds <= 1) {
            onCompleteRef.current?.();
            return { ...prev, seconds: 0, isRunning: false, isComplete: true };
          }
          return { ...prev, seconds: prev.seconds - 1 };
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [state.isRunning]);

  const formatTime = useCallback((totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  return {
    ...state,
    formattedTime: formatTime(state.seconds),
    start,
    pause,
    reset,
    toggle,
  };
}
