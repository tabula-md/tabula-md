import { useCallback, useEffect, useRef } from "react";

type AnimationFrameTask = () => void;

export function useAnimationFrameTask() {
  const frameRef = useRef<number | null>(null);
  const taskQueueRef = useRef<AnimationFrameTask[]>([]);

  const cancelAnimationFrameTask = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    taskQueueRef.current = [];
  }, []);

  const queueAnimationFrameTask = useCallback((task: AnimationFrameTask) => {
    taskQueueRef.current = [...taskQueueRef.current, task];
    if (frameRef.current !== null) {
      return;
    }

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const tasks = taskQueueRef.current;
      taskQueueRef.current = [];
      tasks.forEach((queuedTask) => queuedTask());
    });
  }, []);

  useEffect(() => cancelAnimationFrameTask, [cancelAnimationFrameTask]);

  return queueAnimationFrameTask;
}
