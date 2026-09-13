import type { DocumentChatResponse, DocumentStatus, RagSource } from "@learwizai/types";
import { apiClient } from "./apiClient";

/** Documents API wrappers (CLAUDE.md §10.1, §12.1, §15). */

export interface DocumentInfo {
  id: string;
  title: string;
  status: DocumentStatus;
  createdAt: string;
}

export async function uploadDocument(file: File, locale: string): Promise<{ documentId: string }> {
  return apiClient
    .post<DocumentResponse>(`/api/documents?locale=${locale}`, {
      headers: { "content-type": "application/pdf" },
      body: file,
    })
    .then((r: { documentId: string }) => ({ documentId: r.documentId }));
}

interface DocumentResponse {
  documentId: string;
  status: string;
}

export async function listDocuments(): Promise<DocumentInfo[]> {
  return apiClient.get<DocumentInfo[]>("/api/documents");
}

export async function deleteDocument(id: string): Promise<void> {
  await apiClient.delete(`/api/documents/${id}`);
}

export async function chatWithDocument(
  id: string,
  message: string,
  locale: string,
): Promise<DocumentChatResponse> {
  return apiClient.post<DocumentChatResponse>(`/api/documents/${id}/chat`, {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, locale }),
  });
}

export type { RagSource };
