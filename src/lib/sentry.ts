// Sentry is stripped in this local-only fork; errors go to the console.
export const isSentryEnabled = () => false;

export const logErrorToSentry = (
  error: unknown,
  context?: Record<string, unknown>
) => {
  console.error(error, context);
};
