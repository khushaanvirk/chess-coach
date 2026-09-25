// Analytics are stripped in this local-only fork. Kept as a no-op so the
// upstream call sites stay untouched and upstream merges stay clean.
export const logAnalyticsEvent: (
  eventName: string,
  eventParams?: Record<string, unknown>
) => Promise<void> = async () => {};
