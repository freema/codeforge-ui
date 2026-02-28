import { useQuery } from "@tanstack/react-query";
import { useApi } from "./useApi";
import type { TaskStatus } from "../types";

const ACTIVE_STATUSES: TaskStatus[] = [
  "pending",
  "cloning",
  "running",
  "awaiting_instruction",
  "creating_pr",
  "cancelling",
];

export function useTask(id: string | undefined, include?: string) {
  const api = useApi();

  return useQuery({
    queryKey: ["task", id, include],
    queryFn: () => api.getTask(id!, include),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && ACTIVE_STATUSES.includes(status)) return 5000;
      return false;
    },
  });
}
