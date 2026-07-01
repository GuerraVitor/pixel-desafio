import { FormEvent, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { UserPlus } from "lucide-react"

import { useAuth } from "../auth/AuthContext"

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setIsSubmitting(true)

    try {
      await register({ email, password })
      navigate("/dashboard", { replace: true })
    } catch {
      setError("Nao foi possivel criar a conta.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cloud px-4 py-10">
      <section className="w-full max-w-md rounded-lg bg-white p-8 shadow-panel">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-coral">
            Pixel Breeders
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-ink">Criar conta</h1>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-ink">Email</span>
            <input
              className="mt-2 w-full rounded-md border border-mint bg-white px-4 py-3 text-ink outline-none transition focus:border-moss focus:ring-2 focus:ring-mint"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-ink">Senha</span>
            <input
              className="mt-2 w-full rounded-md border border-mint bg-white px-4 py-3 text-ink outline-none transition focus:border-moss focus:ring-2 focus:ring-mint"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          {error && <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-moss px-4 py-3 font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-70"
            type="submit"
            disabled={isSubmitting}
          >
            <UserPlus aria-hidden="true" size={18} />
            {isSubmitting ? "Criando..." : "Criar conta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Ja tem conta?{" "}
          <Link className="font-semibold text-moss hover:text-ink" to="/login">
            Entrar
          </Link>
        </p>
      </section>
    </main>
  )
}
