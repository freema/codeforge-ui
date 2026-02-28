import { useQuery } from "@tanstack/react-query";
import { useApi } from "./useApi";

export function useTasks() {
  const api = useApi();

  return useQuery({
    queryKey: ["tasks"],
    queryFn: () => api.listTasks(),
    refetchInterval: 15_000,
  });
}
