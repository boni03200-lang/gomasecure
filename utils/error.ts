export const shouldSuppressError = (error: any): boolean => {
  if (!error) return false;
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    error?.name === 'AbortError' || 
    msg.includes('aborted') || 
    msg.includes('signal is aborted')
  );
};
