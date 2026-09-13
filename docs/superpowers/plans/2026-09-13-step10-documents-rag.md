# LearWizAI — Step 10 Plan: Documents, R2, Queue & RAG

Spec (binding): docs/superpowers/specs/2026-09-13-step10-documents-rag-design.md
Execution: controller-implemented, single comprehensive review at step close.
Ledger: .superpowers/sdd/2026-09-13-step10-documents-rag/progress.md.

- **T1**: infra — 3× queues + 3× vectorize indexes (wrangler CLI); wrangler.jsonc
  bindings (queue producer/consumer, VECTORIZE) ×3 envs; migration 0006
  (documents, document_chunks); unpdf dep; entitlements DOCUMENTS_LIMITS (D2 pilot).
- **T2**: contracts — types (DocumentSummary/Detail/RagSource/ChatRequest),
  validation (chat schema), client mock seams (embedding vectors, vectorize matches).
- **T3**: services — `services/documents.ts` (upload validation + R2 + row + enqueue,
  chunker, processDocument: extract→chunk→embed→vectorize→chunks rows),
  `services/ai/embeddings.ts` (runEmbeddings with mock seam), `services/rag.ts`
  (vectorize query seam + context build + RAG answer).
- **T4**: `routes/documents.ts` (upload/list/detail/delete/chat) + queue consumer in
  index.ts (thin wrapper over processDocument).
- **T5**: DocumentsPage (upload, status-polling list, per-doc chat) + documents
  namespace en/tr + routes swap.
- **T6**: tests (upload validation, processDocument lifecycle, RAG chat, ownership)
  - gates + commit + deploy.
- **T7**: real smoke on staging (real PDF → processed → sourced answer) +
  comprehensive review + ledger closure.
