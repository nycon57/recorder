Database Schema and Design

This document describes the PostgreSQL database schema in detail. It lists each table, its purpose, key columns (with types), relationships (foreign keys), and any access rules or constraints. The schema is designed to support multi-organization data separation, the recording-to-document pipeline, and the vector search capabilities. All tables use singular names (for clarity) and are organized to minimize data duplication while ensuring efficient queries.

Overview

Our database is PostgreSQL with the pgvector extension enabled for vector similarity search. We use UUIDs as primary keys for most tables (except where noted) to have globally unique identifiers, especially since data is multi-tenant. The schema is normalized to avoid data anomalies, but we also consider indexing and query patterns to optimize performance.

Every table that is organization-specific will have an org_id column referencing the Organizations table. This ensures row-level security (RLS) policies can enforce tenant isolation (if using Supabase or custom RLS rules). For simplicity and clarity, all foreign keys (user_id, org_id, etc.) are explicitly stored rather than relying solely on an external auth token.

Below is a table-by-table breakdown:

Tables

1. users

Stores application users. Even though we use Clerk for authentication, we maintain a users table to track additional metadata and to join with content.
	•	user_id UUID PRIMARY KEY: Unique identifier for the user (we generate this, or we can use Clerk’s user ID as UUID if possible). Alternatively, we could use a text ID from Clerk (like user_abc123), but a UUID gives consistency.
	•	clerk_id TEXT UNIQUE: (Optional) The Clerk-provided user ID, if not using it as primary key. This helps link back to Clerk.
	•	email TEXT: User’s email address. (We may store this for convenience, even though Clerk has it, to use in RLS policies or to display in the UI without extra API calls.)
	•	name TEXT: Full name or display name.
	•	created_at TIMESTAMPTZ DEFAULT now(): Timestamp when the user was first registered in our DB.
	•	last_login TIMESTAMPTZ: (Optional) Last time the user logged in (could be updated via webhook or on session verify).

Purpose: This table holds core profile info and serves as the target for any foreign key that needs to reference a user (e.g., who created a recording). It might also be used for analytics (number of active users, etc.). Access: Generally, a user can view their own data here (via Clerk session) but not others’ personal info except maybe name. In an org context, user names/emails might be visible to org mates for identification.

Access Rules: If using RLS, we’d allow a user to select their own row (using something like auth.uid() = user_id if we include the sub in JWT). For admins, we might allow reading all users in their org via a join on membership (see below). However, we can also avoid exposing this table directly and fetch user names via our backend code when needed.

2. organizations

Represents an organization (tenant workspace).
	•	org_id UUID PRIMARY KEY: Unique identifier for the org.
	•	name TEXT: Organization name (e.g., company or team name).
	•	clerk_org_id TEXT UNIQUE: (Optional) If using Clerk Organizations, their ID for this org. We can store it to reconcile membership automatically.
	•	created_at TIMESTAMPTZ DEFAULT now(): When the org was created.
	•	created_by UUID REFERENCES users(user_id): Who created the org (usually the first user, automatically an admin).
	•	plan TEXT: The subscription plan or tier (e.g., “free”, “pro”, “enterprise”). This is updated via billing events, and can be used to enforce limits (like number of recordings).
	•	settings JSONB: (Optional) Misc org-level settings, e.g., whether public sharing is allowed, org logo URL, etc.

Purpose: Defines a tenant. All content is tied to an org. We will enforce that any user action is scoped to their current org. This also stores billing plan which might gate certain features or usage quotas.

Access Rules: Typically, only members of an org can see its details. RLS can enforce that a selecting user must be a member (we can maintain a membership table to check). Clerk’s JWT might carry org context; if so, auth.org_id() = org_id could be used in RLS. In our backend, we’ll fetch org info for display (e.g., show org name in UI). Non-members cannot see this table’s data at all.

3. user_organizations (Memberships)

Join table connecting users to organizations, with roles.
	•	user_id UUID REFERENCES users(user_id) ON DELETE CASCADE: The user in the org.
	•	org_id UUID REFERENCES organizations(org_id) ON DELETE CASCADE: The organization.
	•	role TEXT: Role of the user in the org (e.g., ‘admin’, ‘member’). We can default this to ‘member’ and have one user (creator) as ‘admin’, or use Clerk’s roles if syncing.
	•	joined_at TIMESTAMPTZ DEFAULT now(): When the user joined the org.
	•	invited_by UUID: Who invited the user (if applicable).

Composite primary key on (user_id, org_id) to ensure uniqueness of membership.

Purpose: Enables many-to-many between users and orgs (since a user can be in multiple orgs, and each org has multiple users). It’s central for permission checks. For example, to list all recordings a user can access, we ensure recordings.org_id IN (orgs the user is a member of).

Access Rules: A user should only see memberships for orgs they belong to. RLS example: user_id = auth.uid() allows a user to see their own membership entries (and thereby see which orgs they belong to, and their role). Alternatively, we might not expose this table directly in API, using it only for joins in server queries. For admin actions (like listing all members of my org), we could allow if org_id in a subquery of orgs where that admin has role ‘admin’.

4. recordings

Each row represents a recording (the source video content). This is a primary table in the pipeline.
	•	recording_id UUID PRIMARY KEY: Unique ID for the recording.
	•	org_id UUID REFERENCES organizations(org_id): The organization that owns this recording.
	•	user_id UUID REFERENCES users(user_id): The user who created/recorded it.
	•	title TEXT: A title for the recording (could be user-provided or auto-generated from content or filename). Defaults to something like “Untitled Recording” or the date if not set.
	•	description TEXT: (Optional) A brief description of the recording’s content.
	•	video_url TEXT: URL or storage key for the video file. If using Supabase, this might be a path like recordings/recording_id.webm. If using S3, a full s3 or CDN URL. We store it for retrieval. (We might also store a thumbnail_url or key if we generate thumbnails.)
	•	duration INT: Length of the video in seconds (for quick reference and UI).
	•	status TEXT: Current processing status. Allowed values: ‘uploaded’, ‘transcribing’, ‘transcribed’, ‘doc_generating’, ‘completed’, ‘error’.
	•	error_message TEXT: If status = ‘error’, details on what went wrong.
	•	created_at TIMESTAMPTZ DEFAULT now(): When recording entry was created (initiated).
	•	completed_at TIMESTAMPTZ: When processing (transcript+doc) was fully done.

Indexes: We’ll index org_id (since we often query recordings by org) and possibly user_id for filtering by creator. We might also index status if we frequently query incomplete items for a worker to pick up, but if we use external triggers, maybe not necessary.

Purpose: Represents the primary content object. The pipeline updates its status as things progress. We also use this table for listing content in the UI (e.g., “My Recordings”). Title and description help in identifying and searching. Relations: one recording has one transcript (see transcripts table) and one document (see documents table), and many transcript chunks (for vector search). We separate those for performance and size reasons.

Access Rules: Only members of the same org should access a recording. RLS: org_id = auth.org_id() (if JWT has org claim) ensures isolation. Additionally, we might allow only the owner or admins to delete or update certain fields. For example, allow anyone in org to read, but to delete or modify a recording, either the user_id matches the auth user (they own it) or the auth user has admin role via membership. This can be done with a check against membership on writes (Supabase RLS can use subqueries, or in our server logic we enforce it).

5. transcripts

Stores the full transcript text for each recording (one-to-one relationship).
	•	recording_id UUID PRIMARY KEY REFERENCES recordings(recording_id) ON DELETE CASCADE: Use the same ID as the recording for convenience (1-1). Also serves as primary key.
	•	text TEXT: The full transcript text (could be very long for lengthy videos). We store it as one large text blob.
	•	language TEXT: Language code (e.g., ‘en’, ‘es’) detected or used for transcription.
	•	transcribed_at TIMESTAMPTZ: When the transcription was completed.
	•	updated_at TIMESTAMPTZ: When the transcript was last updated (in case user edits it).
	•	words JSONB: (Optional) Could store structured data like an array of words with timestamps, or paragraphs with timestamps. Alternatively, we might have a separate table for timing if we want fine-grained search. But storing as JSONB is an option (e.g., an array of objects { word, start_time, end_time }).

Purpose: Holds the raw text output of the speech-to-text process. Kept separate to avoid slowing down queries on recordings list (we don’t want to always pull giant transcript text when listing recordings). Also, easier to manage updates to transcript without touching recording metadata. This is useful for search and for feeding to document generation.

Access Rules: Same as recording – accessible only within org. We usually fetch a transcript by joining with recording to ensure org context. One could also enforce via RLS that recording_id in a subquery of recordings the user has access to.

6. documents

Stores the AI-generated structured document for a recording.
	•	recording_id UUID PRIMARY KEY REFERENCES recordings(recording_id) ON DELETE CASCADE: 1-1 with recording (each recording has at most one doc, initially).
	•	content TEXT: The generated document content, likely in Markdown (or some markup). Could be quite long.
	•	summary TEXT: (Optional) A short summary or excerpt of the recording (if we generate a summary separately).
	•	generated_at TIMESTAMPTZ: When the document was first generated.
	•	updated_at TIMESTAMPTZ: When it was last edited by a user.
	•	generator_model TEXT: Which AI model was used (e.g., ‘gpt-4’ or ‘gpt-3.5’) for reference.
	•	version INT: Version number if we regenerate multiple times. Starting at 1.
	•	is_published BOOLEAN DEFAULT FALSE: Whether this document is marked for public sharing (see product-features on publishing). If true, an anonymous link can access it (with possibly another table to hold the token or just use recording_id in a hashed form).

Purpose: Contains the refined knowledge artifact. It’s stored separately since it’s a different representation of the content (not the verbatim transcript). The user can edit it, so it diverges from the transcript. We may want to track versions in the future (either here or separate table), but for now a single current content is stored.

Access Rules: Tied to recording’s org; same access. If is_published is true, we might allow read access without auth via a specific endpoint that checks this flag (or via a separate signed token). But within app, only org members can normally fetch it. Edits should be allowed to the recording owner or any member (depending on collaboration decisions). Possibly only owner and admins can edit docs – we’ll enforce in app logic or via RLS (we could allow update if user_id = auth.uid() or user is admin).

7. transcript_chunks

Stores chunks of transcript or document content for vector embedding. Each row is a semantic chunk with its embedding vector.
	•	chunk_id BIGSERIAL PRIMARY KEY: Unique ID for the chunk (could use UUID, but serial is fine since mainly internal).
	•	recording_id UUID REFERENCES recordings(recording_id) ON DELETE CASCADE: Which recording this chunk is from.
	•	org_id UUID: Denormalization of org (we might store org_id here as well for easy filtering without join, because we will often filter by org when querying vectors).
	•	text TEXT: The content of this chunk (a sentence or paragraph from transcript or doc).
	•	embedding vector(1536): The embedding vector for the text, using pgvector type. (1536 dim if using OpenAI’s Ada, adjust if using a different model).
	•	index INT: The position of this chunk in the source transcript/doc (like chunk 0,1,2…). This could help if we need to reconstruct context or for debugging results order.
	•	source_type TEXT: Indicates origin of chunk, e.g., ‘transcript’ or ‘document’. We might choose to embed only transcripts initially (then source_type might not be needed). But if we embed both, this helps to know where the text came from.
	•	metadata JSONB: (Optional) Additional metadata like {"start_time": 120.5, "end_time": 150.0} if chunk aligns to a portion of video, or section titles.

Indexes: A vector index for embedding (HNSW or IVF index via pgvector) for similarity search. Also an index on org_id so we can efficiently apply org filter (some queries might do WHERE org_id = X ORDER BY embedding <-> query limit k, which will use the ivfflat index that can include an additional condition, or we might need a partial or separate approach; HNSW in pgvector can support an additional filter in the WHERE clause).

Purpose: This is the backbone for semantic search. By chunking the text, we capture fine-grained pieces of knowledge. Each chunk is like a Q&A snippet that the AI assistant can use. We separate it to optimize vector operations (we don’t run those on the full text), and to allow limiting search to an org easily. Also, if we use Pinecone later, this table’s data would be what we sync to Pinecone.

Access Rules: Only accessible within org. If someone somehow queried this table, they should only see rows where org_id matches theirs. RLS: org_id = auth.org_id(). In practice, our app will not directly expose this table; instead, the backend will perform vector searches and return results in a user-friendly way. But RLS is a good safety net.

8. jobs (or pipeline_tasks)

Optional: Track asynchronous pipeline jobs for processing. This can log steps like transcription, doc generation, embedding.
	•	job_id UUID PRIMARY KEY: ID for the job.
	•	recording_id UUID REFERENCES recordings(recording_id) ON DELETE CASCADE: Related recording.
	•	type TEXT: ‘transcription’ | ‘doc_generation’ | ‘embedding’ etc.
	•	status TEXT: ‘pending’ | ‘in_progress’ | ‘completed’ | ‘failed’.
	•	created_at TIMESTAMPTZ DEFAULT now().
	•	started_at TIMESTAMPTZ.
	•	finished_at TIMESTAMPTZ.
	•	error_message TEXT: if failed.
	•	attempt INT: attempt count for retries.

We might not need this if we handle state just in recordings.status and use external services for workflow. But if multiple jobs can run or be retried, tracking here helps. For example, if doc generation fails but transcript is fine, we could just mark that job failed and allow retry without resetting transcription status.

Purpose: Provide resilience and audit trail for background tasks. Could be used by a worker process to pick up pending jobs in queue (if we use DB as queue), or just to store events from external webhooks (like “transcription done”).

Access Rules: Orgs probably don’t need direct access; it’s internal. But if needed (maybe to show an admin a pipeline log), we’d restrict by org via join on recording.

Relations and Notable Constraints
	•	A user can belong to many orgs (user_organizations), and an org has many users.
	•	A recording belongs to one org and one user (owner). An org has many recordings; a user can have many recordings (those they created).
	•	Transcript and Document are each 1-1 with Recording (sharing the same primary key ID as recording_id). This means we can use LEFT JOIN transcripts ON recordings.recording_id = transcripts.recording_id to get transcript data easily in queries.
	•	Transcript_chunks are many-to-1 with Recording. They also have org stored to ease filtering.
	•	Delete behavior:
	•	If a recording is deleted, cascade to transcript, document, chunks, jobs – so no orphan data.
	•	If a user is removed, we might keep their recordings (since knowledge stays with org). We may set user_id to NULL or to a special “deleted user” marker, rather than cascade delete recordings. So perhaps user_id should be nullable and on user deletion we do a soft approach. But with Clerk, user deletion is rare. We’ll keep ON DELETE CASCADE on user_organizations, but not on recordings.user_id. Instead, handle in application if needed (or disallow user deletion if it has data).
	•	If an org is deleted (like a company offboards), we cascade to all recordings and related data to truly wipe it. Or we might soft-delete orgs for safety.
	•	Row Level Security (RLS): If using Supabase or Postgres RLS, we enable it on all tables. Example policies:
	•	For recordings: SELECT policy: org_id = current_setting('jwt.claims.org_id')::uuid (in Supabase’s case, they might cast the claim). Similar for transcripts, docs, chunks by joining or since they share org via recording or direct field.
	•	Insert: Only allow if the org_id of the new row is one of the orgs the user is member of (we can check via membership table – a subquery like EXISTS (SELECT 1 FROM user_organizations m WHERE m.org_id = new.org_id AND m.user_id = auth.uid())).
	•	Update/Delete: Only if user has permission – either owner or admin. Could check membership role or recording.user_id for updates. Alternatively, in app logic we enforce those for now.

If using Supabase, we’d heavily rely on RLS with the JWT. If not, our API endpoints will implement these access checks manually using the membership info from Clerk (e.g., clerk provides current org and role in session, or we query our membership table for that user and org).

Example Schema (DDL Excerpts)

Below are representative DDL statements for a subset of tables to illustrate:
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id TEXT UNIQUE,
    email TEXT,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_login TIMESTAMPTZ
);

CREATE TABLE organizations (
    org_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    clerk_org_id TEXT UNIQUE,
    plan TEXT DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES users(user_id)
);

CREATE TABLE user_organizations (
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations(org_id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY(user_id, org_id)
);

CREATE TABLE recordings (
    recording_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(org_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id),
    title TEXT,
    description TEXT,
    video_url TEXT,
    duration INT,
    status TEXT NOT NULL DEFAULT 'uploaded',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Transcript & document share ID with recording:
CREATE TABLE transcripts (
    recording_id UUID PRIMARY KEY REFERENCES recordings(recording_id) ON DELETE CASCADE,
    text TEXT,
    language TEXT,
    transcribed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    words JSONB
);

CREATE TABLE documents (
    recording_id UUID PRIMARY KEY REFERENCES recordings(recording_id) ON DELETE CASCADE,
    content TEXT,
    summary TEXT,
    generated_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    generator_model TEXT,
    version INT DEFAULT 1,
    is_published BOOL DEFAULT FALSE
);

CREATE TABLE transcript_chunks (
    chunk_id BIGSERIAL PRIMARY KEY,
    recording_id UUID REFERENCES recordings(recording_id) ON DELETE CASCADE,
    org_id UUID NOT NULL,
    text TEXT,
    embedding vector(1536),
    index INT,
    source_type TEXT,
    metadata JSONB
);
-- Index for vector search (pgvector):
CREATE INDEX idx_chunks_embedding ON transcript_chunks USING ivfflat (embedding) WITH (lists=100);
CREATE INDEX idx_chunks_org ON transcript_chunks(org_id);

(We would also create indexes on recordings for org_id, maybe on user_id, etc., and perhaps a composite on org_id + recording_id for quick org scoping.)

Note: The actual SQL might differ slightly depending on whether we use Supabase (which would use auth.uid() instead of a direct JWT setting). The above is illustrative.

Data Access Patterns
	•	Listing Recordings: Query SELECT recording_id, title, status, created_at, user_id FROM recordings WHERE org_id = currentOrg ORDER BY created_at DESC. Possibly join users to get name of owner for display. Since transcripts and docs are not needed in the list, we don’t join them here.
	•	Viewing a Recording Detail: Query recordings by id (with org check), join transcript and document. E.g., SELECT r.*, t.text, d.content FROM recordings r LEFT JOIN transcripts t ON r.recording_id=t.recording_id LEFT JOIN documents d ON r.recording_id=d.recording_id WHERE r.recording_id = X AND r.org_id = currentOrg. This fetches everything needed (video URL, status, transcript text, doc content).
	•	Vector Search: We will run a function to search chunks. For example, in Postgres: SELECT recording_id, text, (embedding <-> query_vec) AS distance FROM transcript_chunks WHERE org_id = currentOrg ORDER BY embedding <-> query_vec LIMIT 5;. This returns top relevant chunks and which recording they belong to. We then likely join or map back to get perhaps the recording title or doc content around that. We might store enough context in metadata (like chunk start time or chunk order) to allow fetching neighboring chunks if needed for more context.
	•	Maintaining org isolation: If using RLS, these queries automatically restrict by current user’s org claim. If not, every query in our backend includes an org filter derived from session info. This double layer ensures a query can never mix data from multiple orgs.
	•	Deletion cascade: When a recording is deleted (by user action or org cleanup), the database will remove its transcript, document, chunks, and any jobs referencing it. We need to ensure to also delete the actual video file from storage separately (that’s outside DB scope).

Access Control Summary

We rely on a combination of:
	•	Application-level checks: Our API endpoints will verify that the current session user is allowed to perform the action (e.g., only owner or admin can delete a recording, as per business rules).
	•	Database constraints/RLS: To enforce tenant isolation and basic access:
	•	RLS ensures a user can’t query or alter data outside their org even if they somehow manipulate an API call.
	•	The schema itself (foreign keys and cascades) prevents data inconsistencies (e.g., can’t have a recording with an org_id that doesn’t exist, etc.).

If using Supabase, each request will carry a JWT with sub = user_id and org_id (we might customize Clerk’s JWT to include org_id and role in custom claims, or use Supabase JWT if we sync users to Supabase). Then RLS policies use those. If not using Supabase RLS, our Node backend will query with proper filters and never expose raw table access to the client.

Future Schema Considerations
	•	We might introduce a comments table (recording_comments) with fields (comment_id, recording_id, user_id, text, timestamp) to allow discussion on recordings. This would reference recordings and users and be isolated by org via the recording join.
	•	A billing table could track Stripe subscription IDs, customer IDs, etc., possibly linking to organizations.
	•	For analytics, a events table could log things like “user X asked question Y at time Z” or “video viewed” but this might also be handled by an external analytics service rather than clogging our primary DB.
	•	If we allow tags or categories on recordings, a tags table and a join table recording_tags could be added to filter and organize content (with org context).
	•	If performance becomes an issue with the vector search in Postgres at scale, we might stop adding to transcript_chunks and instead use an external vector DB. In that case, transcript_chunks would either be replaced or only used for testing, and Pinecone would hold vectors. But we would keep something like transcript_chunks schema for the sake of data completeness and perhaps to allow local fallbacks or migrations.

Every column and relationship in this schema is chosen to support the features described in product-features.md and the flows in implementation-pipelines.md. By having a clear schema, we enable straightforward implementation of features and maintain data integrity as the system scales.