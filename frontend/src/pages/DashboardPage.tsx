import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react"
import {
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  LogOut,
  Trash2,
  Upload,
} from "lucide-react"

import { useAuth } from "../auth/AuthContext"
import {
  createShareLink,
  deleteFile,
  downloadFile,
  isImageFile,
  listFiles,
  StoredFile,
  uploadFile,
} from "../lib/files"

const ACCEPTED_TYPES = ".png,.jpg,.pdf,.txt"

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value))
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [files, setFiles] = useState<StoredFile[]>([])
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState("")
  const [shareLink, setShareLink] = useState<{ fileId: string; url: string } | null>(null)
  const [busyFileId, setBusyFileId] = useState<string | null>(null)

  const imageFiles = useMemo(() => files.filter(isImageFile), [files])

  async function refreshFiles() {
    setError("")
    const data = await listFiles()
    setFiles(data)
  }

  useEffect(() => {
    refreshFiles()
      .catch(() => setError("Nao foi possivel carregar seus arquivos."))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    let isActive = true
    const createdUrls: string[] = []

    async function loadPreviews() {
      const entries = await Promise.all(
        imageFiles.map(async (file) => {
          try {
            const blob = await downloadFile(file)
            const url = URL.createObjectURL(blob)
            createdUrls.push(url)
            return [file.id, url] as const
          } catch {
            return [file.id, ""] as const
          }
        }),
      )

      if (isActive) {
        setPreviewUrls(Object.fromEntries(entries.filter(([, url]) => Boolean(url))))
      }
    }

    loadPreviews()

    return () => {
      isActive = false
      createdUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [imageFiles])

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) {
      return
    }

    setError("")
    setShareLink(null)
    setUploadProgress(0)
    setIsUploading(true)

    try {
      await uploadFile(selectedFile, (progressEvent) => {
        if (!progressEvent.total) {
          return
        }
        setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total))
      })
      await refreshFiles()
      setUploadProgress(100)
    } catch {
      setError("Falha no upload. Use .png, .jpg, .pdf ou .txt com ate 10MB.")
    } finally {
      setIsUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ""
      }
    }
  }

  async function handleDownload(file: StoredFile) {
    setBusyFileId(file.id)
    setError("")

    try {
      const blob = await downloadFile(file)
      saveBlob(blob, file.original_name)
    } catch {
      setError("Nao foi possivel baixar o arquivo.")
    } finally {
      setBusyFileId(null)
    }
  }

  async function handleDelete(file: StoredFile) {
    setBusyFileId(file.id)
    setError("")
    setShareLink(null)

    try {
      await deleteFile(file.id)
      await refreshFiles()
    } catch {
      setError("Nao foi possivel deletar o arquivo.")
    } finally {
      setBusyFileId(null)
    }
  }

  async function handleShare(file: StoredFile) {
    setBusyFileId(file.id)
    setError("")

    try {
      const link = await createShareLink(file.id)
      setShareLink({ fileId: file.id, url: link.url })
      await navigator.clipboard?.writeText(link.url)
    } catch {
      setError("Nao foi possivel gerar o link.")
    } finally {
      setBusyFileId(null)
    }
  }

  return (
    <main className="min-h-screen bg-cloud">
      <header className="border-b border-mint bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-coral">
              Pixel Breeders
            </p>
            <h1 className="mt-1 text-xl font-semibold text-ink">File Manager</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:inline">{user?.email}</span>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-mint px-3 py-2 text-sm font-semibold text-ink transition hover:border-moss hover:text-moss"
              type="button"
              onClick={logout}
            >
              <LogOut aria-hidden="true" size={16} />
              Sair
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:px-6">
        <div className="rounded-lg bg-white p-5 shadow-panel">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">Meus Arquivos</h2>
              <p className="mt-1 text-sm text-slate-600">PNG, JPG, PDF ou TXT de ate 10MB.</p>
            </div>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-moss px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink">
              <Upload aria-hidden="true" size={18} />
              {isUploading ? "Enviando..." : "Enviar arquivo"}
              <input
                ref={inputRef}
                className="sr-only"
                type="file"
                accept={ACCEPTED_TYPES}
                disabled={isUploading}
                onChange={handleUpload}
              />
            </label>
          </div>

          {(isUploading || uploadProgress > 0) && (
            <div className="mt-5">
              <div className="h-3 overflow-hidden rounded-full bg-mint">
                <div
                  className="h-full rounded-full bg-coral transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="mt-2 text-sm font-medium text-moss">{uploadProgress}%</p>
            </div>
          )}

          {error && <p className="mt-5 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          {shareLink && (
            <div className="mt-5 rounded-md border border-mint bg-cloud p-4">
              <p className="text-sm font-semibold text-ink">Link temporario copiado</p>
              <a
                className="mt-2 block break-all text-sm text-moss underline"
                href={shareLink.url}
                target="_blank"
                rel="noreferrer"
              >
                {shareLink.url}
              </a>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow-panel">
          {isLoading ? (
            <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-moss">
              <Loader2 className="animate-spin" aria-hidden="true" size={18} />
              Carregando arquivos...
            </div>
          ) : files.length === 0 ? (
            <div className="grid min-h-48 place-items-center px-6 text-center">
              <div>
                <FileText className="mx-auto text-moss" aria-hidden="true" size={34} />
                <p className="mt-3 font-semibold text-ink">Nenhum arquivo enviado</p>
                <p className="mt-1 text-sm text-slate-600">Use o botao de upload para comecar.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left">
                <thead className="bg-cloud text-xs uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Preview</th>
                    <th className="px-5 py-4 font-semibold">Nome</th>
                    <th className="px-5 py-4 font-semibold">Tamanho</th>
                    <th className="px-5 py-4 font-semibold">Versao</th>
                    <th className="px-5 py-4 font-semibold">Upload</th>
                    <th className="px-5 py-4 text-right font-semibold">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mint">
                  {files.map((file) => {
                    const isBusy = busyFileId === file.id
                    const previewUrl = previewUrls[file.id]

                    return (
                      <tr key={file.id} className="align-middle">
                        <td className="px-5 py-4">
                          <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-md border border-mint bg-cloud">
                            {previewUrl ? (
                              <img
                                className="h-full w-full object-cover"
                                src={previewUrl}
                                alt={file.original_name}
                              />
                            ) : isImageFile(file) ? (
                              <ImageIcon className="text-moss" aria-hidden="true" size={22} />
                            ) : (
                              <FileText className="text-moss" aria-hidden="true" size={22} />
                            )}
                          </div>
                        </td>
                        <td className="max-w-xs px-5 py-4">
                          <p className="truncate font-medium text-ink">{file.original_name}</p>
                          <p className="mt-1 text-sm text-slate-500">{file.mime_type}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-700">{formatFileSize(file.size)}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-moss">v{file.version}</td>
                        <td className="px-5 py-4 text-sm text-slate-700">{formatDate(file.created_at)}</td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              className="grid h-9 w-9 place-items-center rounded-md border border-mint text-ink transition hover:border-moss hover:text-moss disabled:cursor-not-allowed disabled:opacity-50"
                              type="button"
                              title="Baixar"
                              disabled={isBusy}
                              onClick={() => handleDownload(file)}
                            >
                              <Download aria-hidden="true" size={16} />
                            </button>
                            <button
                              className="grid h-9 w-9 place-items-center rounded-md border border-mint text-ink transition hover:border-moss hover:text-moss disabled:cursor-not-allowed disabled:opacity-50"
                              type="button"
                              title="Gerar link"
                              disabled={isBusy}
                              onClick={() => handleShare(file)}
                            >
                              <LinkIcon aria-hidden="true" size={16} />
                            </button>
                            {shareLink?.fileId === file.id && (
                              <a
                                className="grid h-9 w-9 place-items-center rounded-md border border-mint text-ink transition hover:border-moss hover:text-moss"
                                href={shareLink.url}
                                target="_blank"
                                rel="noreferrer"
                                title="Abrir ultimo link gerado"
                              >
                                <ExternalLink aria-hidden="true" size={16} />
                              </a>
                            )}
                            <button
                              className="grid h-9 w-9 place-items-center rounded-md border border-red-100 text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              type="button"
                              title="Deletar"
                              disabled={isBusy}
                              onClick={() => handleDelete(file)}
                            >
                              <Trash2 aria-hidden="true" size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
