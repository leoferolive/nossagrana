interface ErrorBannerProps {
  error: string | null;
}

export const ErrorBanner = ({ error }: ErrorBannerProps) => {
  if (!error) return null;

  return (
    <div
      role="alert"
      className="mx-4 mt-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
    >
      {error}
    </div>
  );
};
