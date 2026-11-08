import { Banner } from '@/components/feedback';

/** Shows the real result of a save: success only after the server confirmed it. */
export function SaveState({
  status,
  error,
}: {
  status: 'idle' | 'pending' | 'success' | 'error';
  error?: unknown;
}) {
  if (status === 'success') return <Banner tone="success" message="Saved." />;
  if (status === 'error') {
    const msg =
      error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
    return (
      <Banner
        tone="danger"
        message={`Not saved. ${/fetch|network/i.test(msg) ? "You're offline." : 'Please try again.'}`}
      />
    );
  }
  return null;
}
