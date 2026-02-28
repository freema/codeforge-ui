import { useQuery } from "@tanstack/react-query";
import { useApi } from "./useApi";

export function useTaskTypes() {
  const api = useApi();

  return useQuery({
    queryKey: ["task-types"],
    queryFn: () => api.listTaskTypes(),
    staleTime: 5 * 60_000,
  });
}
