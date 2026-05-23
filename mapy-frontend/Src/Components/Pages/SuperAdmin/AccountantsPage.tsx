// AccountantsPage.tsx — superadmin view (read-only list)
import { useState } from 'react'
import { useAccountants } from '../../../API/hooks'
import { PageHeader, SearchInput, Spinner, EmptyState, Pagination } from '../../shared'
import { fDate } from '../../utils/format'
import type { User } from '../../types'

export default function SuperadminAccountantsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading } = useAccountants({ page, search })

  return (
    <div>
      <PageHeader title="Accountants" subtitle="All accountants across agencies" />
      <div className="card">
        <div className="card-header"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} /></div>
        {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Agency</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>
                {!data?.data.length && <tr><td colSpan={5}><EmptyState /></td></tr>}
                {data?.data.map((u: User) => (
                  <tr key={u.id}>
                    <td><div className="font-medium">{u.firstName} {u.lastName}</div><div className="text-xs text-slate-400">@{u.username}</div></td>
                    <td>{u.email}</td>
                    <td>{u.agency?.name ?? '—'}</td>
                    <td><span className={u.isActive ? 'badge-green' : 'badge-red'}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td>{fDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={data?.meta.totalPages ?? 1} onPage={setPage} />
      </div>
    </div>
  )
}
