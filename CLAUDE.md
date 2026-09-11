# LearWizAI — Claude Code Project Specification

> This file is the single source of truth for implementing LearWizAI.
> Follow the architecture, product rules, UX rules, security rules, and coding conventions below unless a newer explicit project decision replaces them.
>
> **Important:** The first implementation should be production-minded, but this is still an MVP. Prefer simple, maintainable Cloudflare-native solutions over unnecessary infrastructure.

---

## 1. Product Overview

**Product:** LearWizAI

**Positioning:** An AI-powered personal learning platform that acts like a personal teacher rather than a generic chatbot.

Core learning loop:

```text
Learn → Understand → Practice → Get Feedback → Master → Get Recommendation
```

The product should answer one question on every major screen:

> **What should the learner do next?**

LearWizAI is not a generic ChatGPT clone. AI interactions must be designed around learning actions, structured lessons, practice, assessment, feedback, and mastery.

---

## 2. Product Principles

1. **Value before registration**
   - Do not force account creation on first visit.
   - Users can try core functionality anonymously.
   - Ask for registration after meaningful usage or when persistence/premium functionality requires an account.

2. **AI teacher, not AI chatbot**
   - AI Tutor should support actions such as Explain, Simplify, Give Example, Quiz Me, Give Exercise, and Summarize.
   - Learn Mode should be structured and pedagogical rather than chat-only.

3. **Cloudflare-first architecture**
   - Prefer Cloudflare-native services for compute, database, storage, vector search, queues, state, security, observability, and deployment.

4. **Localization from day one**
   - English and Turkish are supported from the first implementation.
   - All new UI content must be localization-ready.

5. **Provider-agnostic business logic**
   - Payment/business logic must not depend directly on Polar APIs.
   - Polar is the initial payment provider implementation.

6. **Security and abuse protection are mandatory**
   - Rate limiting, entitlement enforcement, AI budget controls, tenant isolation, validation, webhook verification, and abuse prevention are part of the core architecture.

7. **Mobile-first**
   - Learners must have a strong mobile experience.

8. **OpenDesign is for later polish**
   - First build the functional design system and consistent UX described here.
   - Do not wait for a visual-polish tool or redesign before implementing the architecture.

---

# 3. MVP Scope

## 3.1 Core Features

1. Authentication
2. Guest / anonymous usage
3. Dashboard
4. AI Tutor
5. Learn Mode
6. Practice Mode
7. AI Quiz Generator
8. PDF / document upload
9. Document Chat / RAG
10. AI Summary / Notes
11. Progress Tracking
12. Topic Mastery
13. AI Recommendations
14. Subscription / billing
15. Localization (English + Turkish)

## 3.2 Phase 2

- Flashcards
- Spaced repetition
- Advanced document chat
- Image question solving
- Voice Tutor
  - Speech-to-text
  - Text-to-speech
- More advanced learning analytics

## 3.3 Phase 3

Adaptive Learning Engine:

```text
Performance
   ↓
Topic Mastery
   ↓
Weak Areas
   ↓
Personalized Recommendation
   ↓
Next Lesson / Practice / Review
```

Do not overbuild the Phase 3 system during MVP. Create clean interfaces so it can be introduced later.

---

# 4. User Journey

## 4.1 New Visitor

```text
Landing
  ↓
Start Learning
  ↓
Guest Session
  ↓
Use core features
  ↓
Meaningful value
  ↓
Guest limit / persistence requirement
  ↓
Create Account / Log In
  ↓
Guest data migration
  ↓
Free Plan
```

Registration is a **conversion point**, not an entry barrier.

## 4.2 Guest vs Free User

These states are intentionally different:

```text
Guest ≠ Free User
```

### Guest

- Anonymous
- Temporary session
- No persistent `users` record
- Limited AI usage
- Can try core learning functionality
- Some features require account creation

### Free User

- Registered `users` record
- Persistent learning history
- Free-plan entitlements
- Account-bound progress
- Can later upgrade to Learner or Pro

---

# 5. Guest Session Architecture

Do not create a permanent user record for first-time anonymous users.

Use a signed/secure session cookie such as:

```text
learwiz_guest_session
```

Cookie requirements:

- HttpOnly
- Secure in production
- SameSite=Lax or stricter where compatible
- Reasonable expiration
- Random unguessable identifier

Guest session concept:

```text
GuestSession
- id
- created_at
- expires_at
- usage_count
- ip_hash (only when needed for abuse prevention)
- migration_status
```

Potential guest data can reference `guest_session_id`.

## 5.1 Initial Guest Entitlements

Target MVP defaults:

| Capability | Guest |
|---|---:|
| AI Tutor | 3 AI interactions |
| Learn Mode | 1 learning topic/session |
| Practice Mode | 3 questions |
| Quiz Generator | 1 quiz |
| PDF Upload | No |
| Document RAG | No |
| Persistent Progress | No |
| Account required | Only when persistence / restricted feature is reached |

These values must be configuration/entitlement data, not frontend hardcoded rules.

The exact guest limits may be tuned after real usage data.

## 5.2 Guest → User Migration

On signup or login:

```text
Guest Session
  ↓
validate session
  ↓
check expiration / ownership / abuse controls
  ↓
create or authenticate user
  ↓
migrate eligible guest data
  ↓
commit transaction
  ↓
invalidate guest session
```

Migrate eligible data such as:

- conversations
- quiz attempts/results
- practice results
- learning history
- temporary preferences

Do not migrate temporary/unsafe/internal data that should not become permanent user state.

Migration must be:

- transactional where possible
- idempotent
- protected against duplicate execution
- rate-limited
- validated

---

# 6. Localization / i18n

Supported locales:

```text
en
tr
```

English is the default fallback.

## 6.1 Requirements

- Never hardcode user-facing text in React components.
- Every new UI string must exist in both English and Turkish.
- Missing translations fall back to English.
- Validation messages are localized.
- Error messages shown to users are localized.
- Loading/empty/error states are localized.
- Email/notification templates must be localization-ready.
- AI-generated content should respect the active locale.
- Date, time, numbers, relative time, and currency formatting must be locale-aware.

Use the browser/locale APIs when practical:

```ts
Intl.DateTimeFormat
Intl.NumberFormat
Intl.RelativeTimeFormat
```

## 6.2 Translation Structure

Suggested structure:

```text
apps/web/src/i18n/
├── index.ts
└── locales/
    ├── en/
    │   ├── common.json
    │   ├── auth.json
    │   ├── dashboard.json
    │   ├── tutor.json
    │   ├── learn.json
    │   ├── practice.json
    │   ├── quiz.json
    │   ├── documents.json
    │   ├── progress.json
    │   └── billing.json
    └── tr/
        ├── common.json
        ├── auth.json
        ├── dashboard.json
        ├── tutor.json
        ├── learn.json
        ├── practice.json
        ├── quiz.json
        ├── documents.json
        ├── progress.json
        └── billing.json
```

Use semantic translation keys:

```ts
// good
`tutor.suggested.explain`

// bad
`t("Explain this concept")`
```

## 6.3 Locale Resolution

Precedence:

```text
Authenticated user's saved locale
        ↓
Explicit guest locale selection
        ↓
Browser language
        ↓
English fallback
```

Store registered users' locale in the database.

Suggested:

```sql
users.locale TEXT NOT NULL DEFAULT 'en'
```

## 6.4 AI Localization

The active locale must be part of AI request context.

Example:

```ts
{
  locale: "tr",
  responseLanguage: "Turkish"
}
```

AI system instruction should require:

> Respond in the user's selected language unless the user explicitly asks for another language.

Generated quizzes, summaries, notes, and practice content should preserve the generation locale.

---

# 7. Frontend Technology

Target stack:

- React
- Vite
- TypeScript
- Tailwind CSS
- Cloudflare Workers / Workers Static Assets deployment

Use TypeScript end-to-end.

Avoid unnecessary frontend state complexity.

Prefer:

- small reusable components
- explicit domain models
- typed API clients
- feature-oriented organization
- server authority for entitlements and permissions

---

# 8. Frontend Design Direction

## 8.1 Design Character

LearWizAI should feel:

- modern
- minimal
- calm
- educational
- AI-native
- premium but accessible
- trustworthy

Avoid:

- generic ChatGPT clone visuals
- excessive gradients
- excessive glassmorphism
- childish educational styling
- giant shadows
- UI clutter
- dozens of dashboard KPI cards
- unnecessary animation

## 8.2 Color System

Light-first.

Primary:

```text
#6366F1
```

Neutral palette:

```text
Background:        #F8FAFC
Surface:           #FFFFFF
Surface Secondary: #F1F5F9
Text Primary:      #0F172A
Text Secondary:    #64748B
Text Muted:        #94A3B8
Border:            #E2E8F0
```

Semantic:

```text
Success: #10B981
Warning: #F59E0B
Error:   #EF4444
Info:    #3B82F6
```

Keep gradients rare and intentional.

## 8.3 Dark Mode

Architecture must be dark-mode-ready from the start.

Suggested dark tokens:

```text
Background: #0F172A
Surface:    #1E293B
Text:       #F8FAFC
Secondary:  #94A3B8
Border:     #334155
```

Theme options:

```text
System
Light
Dark
```

## 8.4 Typography

Primary font:

```text
Inter
```

Use 600–700 for headings and approximately 400–500 for body text.

Avoid excessive marketing-style giant headings in the application UI.

## 8.5 Spacing

Use an 8px-based spacing system:

```text
4 / 8 / 12 / 16 / 24 / 32 / 40 / 48 / 64
```

Typical card padding:

```text
20–24px
```

## 8.6 Radius

Suggested:

```text
6px
10px
14px
18px
9999px for circular elements
```

Use moderate rounding; do not make every element pill-shaped.

## 8.7 Shadows

Prefer subtle borders and very light shadows.

Avoid heavy floating-card aesthetics.

## 8.8 Animation

Animations should be subtle and purposeful:

- page transitions
- modal transitions
- hover/focus
- progress transitions
- AI streaming/loading
- quiz feedback
- skeleton states

Avoid constant bouncing, parallax, or decorative motion.

---

# 9. Application Layout

## Desktop

Sidebar + main content.

Suggested sidebar width:

```text
240px
```

Navigation:

```text
Dashboard
AI Tutor
Learn
Practice
Quizzes
Documents

────────────

Progress

────────────

Settings
```

Show a small plan/usage section near the bottom of the sidebar.

## Mobile

Use bottom navigation instead of the desktop sidebar.

Suggested primary items:

```text
Home
Tutor
Learn
Practice
More
```

`More` contains:

- Quizzes
- Documents
- Progress
- Settings

AI chat input should remain usable as a sticky bottom interaction on mobile.

---

# 10. Main Screens

## 10.1 Landing Page

Core message:

> **Learn anything. With your AI teacher.**

Sub-message:

> Understand concepts. Practice intelligently. Build real mastery.

Primary CTA:

```text
Start Learning — Free
```

No credit card required.

The landing page should demonstrate the actual product UI rather than being only a feature list.

Suggested story:

```text
AI Tutor
   ↓
Learn Mode
   ↓
Practice
   ↓
AI Quizzes
   ↓
Progress
   ↓
Better Learning
```

## 10.2 Dashboard

Dashboard goal:

> Tell the learner what to do next.

Suggested structure:

```text
Greeting
↓
Continue Learning
↓
Recommended for You
↓
Your Progress
↓
Strong Topics / Needs Practice
```

Avoid turning the dashboard into a KPI wall.

## 10.3 AI Tutor

AI Tutor is a key differentiator.

It should not visually imitate a generic chatbot.

Provide learning actions:

- Explain
- Simplify
- Give Example
- Quiz Me
- Give Exercise
- Summarize

Suggested structure:

```text
AI Tutor
Your personal learning assistant

Suggested actions
[Explain a concept]
[Give me an example]
[Quiz me]
[Help me practice]

Conversation

Input + Send
```

Responses should stream where practical.

## 10.4 Learn Mode

Learn Mode is a structured lesson experience.

Suggested sequence:

```text
Concept
→ Intuition
→ Example
→ Common Mistakes
→ Mini Exercise
→ Check Understanding
```

This must feel like being taught, not like reading a raw AI response.

## 10.5 Practice Mode

Structure:

```text
Topic
Question X of Y
Question
Answer options
Check Answer
Feedback
Next Question
```

After answering, show a concise explanation.

## 10.6 Quiz Generator

Inputs:

- topic
- difficulty
- number of questions
- question type
- language

Example:

```text
Topic
Difficulty
Questions
Language

Generate Quiz
```

Generated quizzes should be validated before presentation.

## 10.7 Documents

Documents are not just storage.

The experience should be:

```text
Upload
→ Process
→ Read
→ Chat
→ Summarize
→ Quiz
```

Document card example:

```text
filename.pdf
24 pages · Processed

[Read] [Chat] [Summary] [Quiz]
```

PDF/document upload is an account-gated differentiator in the initial plans.

## 10.8 Progress

Keep charts useful and sparse.

Show:

- overall mastery
- topic mastery
- weak areas
- recommended review

Example:

```text
Neural Networks   87%
Python            76%
Statistics        61%
Linear Algebra    42%
```

## 10.9 Authentication

Authentication should be simple because users do not see it on first visit.

Possible primary flow:

```text
Welcome to LearWizAI

Continue with Google

or

Email
Password

Create Account
```

## 10.10 Pricing

Plans:

| Plan | Monthly | Annual | AI entitlement |
|---|---:|---:|---:|
| Free | $0 | $0 | 10 AI messages/day |
| Learner | $2.99/mo | $24.99/year | 150 AI messages/month |
| Pro | $7.99/mo | $69.99/year | 750 AI messages/month |

Feature intent:

### Free

- AI Tutor
- Learn Mode
- Practice
- 5 quizzes/month
- Basic progress
- Basic AI recommendations
- No PDF/RAG
- No advanced mastery
- No image questions

### Learner

- Everything in Free
- 150 AI responses/month
- Unlimited quizzes
- PDF upload
- Document RAG/chat
- AI summaries/notes
- Progress
- Topic mastery
- AI recommendations

### Pro

- Everything in Learner
- 750 AI responses/month
- Image questions
- Advanced adaptive learning/reasoning
- Advanced document analysis

These product quotas are entitlements, not promises of unlimited infrastructure use.

---

# 11. Billing Architecture

## 11.1 Provider

Use **Polar** initially.

Do not let business logic depend directly on Polar implementation details.

Use a provider abstraction:

```ts
interface PaymentProvider {
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  getCustomer(customerId: string): Promise<Customer>;
  getSubscription(subscriptionId: string): Promise<Subscription>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  reportUsage(event: UsageEvent): Promise<void>;
  getUsage(customerId: string): Promise<Usage>;
  handleWebhook(request: Request): Promise<WebhookEvent>;
}
```

Implementation:

```text
PaymentProvider
    ↓
PolarProvider
```

Future providers can be added without rewriting business logic.

## 11.2 Two Separate Usage Concepts

### Product Entitlement Usage

Controls access:

```text
Free → 10 AI messages/day
Learner → 150/month
Pro → 750/month
```

This is enforced by LearWizAI.

### Billable Usage

A future usage-based/overage system may report usage to Polar.

These concepts must not be conflated.

For MVP, fixed subscriptions + included usage quotas are sufficient.

## 11.3 Polar Responsibility

Polar handles customer billing concerns such as:

- checkout
- subscriptions
- invoices
- Merchant of Record responsibilities
- metered billing if introduced
- customer billing portal capabilities supported by the provider

Polar does **not** replace application-side entitlement enforcement.

## 11.4 Cloudflare Responsibility

Cloudflare billing measures LearWizAI infrastructure costs:

```text
Workers
R2
Workers AI
D1
Vectorize
KV
Queues
Durable Objects
```

Do not treat Cloudflare's own account billing as customer billing.

## 11.5 Webhook Flow

```text
Polar
  ↓
Cloudflare Worker webhook
  ↓
Signature verification
  ↓
Idempotency check
  ↓
Update subscription
  ↓
Update entitlements
```

Store webhook/event identifiers to prevent duplicate processing.

Frontend must never be the source of truth for subscription state.

---

# 12. Cloudflare Architecture

Target architecture:

```text
                         USERS
                           │
                           ▼
                    Cloudflare Edge
                           │
                 WAF / Turnstile / Rate Limit
                           │
                           ▼
                    Cloudflare Worker
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
         D1               KV          Durable Objects
       Database         Cache/limits      Stateful flows
          │
          ├──────────────┐
          │              │
          ▼              ▼
         R2           Vectorize
       Documents      RAG vectors
          │              ▲
          ▼              │
        Queues ──→ Parse/Chunk/Embed
                         │
                         ▼
                   Workers AI
```

## 12.1 Services

### Workers

Primary backend/API runtime.

Responsibilities:

- authentication
- authorization
- rate limiting enforcement
- entitlements
- routing
- AI orchestration
- RAG orchestration
- billing integration
- webhook handling
- API responses

### D1

Relational application database.

Use for:

- users
- sessions
- courses
- lessons
- enrollments
- progress
- quizzes
- questions
- quiz attempts
- conversations
- messages metadata
- documents metadata
- topic mastery
- recommendations
- plans
- subscriptions
- entitlements
- AI usage aggregates / ledger where appropriate
- audit/idempotency records

Use indexes and pagination.

Do not store large binary files in D1.

### R2

Use for:

- PDF files
- documents
- images
- other user-uploaded assets

Never expose unrestricted bucket credentials to the client.

All object authorization must happen server-side.

### Vectorize

Use for RAG vectors.

Recommended vector metadata:

```json
{
  "course_id": "...",
  "lesson_id": "...",
  "document_id": "...",
  "user_id": "..."
}
```

Always scope retrieval appropriately to the current tenant/user/course.

### Queues

Use for asynchronous document processing and other work that should not block an interactive request.

### Durable Objects

Use when stateful coordination or real-time session state benefits from a strongly coordinated per-session/per-room object.

Do not use Durable Objects as the default database for all application data.

### KV

Use for:

- cache
- short-lived configuration
- inexpensive lookup data
- non-critical counters where consistency requirements allow it

Do not treat KV as the source of truth for critical subscription state.

### Workers AI

Use Cloudflare Workers AI for inference and embeddings.

---

# 13. AI Architecture

## 13.1 AI Router

Do not call one model for every task.

Use an internal AI Router:

```text
AI Request
   ↓
Task classification
   ↓
AI Router
   ├── Primary reasoning/chat model
   ├── Small cheap model
   ├── Vision/reasoning model
   └── Embedding model
```

## 13.2 Primary Model

Target primary model:

```text
@cf/zai-org/glm-4.7-flash
```

Use for:

- AI Tutor
- structured explanations
- learning interactions
- reasoning-heavy tasks
- normal quiz generation
- practice feedback

## 13.3 Small Model

Target low-cost auxiliary model:

```text
Llama 3.2 1B Instruct
```

Use for tasks such as:

- simple classification
- routing
- metadata generation
- basic categorization
- short summaries where quality requirements are low

Do not use a large expensive model when a small model is sufficient.

## 13.4 Vision / Specialized Reasoning

Target:

```text
@cf/google/gemma-4-26b-a4b-it
```

Use for:

- image questions
- visual educational content
- specialized multimodal reasoning

This is not the default model.

## 13.5 Embeddings

Target:

```text
Qwen3-Embedding-0.6B
```

Use for document RAG indexing and semantic retrieval.

Store the actual embedding model version/configuration used for a vector generation pipeline so future re-indexing can be controlled.

## 13.6 Token / Neuron Accounting

Do not assume a fixed neuron cost per message.

Actual usage depends on input/output/cached tokens and selected model.

For the target GLM-4.7-Flash model, the application should calculate usage from actual token counts returned/available from inference.

Conceptually:

```text
neuron_usage = input_cost(actual_input_tokens)
              + output_cost(actual_output_tokens)
              + cached_input_handling
```

The AI layer must record actual usage metrics.

## 13.7 Prompt Caching

Where supported, exploit provider/model prompt caching for repeated system prompts and static context.

Avoid duplicating large unchanged prompts unnecessarily.

---

# 14. AI Usage Ledger

Create an internal usage record with fields similar to:

```text
ai_usage
- id
- user_id (nullable for guest)
- guest_session_id (nullable)
- model
- task_type
- input_tokens
- output_tokens
- cached_tokens
- neurons
- estimated_cost
- latency_ms
- plan
- locale
- created_at
```

This is used for:

- entitlement enforcement
- internal analytics
- cost estimation
- abuse prevention
- future usage-based billing

High-cardinality metrics can be sent to Analytics Engine where appropriate.

---

# 15. RAG / Document Processing

Document pipeline:

```text
User Upload
   ↓
Worker authorization
   ↓
R2
   ↓
Queue
   ↓
Parse / extract text
   ↓
Clean / normalize
   ↓
Chunk
   ↓
Qwen3 Embedding
   ↓
Vectorize
```

Chat pipeline:

```text
User question
   ↓
Worker
   ↓
Auth + entitlement + rate limit
   ↓
Query embedding
   ↓
Vectorize retrieval
   ↓
Filter by user/course/document scope
   ↓
Prompt construction
   ↓
AI model
   ↓
Streaming response
```

Retrieved documents are **untrusted content**.

Prompt injection from retrieved content must not be allowed to override system rules or authorize arbitrary actions.

Never allow retrieved text to directly trigger tool execution.

---

# 16. D1 Data Model

Core tables:

```text
users
sessions
plans
subscriptions
entitlements

courses
lessons
enrollments
lesson_progress

topic_mastery
recommendations

quizzes
questions
quiz_attempts

conversations
messages

documents
document_chunks

audit_events
idempotency_keys
ai_usage
```

Additional tables may be introduced when justified.

Rules:

- Foreign keys where appropriate.
- Index query paths.
- Paginate lists.
- Avoid full-table scans.
- Avoid storing large binaries.
- Keep tenant boundaries explicit.
- Keep critical entitlement/subscription state strongly authoritative in D1.

---

# 17. Entitlement Architecture

Entitlements should be centralized.

Example conceptual API:

```ts
canUseFeature(user, feature)
checkUsageBudget(user, feature)
getPlanEntitlements(plan)
```

Do not scatter plan checks throughout components such as:

```ts
if (user.plan === "pro") ...
```

Instead, route feature access through a dedicated entitlement service.

Example:

```text
Request
 ↓
Authenticated/Guest identity
 ↓
Entitlement service
 ↓
Usage budget check
 ↓
Allowed / blocked / registration required / upgrade required
```

---

# 18. Rate Limiting and Load Balancing

Rate limiting is mandatory.

Apply limits by:

- IP
- guest session
- authenticated user
- plan
- endpoint
- expensive AI operation
- document upload
- quiz generation
- abuse signals
- AI/neuron budget

There must also be protection against **denial-of-wallet** attacks.

Example:

```text
Suspicious client
 → cannot generate unlimited AI calls
 → AI budget enforced
 → rate limit triggers
 → Turnstile can be required
```

## Load Balancing / Failover

At minimum, the application should be able to:

- route traffic at the Worker edge
- fail over between supported AI models when a model is unavailable
- avoid blindly retrying expensive AI requests
- use bounded retry policies
- preserve idempotency for retried operations

For LLM failures, the system may route to an approved fallback model rather than repeatedly retrying the same expensive request.

---

# 19. Security Requirements

Mandatory:

- HTTPS in production
- secure cookies
- server-side authorization
- schema validation for input
- WAF
- Turnstile for signup or suspicious traffic
- rate limiting
- abuse protection
- tenant isolation
- webhook signature verification
- idempotency for webhooks and critical mutations
- secrets stored in Cloudflare Worker secrets
- no API keys in frontend source
- no unrestricted R2 credentials in clients
- no client-side authority over subscription state

## Prompt Injection

Treat documents, retrieved chunks, user-provided content, and external content as untrusted.

Never allow untrusted text to override the system instruction or gain arbitrary tool access.

---

# 20. Observability

Do not add Better Stack / Logtail by default.

Use Cloudflare-native observability first:

- Workers Logs
- Workers Traces
- Analytics Engine
- Logpush / OpenTelemetry export only when useful

Track:

- request latency
- error rate
- AI latency
- token usage
- neuron usage
- model failures
- RAG retrieval metrics
- queue processing failures
- document processing status
- subscription/webhook failures
- guest-to-account conversion

Analytics Engine is particularly useful for:

- high-cardinality usage analytics
- per-user/product metrics
- internal AI usage metrics

---

# 21. Monorepo Structure

Recommended:

```text
learwizai/
├── apps/
│   └── web/
│       ├── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       ├── services/
│       └── i18n/
│
├── workers/
│   └── api/
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── middleware/
│       │   ├── ai/
│       │   ├── rag/
│       │   ├── billing/
│       │   ├── auth/
│       │   └── db/
│       └── wrangler.jsonc
│
├── packages/
│   ├── types/
│   ├── validation/
│   └── config/
│
├── db/
│   ├── migrations/
│   └── seed/
│
├── docs/
├── package.json
└── CLAUDE.md
```

Prefer feature/domain boundaries over a giant generic `utils` folder.

---

# 22. API Organization

Example route grouping:

```text
/auth/*
/guest/*
/users/*
/tutor/*
/learn/*
/practice/*
/quizzes/*
/documents/*
/progress/*
/recommendations/*
/billing/*
/webhooks/polar
```

All routes must pass through the appropriate middleware:

```text
request
 ↓
request ID / context
 ↓
security / abuse checks
 ↓
identity resolution
 ↓
entitlement check where needed
 ↓
validation
 ↓
handler
```

---

# 23. Coding Rules for Claude Code

## General

- TypeScript strict mode.
- Keep functions focused.
- Prefer explicit types over `any`.
- Keep provider integrations isolated.
- Avoid unnecessary abstraction layers.
- Do not introduce a library when a small native implementation is safer and clearer.
- Reuse domain types across frontend/backend where appropriate.

## React

- Build reusable components.
- Keep domain logic out of presentational components.
- Use accessible semantic HTML.
- Do not hardcode text.
- Do not put authorization logic solely in the UI.

## Backend

- Validate all inputs.
- Handle all external integrations defensively.
- Keep critical business rules server-side.
- Do not trust client plan/role information.

## Errors

Use typed/domain errors where useful.

Do not leak sensitive internal details to end users.

Log enough diagnostic context for debugging.

---

# 24. Component System

Initial reusable UI primitives/components:

```text
Button
Input
Textarea
Select
Modal
Dialog
Dropdown
Tabs
Card
Badge
Progress
Avatar
Tooltip
Toast
Skeleton
EmptyState
LoadingState
ErrorState

AIMessage
UserMessage
QuizQuestion
LessonBlock
TopicCard
DocumentCard
```

Build higher-level pages from these primitives.

Avoid duplicated styles between screens.

---

# 25. Responsive / Accessibility Requirements

Mobile-first.

Support:

- mobile
- tablet
- desktop
- large desktop

Accessibility requirements:

- semantic HTML
- keyboard navigation
- visible focus states
- appropriate ARIA labels
- sufficient contrast
- reduced-motion support
- screen-reader-friendly interactive controls

---

# 26. Deployment

Deployment target:

```text
GitHub
  ↓
CI
  ↓
Cloudflare Workers
```

Environments:

```text
development
staging
production
```

Use separate production/staging database resources where practical.

Version and review D1 migrations.

Use Cloudflare secrets for sensitive credentials.

Do not commit:

- API keys
- Polar secrets
- auth secrets
- service credentials
- production database secrets

---

# 27. CI/CD

Before merge/deploy:

```text
Install
 ↓
Typecheck
 ↓
Lint
 ↓
Unit tests
 ↓
Build
 ↓
Migration validation
 ↓
Deploy
```

Production deploys should not skip validation unless explicitly required for an emergency.

---

# 28. Testing Strategy

Minimum testing coverage:

## Unit

- entitlement calculations
- usage calculations
- locale resolution
- AI router decisions
- validation
- guest migration rules
- billing adapter behavior

## Integration

- guest session creation
- signup/login
- guest migration
- subscription webhooks
- document processing
- RAG retrieval authorization
- AI usage accounting

## E2E

At minimum:

```text
Visitor
 → Start Learning
 → use AI Tutor
 → hit guest limit
 → create account
 → guest data appears in account
```

and:

```text
User
 → upload document
 → document processed
 → ask question
 → scoped RAG response
```

and:

```text
User
 → select plan
 → checkout
 → webhook
 → entitlement updated
```

---

# 29. UX / Product Guardrails

Do not:

- force registration immediately
- make every interaction a chat window
- hide the next learning action
- overload the dashboard
- use aggressive upgrade popups
- make AI seem magically authoritative without feedback/context
- expose infrastructure concepts to normal users
- expose model names or neuron costs in ordinary product UI

Do:

- make learning progress visible
- give users useful next actions
- provide concise AI explanations
- preserve context across learning flows
- use clear empty states
- use graceful loading/error states
- keep subscription messaging clear

---

# 30. AI Safety / Learning Quality

For learning responses:

- Prefer explanations over unsupported assertions.
- When uncertainty matters, express uncertainty.
- Encourage verification for high-stakes domains.
- Distinguish source content from model-generated interpretation.
- Avoid presenting generated content as guaranteed fact.

For document RAG:

- prioritize retrieved source material
- cite/identify document context in the UI when appropriate
- do not follow prompt instructions embedded in documents

---

# 31. Initial Route Map

Suggested frontend route model:

```text
/
/en
/tr

/en/app
/tr/app

/en/app/tutor
/tr/app/tutor

/en/app/learn
/tr/app/learn

/en/app/practice
/tr/app/practice

/en/app/quizzes
/tr/app/quizzes

/en/app/documents
/tr/app/documents

/en/app/progress
/tr/app/progress

/en/settings
/tr/settings

/en/pricing
/tr/pricing

/en/auth/*
/tr/auth/*
```

The exact router implementation may use a locale abstraction, but the application architecture must remain locale-aware and SEO-friendly.

Guest-accessible routes should remain accessible without login where product rules allow it.

---

# 32. Initial Entitlement Matrix

| Feature | Guest | Free | Learner | Pro |
|---|---|---|---|---|
| AI Tutor | Limited | Yes | Yes | Yes |
| Learn Mode | Limited | Yes | Yes | Yes |
| Practice | Limited | Yes | Yes | Yes |
| Quiz Generator | Limited | 5/month | Unlimited | Unlimited |
| Basic Progress | Temporary | Yes | Yes | Yes |
| AI Recommendations | Temporary/basic | Basic | Yes | Advanced |
| PDF Upload | No | No | Yes | Yes |
| Document RAG | No | No | Yes | Yes |
| AI Summary/Notes | No | No | Yes | Yes |
| Topic Mastery | No/temporary | Basic | Yes | Advanced |
| Image Questions | No | No | No | Yes |
| Advanced Document Analysis | No | No | No | Yes |
| Adaptive Learning | No | Basic/limited | Yes | Advanced |

Exact feature gating must be implemented through entitlements, not UI conditionals alone.

---

# 33. Example Core Request Flow

## Guest AI Tutor

```text
Browser
  ↓
Cloudflare Worker
  ↓
resolve identity
  ↓
Guest session
  ↓
rate limit
  ↓
guest entitlement check
  ↓
validate request
  ↓
AI Router
  ↓
Workers AI
  ↓
stream response
  ↓
record AI usage
  ↓
update guest usage
```

## Authenticated AI Tutor

```text
Browser
  ↓
Worker
  ↓
Session/authentication
  ↓
plan/entitlement check
  ↓
rate limit
  ↓
AI Router
  ↓
Workers AI
  ↓
stream response
  ↓
record AI usage
```

## Document Chat

```text
Browser
  ↓
Worker
  ↓
Authenticated user
  ↓
Learner/Pro entitlement
  ↓
Vector retrieval scoped to user/document/course
  ↓
Prompt construction
  ↓
AI Router
  ↓
Workers AI
  ↓
stream response
  ↓
record usage
```

---

# 34. Future-Proofing

The implementation must make these future changes possible without major rewrites:

- add more languages
- swap payment providers
- add more AI models
- add image AI
- add voice AI
- introduce usage-based billing / overage
- add advanced adaptive learning
- add more document types
- add additional storage/vector providers if required

Do not prematurely implement all future features.

Create clean interfaces around the areas most likely to change:

```text
AIProvider / AIRouter
PaymentProvider
StorageService
VectorSearchService
EmbeddingService
EntitlementService
LocalizationService
```

---

# 35. Implementation Priorities

Build in this order unless dependencies require a different sequence:

### Step 1 — Foundation

- monorepo
- TypeScript
- React/Vite
- Tailwind
- Workers
- D1
- R2
- KV
- Wrangler
- environment configuration
- CI

### Step 2 — Design System

- tokens
- typography
- buttons
- inputs
- cards
- dialogs
- navigation
- responsive layout
- i18n foundation

### Step 3 — Guest Experience

- guest session
- AI Tutor
- basic Learn Mode
- Practice Mode
- Quiz Generator
- usage limits

### Step 4 — Authentication

- signup
- login
- session management
- Google OAuth if selected
- guest migration

### Step 5 — Persistent Learning

- dashboard
- progress
- topic mastery
- recommendations

### Step 6 — Documents / RAG

- R2
- queue
- parsing
- chunking
- embeddings
- Vectorize
- document chat
- summaries
- document quizzes

### Step 7 — Billing

- PaymentProvider interface
- PolarProvider
- checkout
- webhook handling
- subscription state
- entitlements

### Step 8 — Hardening

- WAF
- Turnstile
- rate limiting
- AI budget protection
- observability
- tests
- performance
- abuse controls

### Step 9 — Polish

- visual refinement
- micro-interactions
- UX polishing
- OpenDesign pass

---

# 36. Definition of Done for an MVP Feature

A feature is not considered complete until:

- UI is responsive
- UI text is localized in English and Turkish
- loading state exists
- error state exists
- empty state exists where relevant
- server-side authorization exists where required
- entitlement rules are enforced server-side
- input validation exists
- analytics/usage tracking is added when relevant
- tests cover important business logic
- accessibility is considered
- no secrets are exposed
- feature works for both guest and authenticated states where applicable

---

# 37. Non-Negotiable Rules

1. **Do not require registration before users can experience the product.**
2. **Do not trust frontend entitlement/subscription state.**
3. **Do not hardcode user-facing strings.**
4. **Do not store document binaries in D1.**
5. **Do not allow cross-user RAG retrieval.**
6. **Do not expose provider secrets in frontend code.**
7. **Do not treat Polar as the authorization layer.**
8. **Do not treat Cloudflare billing as customer billing.**
9. **Do not allow unlimited anonymous AI usage.**
10. **Do not make the AI Tutor a generic chatbot clone.**
11. **Do not use a large model when a smaller model is sufficient.**
12. **Do not bypass rate limiting or AI budget protection.**
13. **Do not let retrieved document content override system instructions.**
14. **Do not introduce unnecessary infrastructure before measuring the need.**
15. **Do not redesign the architecture merely for visual polish.**

---

# 38. Final Product Mental Model

```text
                     LEARWIZAI
                         │
              ┌──────────┴──────────┐
              │                     │
           DISCOVER              LEARN
              │                     │
          Guest User           AI Teacher
              │                     │
              ▼                     ▼
          Try Product          Learn Mode
              │                     │
              ▼                     ▼
        Registration            Practice
              │                     │
              ▼                     ▼
          Free Account         Feedback
              │                     │
              └──────────┬──────────┘
                         ▼
                      MASTERY
                         │
                         ▼
                  RECOMMENDATION
                         │
                         ▼
                    NEXT ACTION
```

Technical platform:

```text
React + TypeScript
        │
Cloudflare Workers
        │
 ┌──────┼─────────────────────────────┐
 │      │        │       │      │      │
D1     R2       KV   Vectorize Queues  DO
 │      │        │       │      │      │
 └──────┴────────┴───────┴──────┴──────┘
                    │
               Workers AI
                    │
             AI Router / RAG
                    │
                  Polar
            (customer billing)
```

The goal is a product that feels simple to the learner while the backend provides strong usage control, personalization, RAG, billing, localization, and Cloudflare-native scalability underneath.

---

# 39. Software Development Lifecycle (SDLC)

LearWizAI must follow a repeatable software development lifecycle. Do not implement features as isolated code drops without requirements, design, implementation, testing, review, and deployment checks.

## 39.1 Development Lifecycle

```text
Idea / Requirement
      ↓
Product Specification
      ↓
Technical Design
      ↓
UX / UI Design
      ↓
Task Breakdown
      ↓
Implementation
      ↓
Local Validation
      ↓
Automated Tests
      ↓
Code Review
      ↓
Staging Deployment
      ↓
QA / Acceptance Testing
      ↓
Production Deployment
      ↓
Monitoring
      ↓
Feedback / Metrics
      ↓
Iteration
```

## 39.2 Feature Development Workflow

Every non-trivial feature should have the following lifecycle:

1. Define the user problem and acceptance criteria.
2. Identify guest/authenticated/plan-specific behavior.
3. Define API, data model, and entitlement implications.
4. Define loading, empty, error, and success states.
5. Define localization keys for English and Turkish.
6. Break implementation into small tasks.
7. Implement backend/domain logic first when server authority is required.
8. Implement frontend against typed contracts.
9. Add or update unit/integration/E2E tests.
10. Run formatting, linting, typecheck, tests, and build.
11. Review security, accessibility, performance, and observability impact.
12. Deploy to staging.
13. Run QA acceptance checks.
14. Deploy to production through CI/CD.
15. Monitor logs/metrics and confirm expected behavior.

## 39.3 Branching Strategy

Use a simple trunk-based workflow unless the project size later justifies additional complexity.

Recommended branches:

```text
main        → production-ready
feature/*   → short-lived feature branches
fix/*       → short-lived bug-fix branches
chore/*     → maintenance
```

Rules:

- Keep branches small and short-lived.
- Do not work directly on `main` for feature implementation.
- Pull requests must pass CI.
- Rebase/merge frequently enough to avoid large conflicts.
- Never commit secrets.

## 39.4 Pull Request Checklist

Every PR should verify:

- requirements/acceptance criteria are met
- tests were added or updated
- localization is complete
- migrations are included when needed
- authorization/entitlement behavior is correct
- logging/analytics is appropriate
- accessibility is considered
- no unnecessary dependencies were introduced
- no sensitive data is logged
- rollback impact is understood for risky changes

## 39.5 Environments

```text
Local Development
      ↓
Staging
      ↓
Production
```

Environment responsibilities:

### Development

- local/test credentials
- disposable data
- fast feedback
- mocked or sandbox external integrations where appropriate

### Staging

- production-like configuration
- separate D1/R2/Vectorize resources where practical
- Polar sandbox/test environment where available
- realistic integration tests
- QA acceptance testing

### Production

- production secrets
- production billing
- production data
- protected deployments
- full observability

## 39.6 Release Strategy

For normal MVP releases, use:

```text
PR
 → CI
 → merge to main
 → staging validation
 → production deploy
 → smoke tests
 → monitoring
```

For high-risk migrations or billing/auth changes, use a staged rollout where practical.

Avoid introducing complex blue/green or canary infrastructure until traffic and operational needs justify it.

## 39.7 Database Migration Rules

D1 migrations must be:

- versioned
- committed to source control
- reviewed
- forward-compatible where possible
- tested against staging before production

Prefer additive migrations first when changing heavily-used tables.

Do not make a destructive schema change without an explicit migration and rollback/restore plan.

## 39.8 Rollback

Every production deployment must have a practical rollback strategy.

Application rollback:

```text
previous known-good deployment
```

Data rollback is different and must not assume that application rollback automatically reverses database migrations.

For destructive database changes, create a recovery strategy before deployment.

## 39.9 Definition of Ready

A feature is ready for implementation when:

- user problem is clear
- scope is bounded
- acceptance criteria are known
- required screens/flows are understood
- API/data requirements are defined
- plan/entitlement implications are known
- localization requirements are known
- security considerations are identified
- test cases are identified

---

# 40. Quality Assurance and Testing System

Testing is a first-class engineering activity, not a final cleanup step.

## 40.1 Test Pyramid

```text
                 E2E
               /     \
          Integration
          /           \
               Unit
```

Use many fast unit tests, fewer integration tests, and a smaller set of high-value E2E tests.

## 40.2 Unit Tests

Unit-test deterministic business logic including:

- entitlement calculations
- guest limits
- quota resets
- AI usage calculations
- neuron/cost calculations
- locale resolution
- translation fallback
- AI Router decisions
- validation schemas
- recommendation scoring where deterministic
- subscription state mapping
- billing adapter behavior
- migration eligibility rules

## 40.3 Integration Tests

Test real boundaries and workflows:

- Worker route + D1
- guest session creation
- signup/login
- guest-to-account migration
- entitlement enforcement
- AI usage accounting
- document metadata lifecycle
- R2 authorization
- queue processing
- Vectorize retrieval authorization
- Polar webhook verification and idempotency
- subscription state synchronization

External providers should use sandbox/test environments or controlled mocks depending on the test.

## 40.4 End-to-End Tests

Maintain critical user journeys:

### Guest Conversion

```text
Landing
 → Start Learning
 → Guest Session
 → AI Tutor
 → guest limit
 → Create Account
 → migration
 → Free dashboard
```

### Learning

```text
Dashboard
 → Learn
 → Practice
 → feedback
 → Progress
```

### Documents

```text
Login
 → upload PDF
 → processing status
 → processed document
 → document chat
 → scoped answer
```

### Billing

```text
Pricing
 → checkout
 → successful payment
 → Polar webhook
 → subscription persisted
 → entitlements updated
 → premium feature available
```

## 40.5 Regression Testing

When fixing a bug, add a regression test whenever practical so the same behavior cannot silently return.

## 40.6 API Contract Testing

Frontend/backend contracts should be typed and validated.

Validate:

- request schema
- response schema
- nullable/optional fields
- error format
- pagination format

Avoid undocumented ad-hoc JSON shapes.

## 40.7 Visual / UX QA

Before production, verify:

- desktop layout
- mobile layout
- loading states
- error states
- empty states
- long text
- Turkish text expansion/formatting
- dark mode if enabled
- keyboard navigation
- focus states
- responsive AI chat behavior

## 40.8 Performance QA

Measure:

- page load
- API latency
- time to first AI token
- total AI response latency
- RAG retrieval latency
- document processing time
- queue backlog/failure rate
- database query latency

Avoid optimizing by intuition only. Measure first.

## 40.9 Security QA

At minimum test:

- unauthorized feature access
- cross-user document access
- cross-user Vectorize retrieval
- guest-session takeover attempts
- rate limit bypass attempts
- replayed billing webhooks
- invalid webhook signatures
- malformed requests
- oversized uploads
- prompt injection through documents
- secret exposure through logs or client bundles

---

# 41. Admin / Operations Dashboard

LearWizAI should have a separate authenticated **Admin Dashboard** for product operations, support, monitoring, subscriptions, and usage analytics.

This is an internal application area, not part of the normal learner UI.

Suggested route structure:

```text
/admin
/admin/dashboard
/admin/users
/admin/users/:id
/admin/usage
/admin/ai
/admin/subscriptions
/admin/billing
/admin/documents
/admin/feedback
/admin/system
/admin/logs
/admin/audit
```

Admin routes must require a dedicated admin role/permission enforced server-side.

Never rely only on hiding the admin UI in the frontend.

## 41.1 Admin Dashboard Goals

The dashboard should answer:

> What is happening in the product right now, who is using it, what is failing, and where are we spending money?

## 41.2 Executive Overview

Top-level dashboard cards should include:

```text
DAU / WAU / MAU
New users
Guest sessions
Guest → account conversion
Active subscriptions
MRR / ARR estimate
AI requests
AI neurons / tokens
AI cost estimate
Error rate
```

Do not create vanity metrics without a product decision attached to them.

## 41.3 User Analytics

Admin should be able to inspect:

- total users
- new registrations
- guest users
- guest-to-account conversion
- active users
- inactive users
- plan distribution
- locale distribution
- signup source when available
- last active timestamp
- feature usage

Useful time ranges:

```text
Today
7 days
30 days
90 days
Custom
```

## 41.4 User Detail Page

Admin user detail should show, subject to privacy/access controls:

```text
User
├── identity
├── locale
├── account status
├── current plan
├── subscription status
├── created at
├── last active
├── AI usage
├── learning activity
├── documents
├── recent errors
└── audit events
```

Do not display raw secrets or sensitive authentication data.

## 41.5 Usage Dashboard

The usage dashboard should show:

- AI requests over time
- input tokens
- output tokens
- cached tokens
- neurons
- estimated infrastructure cost
- usage by model
- usage by feature
- usage by plan
- guest vs authenticated usage
- average latency
- p50/p95 latency where available

Example:

```text
AI Usage

Requests       18,420
Input Tokens   42.8M
Output Tokens   7.4M
Neurons        510K
Est. Cost      $X.XX

Model Breakdown
GLM-4.7-Flash      82%
Llama 1B           13%
Gemma 4             5%
```

The exact cost number is an internal estimate and should be clearly labeled as such.

## 41.6 AI Operations Dashboard

Track AI reliability:

- request volume
- model usage
- model error rate
- timeout rate
- fallback rate
- average first-token latency
- total latency
- output length
- token usage
- neuron usage
- rejected requests from quota/rate limits

This dashboard should help identify whether model routing decisions are economically and technically healthy.

## 41.7 Subscription Dashboard

Admin should be able to inspect:

- active subscriptions
- trial/free users
- Learner subscriptions
- Pro subscriptions
- cancellations
- failed payments
- past-due states if applicable
- subscription events
- upgrades/downgrades
- churn trends
- revenue by plan

Subscription state must come from the backend/D1 synchronized from Polar, not directly from frontend state.

## 41.8 Billing / Polar Operations

Provide visibility into:

- Polar customer ID
- Polar subscription ID
- product/price identifier
- last webhook received
- webhook processing status
- webhook failures
- idempotency state
- last synchronization time

Never expose Polar secret keys in the admin UI.

## 41.9 Document / RAG Operations

Admin should be able to see system-level document processing health:

- documents uploaded
- queued
- processing
- processed
- failed
- average processing time
- queue backlog
- embedding failures
- Vectorize errors

Admin should not automatically gain permission to read private document content. Content access should be explicit, audited, and privacy-aware.

## 41.10 System Health

System dashboard should expose:

```text
Workers
D1
R2
KV
Vectorize
Queues
Durable Objects
Workers AI
Polar webhooks
```

For each, show relevant health indicators rather than fake generic green lights.

Examples:

- request errors
- latency
- queue failures
- AI failures
- storage errors
- webhook failures
- rate-limit rejects

## 41.11 Logs

Admin log views should support structured filtering by:

- time range
- request ID
- user ID
- guest session ID
- route
- severity
- service
- error code
- model
- webhook event ID

Do not store sensitive secrets, raw authentication tokens, or unnecessary private document content in logs.

## 41.12 Audit Log

All high-impact admin operations should produce audit records:

```text
actor_admin_id
action
resource_type
resource_id
timestamp
reason
metadata
request_id
```

Examples:

- changing a user's plan manually
- disabling a user
- replaying a webhook
- changing an entitlement
- accessing restricted support data

Admin audit events are immutable from the normal application UI.

## 41.13 Admin Roles

Start simple:

```text
admin
support
```

Possible future roles:

```text
finance
analyst
moderator
super_admin
```

Permissions should be capability-based rather than a scattered collection of string comparisons.

## 41.14 Privacy

The admin dashboard must follow least privilege.

Default behavior:

- aggregate metrics are broadly visible to authorized admins
- user-level data is more restricted
- private document content is highly restricted
- sensitive actions require auditing

---

# 42. Product Analytics and Event Tracking

Analytics events should describe meaningful product behavior, not every click.

Examples:

```text
guest_session_created
guest_ai_used
guest_limit_reached
signup_started
signup_completed
guest_migration_completed
lesson_started
lesson_completed
practice_started
practice_answered
quiz_generated
quiz_completed
document_uploaded
document_processed
document_chat_used
subscription_checkout_started
subscription_started
subscription_cancelled
subscription_failed
```

Every event should have a stable name and typed properties.

Example:

```ts
track("quiz_completed", {
  quizId,
  questionCount,
  score,
  locale,
});
```

Do not send unrestricted personal data into analytics events.

Use Analytics Engine or another approved telemetry destination for high-cardinality analytics where appropriate.

Product analytics and operational logs are different concerns:

```text
Product Analytics → What users do
Operational Logs   → What systems do
Audit Logs         → What privileged actors do
```

Keep these concerns separate.

---

# 43. Operational Runbooks

Common operational incidents should have a documented response path.

Minimum runbooks:

### AI Model Failure

```text
Detect elevated AI errors
 → identify affected model
 → verify provider status/capacity
 → activate approved fallback if appropriate
 → stop unsafe retry amplification
 → monitor recovery
```

### Polar Webhook Failure

```text
Detect webhook failures
 → inspect signature/idempotency state
 → retry safely
 → verify D1 subscription state
 → confirm entitlement state
 → audit result
```

### Queue Backlog

```text
Detect backlog
 → identify processing bottleneck
 → inspect failed messages
 → verify worker/AI capacity
 → retry dead-lettered work safely
 → monitor drain rate
```

### Database Incident

```text
Detect elevated D1 errors/latency
 → stop destructive changes
 → inspect recent migration
 → verify application version
 → rollback application if appropriate
 → restore/recover data if necessary
```

Document operational procedures in `docs/runbooks/`.

---

# 44. Recommended Operational Documentation

Repository documentation should include:

```text
docs/
├── architecture.md
├── api.md
├── database.md
├── billing.md
├── ai.md
├── rag.md
├── localization.md
├── security.md
├── testing.md
├── deployment.md
├── analytics.md
├── admin-dashboard.md
└── runbooks/
    ├── ai-outage.md
    ├── billing-webhook-failure.md
    ├── queue-backlog.md
    └── database-incident.md
```

Keep documentation updated when architecture or operational behavior changes.

---

# 45. Updated Implementation Priority

The implementation order should reflect the full engineering lifecycle, not only feature coding.

```text
1. Repository + toolchain
2. Cloudflare environments + bindings
3. Design system + i18n foundation
4. Testing infrastructure + CI
5. Guest session + identity foundations
6. AI Tutor + AI Router + usage accounting
7. Learn Mode + Practice + Quiz
8. Authentication + guest migration
9. Dashboard + progress + recommendations
10. Documents + R2 + Queue + RAG
11. Polar + subscriptions + entitlements
12. Admin Dashboard + analytics + audit logs
13. Security hardening
14. Staging QA
15. Production launch
16. Observability + product metrics review
17. OpenDesign visual polish
```

Do not postpone testing until the final phase. Testing infrastructure starts near the beginning and grows with every feature.

---

# 46. Admin Dashboard Product Mental Model

```text
                    ADMIN DASHBOARD
                           │
        ┌──────────────────┼───────────────────┐
        │                  │                   │
      USERS              USAGE             REVENUE
        │                  │                   │
   acquisition       AI requests          MRR/ARR
   retention         tokens/neurons        plans
   conversion        model usage           churn
   plans             cost estimates        payments
        │                  │                   │
        └──────────────────┼───────────────────┘
                           │
                         HEALTH
                           │
               ┌───────────┼───────────┐
               │           │           │
             Errors      Queues      Webhooks
             Latency     RAG         AI models
               │           │           │
               └───────────┼───────────┘
                           │
                       AUDIT LOG
```

The learner product should remain simple. The complexity needed to operate the business belongs in the internal admin/operations layer.

---

# 47. Authentication, Email, and Account Lifecycle

Authentication is a core production feature. LearWizAI must support guest-first usage while providing a secure path to a persistent account.

## 47.1 Authentication Principles

- Registration is not required on first visit.
- Guest users may use allowed core features before signup.
- Registration is triggered by meaningful usage, an account-required feature, or a persistence requirement.
- The server is the source of truth for identity and authentication state.
- Email verification is required before treating an email/password account as fully verified.
- Password reset tokens and magic-link tokens are short-lived, single-use, and stored as hashes where practical.
- Authentication endpoints are rate-limited and protected against enumeration and abuse.
- Never reveal whether an arbitrary email address already has an account through public API responses.

## 47.2 Authentication Methods

Initial authentication methods:

```text
Email + Password
Magic Link
Google OAuth
```

The architecture must allow additional OAuth providers later without rewriting the account model.

Suggested auth routes:

```text
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/verify-email
POST /auth/resend-verification
POST /auth/request-password-reset
POST /auth/reset-password
POST /auth/request-magic-link
POST /auth/consume-magic-link
GET  /auth/oauth/google/start
GET  /auth/oauth/google/callback
GET  /auth/me
```

## 47.3 Signup Flow

Primary email/password flow:

```text
Guest
  ↓
Create Account
  ↓
Email + Password
  ↓
Turnstile / abuse checks when required
  ↓
Validate input
  ↓
Create pending/unverified account
  ↓
Create verification token
  ↓
Send verification email
  ↓
User clicks verification link
  ↓
Verify token
  ↓
Mark email verified
  ↓
Migrate eligible guest data
  ↓
Assign Free plan entitlements
  ↓
Create authenticated session
  ↓
Show Welcome / Continue Learning
```

Guest migration must be idempotent and must not create duplicate ownership records when the verification/login flow is retried.

## 47.4 Email Service

Use **Cloudflare Email Service** as the initial transactional email provider.

Application code must not call Cloudflare Email Service directly from arbitrary feature code. Use an internal provider abstraction:

```ts
interface EmailProvider {
  sendVerificationEmail(params: VerificationEmailParams): Promise<void>;
  sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<void>;
  sendMagicLinkEmail(params: MagicLinkEmailParams): Promise<void>;
  sendWelcomeEmail(params: WelcomeEmailParams): Promise<void>;
  sendSubscriptionEmail(params: SubscriptionEmailParams): Promise<void>;
  sendUsageWarningEmail(params: UsageWarningEmailParams): Promise<void>;
  sendDocumentReadyEmail(params: DocumentReadyEmailParams): Promise<void>;
  sendSecurityNotificationEmail(params: SecurityNotificationEmailParams): Promise<void>;
}
```

Initial implementation:

```text
EmailProvider
      ↓
CloudflareEmailProvider
      ↓
Cloudflare Email Service
```

Keep the abstraction so Resend, Postmark, SES, or another provider can be introduced later without changing business logic.

Do not expose email-provider credentials to the frontend.

## 47.5 Transactional Email Types

Initial email catalog:

| Email | Trigger | Required in MVP |
|---|---|---|
| Email Verification | Account created | Yes |
| Welcome | Email verified / onboarding completed | Yes |
| Password Reset | User requests reset | Yes |
| Magic Link | User requests passwordless login | Yes, when magic link auth is enabled |
| Subscription Started | Polar subscription activated | Yes |
| Payment Confirmation | Successful payment event when applicable | Yes |
| Subscription Cancelled | Cancellation event | Yes |
| Usage Warning | Usage threshold reached | Yes |
| Document Ready | Async document processing completed | Yes |
| Security Notification | Important auth/security event | Yes |

Do not send marketing emails from the transactional email abstraction unless a future marketing system is explicitly introduced with consent management.

## 47.6 Verification Tokens

Verification tokens must:

- be cryptographically random
- be short-lived
- be single-use
- be stored hashed when practical
- include an expiration timestamp
- have an explicit consumed timestamp or equivalent
- be invalidated after successful verification

Suggested conceptual data:

```text
email_verification_tokens
- id
- user_id
- token_hash
- expires_at
- consumed_at
- created_at
```

Never store the raw verification token in D1.

## 47.7 Password Reset

Password reset flow:

```text
Forgot Password
  ↓
Enter email
  ↓
Generic success response
  ↓
If account exists → send reset email
  ↓
User opens short-lived reset link
  ↓
Set new password
  ↓
Invalidate reset token
  ↓
Invalidate/rotate existing sessions as appropriate
```

Public responses must not reveal whether the email exists.

Suggested conceptual data:

```text
password_reset_tokens
- id
- user_id
- token_hash
- expires_at
- consumed_at
- created_at
```

## 47.8 Magic Links

Magic links are short-lived one-time authentication credentials.

Flow:

```text
Email
  ↓
Request magic link
  ↓
Generic success response
  ↓
Email sent when applicable
  ↓
User clicks link
  ↓
Verify token
  ↓
Consume token
  ↓
Create authenticated session
```

Magic links must not be reusable.

## 47.9 Session Management

Authenticated sessions should use secure, HttpOnly cookies rather than exposing long-lived access tokens to ordinary frontend JavaScript when the deployment model allows it.

Session requirements:

- HttpOnly
- Secure in production
- SameSite=Lax or stricter where compatible
- server-side expiration/rotation
- logout invalidation
- session revocation support for security incidents

Suggested conceptual table:

```text
sessions
- id
- user_id
- session_token_hash
- created_at
- last_seen_at
- expires_at
- revoked_at
- user_agent_hash/metadata (minimal)
- ip_hash (only when required for security/abuse controls)
```

Do not store raw session tokens in the database.

## 47.10 User Email Preferences

Transactional security/account emails are mandatory. Non-essential product communications should be preference-aware.

Suggested fields/configuration:

```text
email_preferences
- user_id
- product_updates_enabled
- learning_reminders_enabled
- marketing_enabled
- updated_at
```

The application must distinguish transactional email from optional marketing/product communication.

## 47.11 Email Localization

All transactional emails must support the same initial locales as the product:

```text
en
tr
```

Email locale resolution:

```text
Authenticated user's locale
        ↓
Explicit locale associated with the email event
        ↓
English fallback
```

Email templates must never hardcode a single language into application logic.

Suggested structure:

```text
workers/api/src/email/
├── index.ts
├── provider.ts
├── templates/
│   ├── en/
│   │   ├── verification.ts
│   │   ├── welcome.ts
│   │   ├── password-reset.ts
│   │   ├── magic-link.ts
│   │   ├── subscription.ts
│   │   ├── usage-warning.ts
│   │   ├── document-ready.ts
│   │   └── security.ts
│   └── tr/
│       ├── verification.ts
│       ├── welcome.ts
│       ├── password-reset.ts
│       ├── magic-link.ts
│       ├── subscription.ts
│       ├── usage-warning.ts
│       ├── document-ready.ts
│       └── security.ts
└── types.ts
```

Use localized subject lines, headings, CTA labels, footer text, and formatting.

## 47.12 Email Sender Configuration

Use a verified LearWizAI sending domain and distinct addresses where appropriate, for example:

```text
hello@learwizai.com
noreply@learwizai.com
support@learwizai.com
billing@learwizai.com
```

The exact addresses may be configured later, but the application must treat sender identity as configuration rather than hardcoded feature logic.

Production email-domain configuration must include the provider-recommended sender authentication and anti-spoofing records (for example SPF, DKIM, and DMARC where applicable).

## 47.13 Email Sending Reliability

Email sending is an external side effect and must not make core database transactions fragile.

For important workflows:

```text
Business Event
   ↓
Persist state change
   ↓
Create email event/outbox record
   ↓
Asynchronous send
   ↓
Provider response
   ↓
Delivery/send status recorded
```

Use an outbox/event pattern when a workflow requires reliable delivery after a database state change.

Do not send an email before the corresponding critical state change is durably committed when doing so could produce inconsistent user-visible behavior.

Suggested conceptual table:

```text
email_events
- id
- event_type
- user_id
- recipient
- locale
- provider
- template_key
- status
- provider_message_id
- attempt_count
- last_error
- created_at
- sent_at
```

Do not store sensitive email content unnecessarily. Avoid storing raw authentication tokens in logs or email-event records.

## 47.14 Email Rate Limiting and Abuse Protection

Apply limits to:

- registration attempts
- verification resend requests
- password reset requests
- magic-link requests
- account recovery attempts

Use IP/user/email-based controls as appropriate, with anti-enumeration responses.

Suspicious behavior may trigger Turnstile or stricter rate limits.

Never allow an attacker to use LearWizAI as an unrestricted email-sending service.

## 47.15 Authentication and Audit Logging

Record security-relevant events in the audit/event system, for example:

```text
signup_started
signup_completed
email_verification_sent
email_verified
login_success
login_failed
logout
password_reset_requested
password_reset_completed
magic_link_requested
magic_link_consumed
oauth_login_success
session_revoked
security_notification_sent
```

Do not log:

- passwords
- raw authentication tokens
- raw session tokens
- full magic links
- password reset URLs
- API secrets
- payment secrets

Log identifiers, event type, result, request ID, timestamps, and minimal contextual metadata needed for investigation.

## 47.16 Authentication Testing

Required unit/integration/E2E coverage includes:

- successful signup
- duplicate-account-safe signup behavior
- email verification success
- expired verification token
- reused verification token
- resend verification rate limits
- successful login
- failed login
- password reset request anti-enumeration behavior
- expired reset token
- reused reset token
- successful password reset
- magic-link success
- expired/reused magic link
- session creation
- session revocation
- logout
- guest-to-account migration after verification
- guest migration retry/idempotency
- localized email rendering in English and Turkish
- email send failure handling
- email outbox retry behavior

---

# 48. Authentication Implementation Priority Update

The delivery sequence should explicitly include identity and email foundations:

```text
1. Repository + toolchain
2. Cloudflare environments + bindings
3. Design system + i18n foundation
4. Testing infrastructure + CI
5. Guest session + identity foundations
6. Authentication + Cloudflare Email Service + email templates
7. AI Tutor + AI Router + usage accounting
8. Learn Mode + Practice + Quiz
9. Guest migration + authenticated dashboard/progress
10. Documents + R2 + Queue + RAG
11. Polar + subscriptions + entitlements
12. Admin Dashboard + analytics + audit logs
13. Security hardening + abuse testing
14. Staging QA
15. Production launch
16. Observability + product metrics review
17. OpenDesign visual polish
```

Email/authentication must not be treated as a final integration task. It is part of the identity foundation and must be tested before production feature completion.

# 40. Identity, Authentication, Authorization, and Email

Authentication and authorization are first-class security domains. Do not treat signup/login as a small frontend feature. The implementation must define identity lifecycle, session management, verification, password recovery, roles, permissions, tenant boundaries, and account security before protected application features are released.

## 40.1 Identity States

A user may be in one of these states:

```text
Guest
  ↓
Pending Registration
  ↓
Email Verified / Active
  ↓
Suspended / Disabled (if needed)
```

Guest and authenticated identities are separate. A guest session must never be treated as an authenticated user.

Recommended account fields include:

```text
users
- id
- email
- email_normalized
- password_hash (nullable when using passwordless/social-only auth)
- email_verified_at
- status
- locale
- role
- created_at
- updated_at
- last_login_at
```

Do not store plaintext passwords, verification tokens, password-reset tokens, or magic-link tokens.

## 40.2 Authentication Methods

Initial authentication should support:

- Email + password
- Email verification
- Password reset
- Magic-link login where practical
- Google OAuth as a first-class MVP social-login provider

Provider-specific authentication code must remain isolated behind an authentication service/provider boundary.

Example conceptual interfaces:

```ts
interface AuthService {
  register(params: RegisterParams): Promise<RegistrationResult>;
  login(params: LoginParams): Promise<AuthResult>;
  verifyEmail(token: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(token: string, password: string): Promise<void>;
  requestMagicLink(email: string): Promise<void>;
  authenticateRequest(request: Request): Promise<Identity | null>;
  logout(sessionId: string): Promise<void>;
}
```

Do not expose provider implementation details to route handlers or frontend components.

## 40.3 Registration Flow

Preferred email/password signup flow:

```text
Guest
  ↓
Create Account
  ↓
Validate email/password
  ↓
Turnstile / abuse checks when required
  ↓
Normalize email
  ↓
Create pending account / registration state
  ↓
Generate single-use verification token
  ↓
Send localized verification email
  ↓
User clicks verification link
  ↓
Verify token
  ↓
Mark email_verified_at
  ↓
Activate account
  ↓
Migrate eligible guest data
  ↓
Create authenticated session
  ↓
Free entitlement applied
```

Do not consider a newly registered email/password account fully trusted merely because the signup request succeeded. Email verification is part of the identity lifecycle.

## 40.4 Session Management

Use server-authoritative sessions.

Recommended secure cookie characteristics:

```text
HttpOnly
Secure (production)
SameSite=Lax or stricter where compatible
Path=/
Reasonable expiration
```

The browser should not receive a long-lived bearer credential in localStorage by default.

Maintain a sessions table containing information such as:

```text
sessions
- id
- user_id
- session_token_hash
- created_at
- expires_at
- last_seen_at
- revoked_at
- ip_hash (when justified)
- user_agent_hash / metadata (when justified)
```

Store a hash of the session token in D1 rather than the raw token where practical.

Authentication middleware must resolve the current identity from the session and reject revoked or expired sessions.

Logout must revoke the server-side session.

Provide the ability to revoke all sessions after security-sensitive events such as password reset or suspected compromise.

## 40.5 Authorization

Authentication answers **who are you?** Authorization answers **what are you allowed to do?** They must remain separate concepts.

Every protected backend endpoint must perform server-side authorization.

Never rely on:

```ts
if (isPro) ...
```

in the frontend as a security control.

Use centralized authorization/entitlement services such as:

```ts
requireAuthenticatedUser(ctx)
requireRole(ctx, "admin")
requirePermission(ctx, "documents:read")
requireFeature(ctx, "document_rag")
requireOwnership(ctx, resource)
```

## 40.6 Roles and Permissions

At minimum, support:

```text
user
admin
```

Keep the model extensible for future roles such as:

```text
support
finance
analyst
content_admin
```

Prefer permission-oriented checks for sensitive operations instead of scattering role-name comparisons throughout the codebase.

Examples:

```text
users:read
users:suspend
subscriptions:read
subscriptions:manage
billing:read
analytics:read
audit:read
system:manage
```

A normal user must never be able to call admin APIs by changing a client-side field, URL, or request payload.

## 40.7 Resource Ownership / Tenant Isolation

Authorization must include ownership checks for user-scoped resources.

Examples:

```text
User A cannot read User B's:
- conversations
- messages
- documents
- quiz attempts
- progress
- recommendations
- usage records
```

For course/document scoped RAG, retrieval must be constrained using authenticated identity plus explicit resource scope.

Never trust a client-provided `user_id` for ownership decisions. Derive the authenticated user ID from the verified session.

## 40.8 Account Lifecycle

Define and test transitions for:

```text
pending
active
suspended
disabled/deleted
```

Suspended/disabled users must be rejected by authentication/authorization middleware even if they possess an otherwise valid session.

Account deletion must define what happens to:

- personal data
- uploaded documents
- R2 objects
- vector entries
- conversations
- usage records
- subscriptions
- audit records

Use a deliberate retention/deletion policy rather than ad-hoc deletion.

## 40.9 Verification and Reset Tokens

Verification, password-reset, and magic-link tokens must:

- be cryptographically random
- be short-lived
- be single-use
- be stored hashed when practical
- have explicit purpose/type
- be invalidated after successful use
- be protected against replay
- be rate-limited

Never put sensitive permanent credentials into email URLs.

A token endpoint must not reveal whether an email address belongs to an existing account when that would enable account enumeration.

Use generic responses such as:

> If an account can receive this email, instructions have been sent.

## 40.10 Password Security

Passwords must be hashed with a modern password-hashing algorithm supported by the chosen authentication implementation. Never use plain SHA-256 or other fast general-purpose hashes for password storage.

Password policy should favor strong, usable passwords rather than arbitrary composition rules. Enforce a minimum length and reject clearly unsafe/common passwords where practical.

Never log passwords or reset tokens.

## 40.11 Brute Force / Abuse Protection

Authentication endpoints require strict rate limiting.

Protect:

```text
/signup
/login
/password-reset/request
/password-reset/confirm
/magic-link/request
/email-verification
/oauth/callback
```

Use combinations of:

- IP-based limits
- account/email-based limits
- guest-session limits
- progressive backoff
- Turnstile when suspicious
- generic error responses to reduce enumeration

Do not lock a legitimate account indefinitely because another party is attacking it.

## 40.12 OAuth / Social Login

Google OAuth is part of the MVP authentication surface. It is an authentication provider only; LearWizAI remains the source of truth for sessions, roles, authorization, subscriptions, and entitlements.

Required Google scopes for the initial implementation:

```text
openid
email
profile
```

Do not request Gmail, Drive, Calendar, or other Google API scopes. The application does not need Google API data access for authentication.

Google OAuth flow:

```text
Browser
  ↓
OAuth provider
  ↓
Callback Worker
  ↓
Validate state / authorization result
  ↓
Resolve verified identity
  ↓
Find or create user
  ↓
Link identity safely
  ↓
Create session
```

Protect OAuth flows against CSRF/login-CSRF with state validation. Validate issuer, audience, redirect URI, and identity claims according to the provider's documented flow.

Keep social identities separate from the core `users` record when useful:

```text
user_identities
- id
- user_id
- provider
- provider_subject
- email_at_link_time
- created_at
```

Do not use email matching alone as the only identity-linking rule unless the provider guarantees a verified identity model appropriate for the flow.

Google-specific requirements:

- Use a Google OAuth 2.0 / OpenID Connect flow appropriate for a server-side application.
- Store the OAuth client secret only in Cloudflare Worker secrets. Never expose it to the browser bundle.
- Validate the OAuth `state` value and protect against login-CSRF.
- Validate issuer, audience, redirect URI, and the authorization result.
- Use the provider subject (`sub`) as the stable external identity key.
- Prefer Google-provided verified identity claims rather than trusting an unverified email string.
- Do not automatically merge an existing password account solely because the Google email matches unless the account-linking flow explicitly verifies ownership and applies the configured policy.
- Create a local LearWizAI session after successful Google authentication; do not use Google access tokens as the application's session mechanism.
- Persist the provider identity in `user_identities`; keep the core `users` record provider-agnostic.
- If a guest session is present, migrate eligible guest data only after the Google identity has been successfully authenticated and the local account/session has been established.
- Apply the same auth rate limits, abuse detection, Turnstile escalation, suspension checks, audit logging, and authorization middleware to Google-authenticated users as to email/password users.
- Google OAuth does not grant any LearWizAI role or plan by itself.

Recommended callback route:

```text
GET /auth/google/callback
```

Recommended client initiation route:

```text
GET /auth/google/start
```

Use environment-specific OAuth client configuration for development, staging, and production.

## 40.13 Authentication / Authorization Matrix

Authentication method does not determine authorization. Every authenticated identity is resolved into a local LearWizAI user, then authorization is evaluated using local role, account status, resource ownership, and subscription entitlements.

```text
Google OAuth / Email+Password / Magic Link
                ↓
        Local LearWizAI User
                ↓
        Session Authentication
                ↓
       Authorization Middleware
                ↓
 Role + Ownership + Entitlement Checks
                ↓
          Route / Feature
```

Examples:

- A Google-authenticated Free user cannot access Learner-only document RAG.
- An email/password Learner user can access document RAG if the subscription is active.
- An authenticated user cannot access another user's document even when the endpoint is known.
- An authenticated `user` cannot access admin routes.
- An authenticated but suspended user cannot access protected application operations.

## 40.14 Email Architecture

Use Cloudflare Email Service as the initial transactional email provider, behind an application-level abstraction.

```text
EmailProvider
      ↓
CloudflareEmailProvider
```

Future providers such as Resend/Postmark must be swappable without changing application business logic.

Example:

```ts
interface EmailProvider {
  sendVerificationEmail(params: VerificationEmailParams): Promise<void>;
  sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<void>;
  sendMagicLinkEmail(params: MagicLinkEmailParams): Promise<void>;
  sendWelcomeEmail(params: WelcomeEmailParams): Promise<void>;
  sendSubscriptionEmail(params: SubscriptionEmailParams): Promise<void>;
  sendUsageWarningEmail(params: UsageWarningEmailParams): Promise<void>;
  sendDocumentReadyEmail(params: DocumentReadyEmailParams): Promise<void>;
}
```

Initial important email types:

```text
Email verification
Welcome
Password reset
Magic login link
Subscription activated
Payment/subscription status
Subscription cancellation
AI usage warning
Document processing completed
Security notifications
```

Do not send promotional email from the transactional pipeline without explicit product/consent rules.

## 40.14 Email Localization

All system emails must support:

```text
en
tr
```

Use the user's saved locale when known. For a newly created account whose locale is not yet stored, use the locale resolved during signup/guest session where appropriate.

Each transactional email must have:

```text
subject
preview text
HTML body
plain-text body
```

Do not build email HTML directly inside route handlers. Use reusable localized email templates.

Suggested structure:

```text
workers/api/src/email/
├── provider/
│   ├── EmailProvider.ts
│   └── CloudflareEmailProvider.ts
├── templates/
│   ├── verification/
│   │   ├── en.ts
│   │   └── tr.ts
│   ├── password-reset/
│   │   ├── en.ts
│   │   └── tr.ts
│   ├── magic-link/
│   │   ├── en.ts
│   │   └── tr.ts
│   ├── welcome/
│   │   ├── en.ts
│   │   └── tr.ts
│   └── subscription/
│       ├── en.ts
│       └── tr.ts
└── email-service.ts
```

## 40.15 Email Domain and Deliverability

Production email sending must use a verified LearWizAI sending domain with appropriate DNS authentication such as SPF, DKIM, and DMARC.

Suggested addresses:

```text
hello@learwizai.com
noreply@learwizai.com
support@learwizai.com
billing@learwizai.com
```

Do not hardcode an email address throughout the codebase; use environment/configuration values for the sender identity.

Do not expose provider credentials to the frontend.

## 40.16 Security / Audit Logging

Authentication and authorization events must produce structured audit events when relevant.

Examples:

```text
user.signup_started
user.signup_completed
user.email_verified
user.login_success
user.login_failed
user.logout
user.password_reset_requested
user.password_reset_completed
user.magic_link_requested
user.session_revoked
user.role_changed
user.suspended
admin.authorization_denied
```

Do not log passwords, raw tokens, full authorization headers, or other secrets.

Audit logs are distinct from ordinary application logs.

## 40.17 Authentication Testing

Unit tests:

- password policy
- token generation/expiry logic
- locale selection
- authorization decisions
- permission checks
- ownership checks
- session expiry/revocation

Integration tests:

- signup
- email verification
- login
- logout
- password reset
- magic-link login
- guest-to-user migration
- suspended-user rejection
- admin endpoint authorization
- OAuth callback validation when enabled

Security tests:

- authentication bypass attempts
- IDOR/ownership bypass
- privilege escalation
- session fixation
- replay of verification/reset tokens
- brute-force/rate-limit behavior
- CSRF protections where applicable
- OAuth login-CSRF protection

E2E minimum:

```text
Guest
  → use product
  → registration wall
  → signup
  → verification email flow
  → authenticated session
  → guest data migration
  → Free plan access
```

and:

```text
Normal User
  → cannot access admin routes

Admin
  → can access admin dashboard
```

# 41. Admin / Operations Dashboard

LearWizAI must include a protected internal admin dashboard. It is separate from the end-user learning application.

Primary goals:

1. Understand product usage.
2. Operate users/subscriptions safely.
3. Diagnose errors and AI failures.
4. Monitor AI/infrastructure cost signals.
5. Investigate abuse/security events.
6. Monitor document/RAG processing.
7. Measure guest-to-account conversion and product health.

## 41.1 Admin Route

Suggested:

```text
/en/admin
/tr/admin
```

All admin routes require:

```text
Authenticated user
  ↓
Role/permission check
  ↓
Admin dashboard
```

Never expose the admin dashboard through a client-side-only route guard. Backend authorization is mandatory.

## 41.2 Admin Navigation

Suggested sections:

```text
Overview
Users
Subscriptions
AI Usage
Documents
Activity / Audit Logs
System Health
Settings
```

## 41.3 Overview Dashboard

Show high-level operational and product metrics:

```text
Active Users
DAU / WAU / MAU
New Signups
Guest → Account Conversion
Active Subscriptions
MRR / ARR
Cancellations
AI Requests
AI Tokens / Neurons
Estimated AI Cost
Error Rate
P95 Latency
Document Processing Backlog
```

Do not expose raw infrastructure complexity when a meaningful product metric is more useful.

## 41.4 Users

Provide searchable/paginated users with:

- user ID
- email
- status
- role
- plan
- locale
- created date
- last login
- AI usage
- subscription status

Admin actions must be permission-controlled and auditable.

Possible actions:

- view account
- view sessions
- revoke sessions
- suspend/unsuspend
- view subscription
- view usage

Destructive actions require confirmation and audit logging.

## 41.5 User Detail

A user detail page should provide separate tabs/sections for:

```text
Profile
Sessions
Usage
Subscription
Learning Activity
Documents
Audit Events
```

Never show passwords, raw session tokens, reset tokens, or other secrets to admins.

## 41.6 Subscription Dashboard

Show:

- plan
- status
- monthly/annual billing
- current period
- cancellation state
- provider/customer IDs where safe
- latest webhook status
- payment/subscription event history

Actions such as cancellation or entitlement corrections must go through a backend service and be audited.

## 41.7 AI Usage Dashboard

Show:

```text
Requests
Input tokens
Output tokens
Cached tokens
Neurons
Estimated cost
Requests by model
Requests by feature
Requests by plan
Requests by locale
Average latency
P50/P95/P99 latency where available
Failure rate
Fallback rate
```

Allow filtering by:

```text
Time range
User
Plan
Model
Feature
Locale
```

Use Analytics Engine/high-cardinality telemetry for heavy analytics rather than repeatedly scanning large D1 tables.

## 41.8 Logs and Audit

Separate:

```text
Application logs
Audit logs
Security events
```

Application logs are for diagnosis. Audit logs are for important state changes and security-sensitive actions.

Admin UI should support filtering and pagination.

Never render raw secrets or full token values.

## 41.9 Document / RAG Operations

Show document processing states:

```text
Uploaded
Queued
Processing
Chunking
Embedding
Indexed
Failed
```

Provide failure reason summaries and retry actions where safe.

A retry must be idempotent or protected from duplicate processing.

## 41.10 System Health

Show operational signals:

- Worker error rate
- API latency
- Workers AI failures
- fallback rate
- Queue backlog/failures
- D1 errors
- R2 failures
- Vectorize retrieval errors
- Polar webhook failures
- Email send failures

The dashboard is an operational aid, not a replacement for Cloudflare's native observability tools.

## 41.11 Admin Security

Admin accounts require stronger controls than normal users.

Recommended:

- MFA when supported by the authentication implementation
- stricter session expiry
- admin activity audit logs
- separate admin permissions
- no shared admin accounts
- re-authentication for sensitive actions

## 41.12 Admin Testing

E2E and integration tests must verify:

```text
User → /admin → 403/denied
Admin → /admin → allowed
Admin → sensitive action → permission check → audit event
```

# 42. Software Development Lifecycle (SDLC)

Development must follow a repeatable lifecycle rather than directly coding features without validation.

## 42.1 Feature Lifecycle

Every meaningful feature follows:

```text
Requirement
   ↓
Acceptance Criteria
   ↓
Technical Design
   ↓
Data/API Design
   ↓
Implementation
   ↓
Unit Tests
   ↓
Integration Tests
   ↓
Frontend/E2E Tests when applicable
   ↓
Code Review
   ↓
Staging Deployment
   ↓
QA / Acceptance
   ↓
Production Deployment
   ↓
Monitoring
   ↓
Post-release verification
```

## 42.2 Definition of Ready

A feature is ready for implementation only when:

- product behavior is clear
- acceptance criteria exist
- affected routes/components are known
- data changes are identified
- security/authorization impact is considered
- localization impact is considered
- testing approach is identified
- observability requirements are identified where relevant

## 42.3 Definition of Done

A feature is not done until:

- implementation complete
- TypeScript typecheck passes
- lint passes
- unit tests pass
- relevant integration tests pass
- relevant E2E tests pass
- localization keys exist in EN/TR
- authorization is enforced server-side
- loading/error/empty states exist
- accessibility is considered
- migrations are reviewed
- logs/metrics exist where operationally necessary
- code reviewed
- staging verified
- production verification completed

## 42.4 Branching / Pull Requests

Prefer short-lived branches and focused pull requests.

Recommended:

```text
main
  ↑
feature/*
fix/*
chore/*
```

Do not mix unrelated refactors into feature PRs unless necessary for correctness.

## 42.5 Code Review Checklist

Reviewers should check:

- correctness
- security
- authorization
- tenant isolation
- error handling
- performance
- unnecessary database queries
- migration safety
- test coverage
- localization
- accessibility
- observability
- secret handling

## 42.6 Release Strategy

Use:

```text
development → staging → production
```

High-risk changes should be feature-flagged where practical.

For schema changes that require compatibility:

```text
expand
  ↓
backfill/migrate
  ↓
application switch
  ↓
contract
```

Avoid destructive database changes in the same release that first depends on them unless rollback is proven safe.

## 42.7 Rollback

Every production change must have a rollback or mitigation plan.

For application code:

- redeploy previous known-good version where possible

For database changes:

- prefer backward-compatible migrations
- never assume a migration can always be reversed automatically
- document manual remediation when required

For AI model changes:

- keep a known-good fallback model/configuration
- record model versions in usage telemetry

# 43. Expanded Testing Strategy

Testing is a required engineering activity, not a post-release step.

## 43.1 Test Pyramid

```text
             E2E
          /-------\\
       Integration
      /-------------\\
          Unit
```

Most logic should be covered with fast unit tests. Integration tests verify boundaries. E2E tests cover critical user journeys.

## 43.2 Unit Testing

Cover:

- entitlement calculations
- quota calculations
- token lifecycle
- locale resolution
- AI router decisions
- validation schemas
- guest migration rules
- ownership/authorization rules
- billing adapter mapping
- webhook event mapping
- email template selection
- recommendation rules

## 43.3 Integration Testing

Cover:

- Worker routes + D1
- authentication flows
- sessions
- guest migration
- subscription webhook handling
- Polar adapter
- EmailProvider adapter
- document processing pipeline
- RAG access control
- AI usage accounting
- admin permission enforcement

External providers should be mocked or sandboxed in tests; production credentials must never be used in automated CI.

## 43.4 E2E Testing

Critical journeys:

1. Guest → Tutor → guest limit → signup → verification → migration.
2. User → login → dashboard → learn → practice → progress.
3. User → upload document → processing → RAG chat.
4. User → pricing → checkout → webhook → entitlement.
5. User → password reset → login.
6. Admin → dashboard → user lookup → audit event.

## 43.5 API / Contract Testing

Validate that API request/response schemas remain compatible between frontend and Worker.

Shared TypeScript schemas/types may be used where practical.

Breaking API changes require coordinated frontend/backend changes.

## 43.6 Security Testing

At minimum test:

- IDOR
- privilege escalation
- unauthenticated access to protected endpoints
- suspended-session access
- rate-limit bypass
- CSRF/login-CSRF where relevant
- token replay
- webhook forgery
- prompt injection through RAG
- malicious document metadata
- unsafe file upload behavior
- secret leakage in logs

## 43.7 Performance Testing

Monitor and test critical paths such as:

- login
- AI Tutor request
- quiz generation
- RAG retrieval
- document upload initiation
- document-processing queue throughput

Track P50/P95 latency where useful.

Do not optimize prematurely; establish baselines first.

# 44. Admin / Product Analytics Model

Product analytics must distinguish at least three categories:

```text
Product Analytics
Operational Telemetry
Audit/Security Logs
```

## Product Analytics

Examples:

- signup conversion
- guest-to-account conversion
- activation
- feature usage
- learning completion
- quiz completion
- plan conversion
- churn

## Operational Telemetry

Examples:

- latency
- errors
- model failures
- queue backlog
- database errors
- email failures

## Audit/Security Logs

Examples:

- role changes
- subscription changes
- account suspension
- session revocation
- admin actions
- security-sensitive events

Do not attempt to make one log table serve every purpose.

# 45. Email and Auth Implementation Order

Authentication work should be implemented in this order:

```text
1. User/session schema
2. Auth context + identity resolution
3. Signup
4. Verification token lifecycle
5. Email Provider abstraction
6. Cloudflare Email Service integration
7. Login/logout
8. Password reset
9. Google OAuth
10. Guest → account migration
11. Authorization middleware
12. Role/permission system
13. Admin protection
14. Magic link
15. Security hardening + audit events
16. E2E auth test suite
```

Do not enable protected product features before authentication and authorization middleware are actually enforced server-side.
