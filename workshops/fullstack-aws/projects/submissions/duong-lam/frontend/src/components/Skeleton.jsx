// A grey placeholder shaped like the content that's coming. Feels faster than a spinner,
// because the page keeps its layout while it loads.
export default function Skeleton({ height = 16, width = '100%', radius = 8, className = '' }) {
  return <div className={`skeleton ${className}`} style={{ height, width, borderRadius: radius }} aria-hidden="true" />
}

// The customer's one page while it loads: hello, balance + move money, accounts, activity.
export function HomeSkeleton() {
  return (
    <div className="page" role="status" aria-label="Loading your accounts">
      <div>
        <Skeleton height={16} width={120} />
        <Skeleton height={34} width={240} className="sk-gap" />
      </div>
      <div className="grid-2">
        <Skeleton height={300} radius={20} />
        <Skeleton height={300} radius={20} />
      </div>
      <div className="account-grid">
        <Skeleton height={200} radius={18} />
        <Skeleton height={200} radius={18} />
      </div>
      <div className="grid-2 wide-left">
        <Skeleton height={360} radius={20} />
        <Skeleton height={360} radius={20} />
      </div>
    </div>
  )
}

// The staff page while it loads: KPI tiles, two cards, the sign-in log.
export function AdminSkeleton() {
  return (
    <div className="page" role="status" aria-label="Loading command center">
      <Skeleton height={34} width={260} />
      <div className="kpis">
        {[1, 2, 3, 4, 5].map((n) => <Skeleton key={n} height={104} radius={16} />)}
      </div>
      <div className="grid-2">
        <Skeleton height={420} radius={20} />
        <Skeleton height={420} radius={20} />
      </div>
      <Skeleton height={260} radius={20} />
    </div>
  )
}
