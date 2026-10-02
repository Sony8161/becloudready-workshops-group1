export function FullPageSpinner() {
  return (
    <div className="flex h-full items-center justify-center" role="status" aria-label="Loading">
      <div className="size-8 animate-spin rounded-full border-2 border-gray-200 border-t-brand-600" />
    </div>
  )
}
