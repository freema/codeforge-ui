const STORAGE_KEY = "codeforge_task_ids";

export function getTrackedTaskIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    // ignore
  }
  return [];
}

export function trackTaskId(id: string): void {
  const ids = getTrackedTaskIds();
  if (!ids.includes(id)) {
    ids.unshift(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }
}

export function removeTrackedTaskId(id: string): void {
  const ids = getTrackedTaskIds().filter((i) => i !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}
