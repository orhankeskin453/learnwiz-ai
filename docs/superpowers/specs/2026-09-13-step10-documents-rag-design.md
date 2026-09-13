# LearWizAI — Step 10: Documents, R2, Queue & RAG Design Spec

Binding authority for Step 10 (CLAUDE.md §48 item 10). Implements §12.1 (R2/Queue/
Vectorize), §15 (document pipeline), §10.1 (document chat as a learning feature),
§16 (documents/document_chunks), §30 (RAG safety). Admin Dashboard postponed.

## 1. Scope

IN: PDF upload (auth'd users, entitlement-gated) → R2 → Queue → consumer (unpdf text
extraction → chunking → Workers AI embeddings → Vectorize upsert) → status polling;
document list/detail/delete; per-document RAG chat with source attribution;
DocumentsPage UI; mock seams for embeddings/Vectorize/extraction in tests.

OUT: non-PDF formats (docx/txt — later), OCR for scanned PDFs, per-page rendering,
document chat conversation persistence (stateless Q&A v1, disclosed), OCR/see-and-
reason via vision models (Phase 2), cross-document search.

## 2. Decisions Summary

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                | Rationale                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| D1  | Upload: `POST /api/documents` multipart; PDF-only (magic bytes `%PDF-` + .pdf name), ≤10 MiB; R2 key `docs/{ownerKey}/{docId}.pdf`; D1 `documents` row (status queued) → enqueue `{documentId}`. Guest = 403 (§32: 0).                                                                                                                                                                                                                                  | §15 pipeline; §32 guest=No.                             |
| D2  | **Entitlement pilot allowance**: `DOCUMENTS_LIMITS = { guest: 0, free: 2, learner: 25, pro: 100 }` — §32 says Free=No, but billing lands at Step 11; the free=2 pilot makes Step 10 demonstrable and is a ONE-LINE config flip at Step 11. Disclosed in ledger + summary. Enforced via count of owned docs.                                                                                                                                             | §17 config-driven; honest deviation.                    |
| D3  | Queue consumer = thin wrapper over `processDocument(env, documentId)` service (tests call it directly — deterministic, no queue semantics in CI). Retries: queue-level max_retries 3; failures → status 'failed' + error text.                                                                                                                                                                                                                          | §15; deterministic CI.                                  |
| D4  | Extraction: `unpdf` (Workers-compatible pdf.js) — NEW dependency, justified (PDF parsing is genuinely non-trivial; no native alternative). Dynamic import keeps the main bundle lean.                                                                                                                                                                                                                                                                   | §23 "avoid unnecessary layers" — this one is necessary. |
| D5  | Chunking: ~1100 chars target, paragraph-boundary split with 150-char overlap; each chunk = one Vectorize vector + one `document_chunks` row (D1). Vector dims: 1024 (model-dependent — index + model pair documented as operator config).                                                                                                                                                                                                               | §15 chunk/embed/store.                                  |
| D6  | Embeddings: Workers AI, env-tunable `AI_EMBEDDING_MODEL` (default `@cf/qwen/qwen3-embedding-0.6b` per §13.5) — operator flips if the catalog name differs; batch per chunk set. Vectorize index per env (1024 dims, cosine), binding `VECTORIZE`.                                                                                                                                                                                                       | §13.5; §34 EmbeddingService seam.                       |
| D7  | Vectorize + embeddings behind service seams with test mocks (`AI_MOCK_RESPONSES` gains `vectors`; `VEC_MOCK_MATCHES` returns canned id/score matches) — deterministic CI, no catalog dependency.                                                                                                                                                                                                                                                        | Same pattern as the chat mock (Step 5).                 |
| D8  | RAG chat: `POST /api/documents/:id/chat {message, locale}` — doc must be processed + owned; embed question → Vectorize query (topK 4, no filter needed — index is per-env and ids carry docId prefix) → D1 chunk texts → answer prompt with §30 rules (retrieved content is untrusted; prioritize sources; say when the doc doesn't answer) → `{answer, sources: [{position, excerpt(≤200)}]}`. Stateless v1 (no conversation persistence — disclosed). | §15 chat pipeline; §30 safety.                          |
| D9  | Documents UI: upload form (file picker, client PDF check), list with status badges + poll-while-queued/processing, per-document chat panel. Namespace `documents` (en/tr). Entitlement copy for guests (§32: upgrade path).                                                                                                                                                                                                                             | §10.1; §36 states.                                      |
| D10 | Delete: R2 object + chunks + vectors + row (vectors deleted by id list from D1).                                                                                                                                                                                                                                                                                                                                                                        | §40.8-style deliberate deletion.                        |

## 3. Definition of Done (Step 10)

1. 3 queues + 3 Vectorize indexes created; bindings deployed; migration 0006 ×3.
2. Upload → queued → processed lifecycle green in tests (mock extraction/embeddings)
   and real-AI smoke on staging (real PDF, real embeddings, real Vectorize).
3. RAG chat returns sourced answers; §30 rules in the system prompt; sources shown.
4. DocumentsPage live (en/tr) with states; guest sees upgrade copy.
5. Gates green; comprehensive review dispatched; ledger closed with dispositions.
