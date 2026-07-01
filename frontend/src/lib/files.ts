import { AxiosProgressEvent } from "axios"

import { api } from "./api"

export type StoredFile = {
  id: string
  original_name: string
  mime_type: string
  size: number
  version: number
  created_at: string
}

export type ShareLink = {
  url: string
  expires_in: number
}

export function isImageFile(file: StoredFile) {
  return file.mime_type === "image/png" || file.mime_type === "image/jpeg"
}

export async function listFiles() {
  const response = await api.get<StoredFile[]>("/files")
  return response.data
}

export async function uploadFile(file: File, onUploadProgress: (event: AxiosProgressEvent) => void) {
  const formData = new FormData()
  formData.append("file", file)

  const response = await api.post<StoredFile>("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress,
  })
  return response.data
}

export async function downloadFile(file: StoredFile) {
  const response = await api.get<Blob>(`/download/${file.id}`, {
    responseType: "blob",
  })
  return response.data
}

export async function deleteFile(fileId: string) {
  await api.delete(`/files/${fileId}`)
}

export async function createShareLink(fileId: string) {
  const response = await api.get<ShareLink>(`/share/${fileId}`, {
    params: {
      expires_minutes: 15,
    },
  })
  return response.data
}
