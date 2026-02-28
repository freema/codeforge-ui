import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./useApi";
import type { CreateTaskRequest } from "../types";

export function useCreateTask() {
  const api = useApi();

  return useMutation({
    mutationFn: (req: CreateTaskRequest) => api.createTask(req),
  });
}

export function useCancelTask() {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.cancelTask(id),
    onSuccess: (_data, id) => qc.invalidateQueries({ queryKey: ["task", id] }),
  });
}

export function useInstructTask() {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, prompt }: { id: string; prompt: string }) =>
      api.instructTask(id, prompt),
    onSuccess: (_data, { id }) =>
      qc.invalidateQueries({ queryKey: ["task", id] }),
  });
}

export function useCreatePR() {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...req
    }: {
      id: string;
      title?: string;
      description?: string;
      target_branch?: string;
    }) => api.createPR(id, req),
    onSuccess: (_data, { id }) =>
      qc.invalidateQueries({ queryKey: ["task", id] }),
  });
}

export function useReviewTask() {
  const api = useApi();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      cli,
      model,
    }: {
      id: string;
      cli?: string;
      model?: string;
    }) => api.reviewTask(id, { cli, model }),
    onSuccess: (_data, { id }) =>
      qc.invalidateQueries({ queryKey: ["task", id] }),
  });
}
