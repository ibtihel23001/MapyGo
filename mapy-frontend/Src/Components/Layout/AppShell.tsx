import { Outlet } from 'react-router-dom'
import Sidebar from './sidebar'
import Header from './header'

export default function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-secondary">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
