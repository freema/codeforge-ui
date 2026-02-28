import { useEffect, useRef, useState, useCallback } from "react";
import { connectToTaskStream } from "../lib/stream";
import { useAuth } from "../context/AuthContext";
import type { StreamEvent, TaskStatus } from "../types";

interface StreamState {
  events: StreamEvent[];
  connected: boolean;
  taskStatus: TaskStatus | null;
  error: string | null;
}

export function useTaskStream(taskId: string | undefined) {
  const { serverUrl, token } = useAuth();
  const [state, setState] = useState<StreamState>({
    events: [],
    connected: false,
    taskStatus: null,
    error: null,
  });
  const controllerRef = useRef<AbortController | null>(null);

  const connect = useCallback(() => {
    if (!taskId) return;

    controllerRef.current?.abort();

    const controller = connectToTaskStream(serverUrl, taskId, token, {
      onConnected: (data) => {
        setState((prev) => ({
          ...prev,
          connected: true,
          taskStatus: data.status,
          error: null,
        }));
      },
      onEvent: (event) => {
        setState((prev) => ({
          ...prev,
          events: [...prev.events, event],
        }));
      },
      onDone: (data) => {
        setState((prev) => ({
          ...prev,
          connected: false,
          taskStatus: data.status,
        }));
      },
      onError: (err) => {
        setState((prev) => ({
          ...prev,
          connected: false,
          error: err.message,
        }));
      },
    });

    controllerRef.current = controller;
  }, [taskId, serverUrl, token]);

  useEffect(() => {
    connect();
    return () => controllerRef.current?.abort();
  }, [connect]);

  const reconnect = useCallback(() => {
    setState((prev) => ({ ...prev, events: [], error: null }));
    connect();
  }, [connect]);

  return { ...state, reconnect };
}
