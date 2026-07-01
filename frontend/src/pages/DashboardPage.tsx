import { LogOut } from "lucide-react"

import { useAuth } from "../auth/AuthContext"

export default function DashboardPage() {
  const { user, logout } = useAuth()

  return (
    <main className="min-h-screen bg-cloud">
      <header className="border-b border-mint bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-coral">
              Pixel Breeders
            </p>
            <h1 className="mt-1 text-xl font-semibold text-ink">File Manager</h1>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-md border border-mint px-3 py-2 text-sm font-semibold text-ink transition hover:border-moss hover:text-moss"
            type="button"
            onClick={logout}
          >
            <LogOut aria-hidden="true" size={16} />
            Sair
          </button>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <div className="rounded-lg bg-white p-6 shadow-panel">
          <p className="text-sm text-slate-600">Usuario autenticado</p>
          <p className="mt-2 text-lg font-semibold text-ink">{user?.email}</p>
        </div>
      </section>
    </main>
  )
}
