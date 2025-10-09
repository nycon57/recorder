Implementation Pipelines (Async Workflows)

This document describes the end-to-end asynchronous workflows that power the app’s core functionality. The main pipeline stages are: Video Ingestion → Transcription → Document Generation → Vector Embedding → Publication. Each of these stages may be handled by background jobs or external services, with triggers connecting them. We detail how each stage is implemented, how data flows, and how we ensure reliability (retries, error handling) and scalability in these pipelines.

The pipelines are largely asynchronous to provide a smooth user experience (the user doesn’t wait on a long process in a blocking manner) and to leverage specialized services (like transcription AI) that work outside our request/response cycle.

1. Video Ingestion Pipeline

Trigger: User finishes a recording in the browser and initiates upload.

Process:
	•	The recording is captured as a media file (e.g., webm or mp4) in the browser. We then upload it to our storage.
	•	Uploading Strategy: We use chunked upload with a pre-signed URL or API:
	•	The client requests an upload URL from our backend: e.g., a POST to /api/upload-url with the file metadata (name, size, content type). The server (if using S3) calls S3 to get a pre-signed URL (or multipart upload URLs if large). If using Supabase storage, the client might directly use the Supabase JS client to upload in chunks (Supabase supports resumable uploads).
	•	The client streams or uploads the file in parts. With the MediaRecorder, we can even upload on-the-fly as it records (e.g., every few seconds) for very large or long recordings. However, in MVP, simpler is: record to a Blob, then upload that Blob once the user stops recording.
	•	We show an upload progress bar. If the upload fails mid-way, the client can retry or resume if supported (with resumable upload protocol). Using Supabase’s resumable feature (which is based on chunking and can resume) or S3 multipart gives reliability.
	•	Database Entry: As soon as the user stops recording, we create a recordings row in the DB with status ‘uploaded’ (or ‘uploading’). We include metadata like user_id, org_id, and maybe an initial title (e.g., “Recording on 2025-10-06”). The video_url or storage path is filled after upload completes (or pre-determined if we know it).
	•	Once the file upload finishes, the client notifies the server (perhaps implicitly by finalizing the multipart upload or explicitly with a request). For example, after S3 multipart complete, our client might call /api/recordings/complete to indicate success.
	•	Post-Upload Acknowledgment: At this point, we update the recording’s status to ‘uploaded’ (if it isn’t already). The user might be redirected to a “Processing…” page for that recording, or the detail page with a notice that transcription is underway.

Outcome: The video file is safely stored and we have a DB record for it. This triggers the next pipeline stage (transcription).

Reliability & Scalability:
	•	We handle large files by chunking. For example, using a 10MB chunk size for multi-GB videos.
	•	The pipeline doesn’t hold the file in memory server-side; upload goes to storage directly or via a streaming endpoint.
	•	In case of failure: If upload fails, the client can retry. If the user closes the browser mid-upload, we can have logic to resume when they come back (if using a resumable protocol with an upload ID).
	•	We could use an AWS Lambda trigger or Supabase Storage webhook to detect when a file is fully uploaded to start the next step automatically. Alternatively, our explicit “complete” call triggers transcription.
	•	We ensure unique file naming (using recording_id as part of the path, e.g., org-<id>/recordings/<recording_id>.webm) to avoid conflicts and to allow direct retrieval if needed.

2. Transcription Pipeline

Trigger: A recording upload is completed (detected either by the completion API call or a storage event).

Process:
	•	We change the recordings.status to ‘transcribing’. This can be done by the API route handling the completion trigger.
	•	The server (or a background worker) now initiates transcription. Two approaches:
	1.	Via API (async): Use an external transcription service (like AssemblyAI, Deepgram, or OpenAI Whisper API). Typically, you send either the file content or a URL to the service. Because our file is in cloud storage, we can often provide a signed URL to the service. For example, with AssemblyAI, we send a POST with { audio_url: "https://...signedURL..." } and they process in the background, calling a webhook when done. We prefer this asynchronous mode to avoid holding a connection open.
	2.	Self-managed (sync or async): If using OpenAI Whisper API, it’s a direct HTTP call with the file (max ~25MB). For larger, we’d need to chunk audio or use a different method. Or we could run our own Whisper model on a server with GPU for longer audio. That requires a job queue and compute resource.
	•	Given our architecture, we likely use a service with callback. So we will:
	•	Register a webhook endpoint (e.g., /api/webhook/transcription) with the service.
	•	Start transcription via their API, including the callback URL.
	•	Store a job reference (e.g., service-specific ID) in a jobs table or in memory for tracking.
	•	Our transcripts table may already have a placeholder row or we create it upon completion. We likely wait until done to insert transcript.
	•	Webhook Handling: When transcription is done, the service calls our webhook with results:
	•	The webhook endpoint (a Next.js API route or serverless function) receives a payload containing the transcript text and possibly word timings.
	•	We verify the source (e.g., check a token if provided to ensure it’s the transcription service).
	•	We then insert into transcripts table: the full text, language, and maybe structured data if provided (some services give a JSON of words or paragraphs with timestamps). We mark transcribed_at.
	•	Update recordings.status to ‘transcribed’.
	•	Possibly update recordings.completed_at if we consider transcription alone as completion. But since we have more steps (doc, embedding), we might not mark fully complete yet; we may leave it at ‘transcribed’ until doc is done.
	•	If instead we did transcription synchronously (e.g., small file with OpenAI direct call):
	•	Our background job (or API call if risk of short length) gets the text response immediately or within some seconds.
	•	We then do the same DB updates directly.
	•	This is simpler but doesn’t scale to long videos; asynchronous external is safer for long ones.
	•	User Notification: Once transcription is done, if the user is on the recording’s page, we can push a real-time update (maybe via websockets or polling). If not, we can send an email or show a notification next time they log in: “Your recording ‘X’ has been transcribed.”

Outcome: We have the raw text of what was said in the video stored and associated with the recording.

Reliability & Scalability:
	•	We decouple user requests from this heavy task by using background jobs/webhooks. So even if transcription takes 5-10 minutes, it doesn’t tie up any server instance in the meantime.
	•	We should implement retries for webhook delivery or processing: e.g., if our webhook is down when service calls, the service might retry (AssemblyAI does a few retries). Or if our process fails to save, we might recover via a dashboard of failed jobs.
	•	If using our own job runner, we should have a queue (like Redis + bullMQ) with retry logic (X attempts with exponential backoff) for transcribing using an external API (in case API call fails due to rate limit or transient error).
	•	For multiple simultaneous transcriptions, external services handle scaling on their side (we just pay for usage). If self-hosting, we’d need a worker per concurrency or an autoscaling setup (likely not MVP).
	•	We must secure the media: the signed URL for audio should have limited lifetime and scope. And the webhook should be protected (check some signature or include a secret).
	•	If an error happens (e.g., transcription API fails, perhaps due to unsupported file or too long):
	•	We update recordings.status to ‘error’ and log the error message.
	•	Notify user that transcription failed (and perhaps they can retry via a button after addressing issue or using a different method).
	•	We might implement fallback: e.g., if OpenAI Whisper API fails due to length, maybe try AssemblyAI, or vice versa. But initial approach likely sticks to one service.

3. Document Generation Pipeline

Trigger: Transcription is completed (and stored). This could be initiated within the same webhook handler or by a separate job trigger.

Process:
	•	Set recordings.status to ‘doc_generating’.
	•	AI Generation: We prepare a prompt for an LLM to convert transcript to a structured doc. For instance, a system/user prompt combination: “You are an assistant that turns transcripts into documentation. The transcript: ... Now produce a well-formatted Markdown…”. We include guidelines like “Use headings, lists, code blocks as appropriate. Preserve important details.” We may also include context like the recording title or any user-provided notes about the intended audience.
	•	We decide on a model (e.g., GPT-5 Nano or GPT-3.5 via OpenAI API).
	•	If using GPT-5 Nano and the transcript is very long, we might need to chunk the prompt (maybe process it section by section then combine) or use a summarization first. Possibly GPT-5 Nano 32k context could handle ~1 hour of speech (~15k tokens)? It’s borderline but maybe.
	•	We may start with GPT-3.5 (4k context) and if transcript doesn’t fit, break into parts: e.g., split transcript by sections (maybe at our bookmarks or into ~3000 token chunks), have the AI summarize each or create partial docs, then have another prompt to merge those into one doc. This is complex; perhaps easier: if too large, we instruct the model to focus on the most important points (losing some detail).
	•	Implementation: We likely create a background job for doc generation:
	•	The job fetches the transcript from DB.
	•	Calls OpenAI API with the prompt. We use stream mode or normal; since this is not user-facing directly (only outcome used later), normal is fine. But we should handle it might take many seconds.
	•	Get the response text (the Markdown doc).
	•	Insert into documents table: the content, summary if we also asked for one, generation time, model used.
	•	Update recordings.status to ‘completed’ (meaning fully processed).
	•	After document is saved, we notify the user (in-app notification or email: “Your document for recording X is ready”).
	•	Perhaps also generate a very brief summary for quick preview or SEO if needed (we can either take first paragraph or explicitly ask LLM for a 1-2 sentence summary and store in documents.summary).

Outcome: The structured documentation is now stored and accessible. The recording’s processing pipeline is essentially done from the system perspective.

Reliability & Scalability:
	•	The LLM call might fail (due to network, rate limit, or content issues). We should:
	•	Use retries with backoff (OpenAI recommends handling server errors by retrying after short wait).
	•	If it fails after retries, mark job failed (recordings.status = ‘error’, error_message in our jobs or recording).
	•	Possibly try a smaller model if bigger fails due to capacity.
	•	For cost management, perhaps default to GPT-3.5, and maybe allow user to manually request a GPT-5 Nano regen if they want higher quality (depending on plan).
	•	We should be mindful of token limits:
	•	If transcript is huge, one approach: skip doc generation for extremely large transcripts in one go and either require user to manually chunk, or implement a more complex strategy as above. We can also arbitrarily truncate transcript input to fit into e.g. 12k tokens for GPT-5 Nano (losing some detail, but better something than failing).
	•	Logging: maybe log the size and model used for each doc gen for future optimizations.
	•	Running multiple doc generations concurrently: since these are external API calls, concurrency is mainly limited by API and cost. We can safely run a few in parallel; if high load, maybe queue them.
	•	If we have a job queue (like Redis), we can have a certain number of workers handling LLM calls to avoid spamming the API.
	•	If the LLM returns content that violates some policy (maybe it mis-summarized or included something weird), user will have the chance to edit it, so it’s fine. We just store what we got.
	•	We might implement a safeguard: e.g., if doc is significantly short (maybe something went wrong and it produced only a few lines for a long transcript), we could mark that as suspect and allow a regen. But that might be overkill for now.
	•	Security note: We send potentially sensitive transcript data to OpenAI. We should ensure our terms and perhaps an option for user to opt out or use a self-hosted model if needed. But early on, assume it’s acceptable or at least documented.

4. Vector Embedding Pipeline

Trigger: Document generation is done (or even transcription done, depending if we embed transcript or doc or both).

Process:
	•	We decide what text to embed for semantic search. Likely, we embed the transcript (because it’s raw and complete). We could also embed the document, but it might be more summarized. Perhaps better to embed transcript segments for recall, and use the doc mainly for reading. We might do both or either.
	•	Chunking: We split the transcript into chunks suitable for embedding:
	•	A common approach: break by paragraph or ~500 tokens segments, ensuring coherence. Possibly we use the punctuation and timestamps to chunk by topics or time blocks (~30 seconds of speech per chunk).
	•	Alternatively, after doc creation, the doc could have clearer sections; we might embed those sections (like each top-level section of doc). But then search might miss details omitted in doc.
	•	For now, we can embed transcript paragraphs. Our transcripts might not have explicit breaks. We could insert breaks at speaker changes or when a pause is long (if we had that data). Simpler: fixed-size sliding window: e.g., every 200 words or so, overlapping slightly (maybe 50% overlap to not miss context).
	•	For each chunk:
	•	We create an entry in transcript_chunks with recording_id, org_id, text (the chunk text).
	•	We call embedding API (OpenAI’s text-embedding-3-small) with that chunk text. It’s fast (~less than a second typically).
	•	We get a 1536-d vector and store it in the embedding column.
	•	We also record the chunk index or start time metadata so that if a search result refers to chunk 3, we can map it to roughly a portion of the transcript. If times available, store start time in metadata to allow seeking video later.
	•	This can be done synchronously in code after doc gen, or as a separate job. Since embedding is relatively quick, and we likely need results soon for search, doing it immediately after doc is fine. But to isolate concerns, we might fire a separate job (especially if we plan to switch to Pinecone later, we might have a dedicated sync process).
	•	If using Pinecone or another vector DB later:
	•	For now, we do Postgres. If Pinecone, we’d batch upsert the vectors to Pinecone index with metadata (org, recording_id, chunk_id).
	•	The pipeline difference is minor; it’s just calling Pinecone’s API instead of inserting into PG. We would still keep a local record for reference or for backup maybe.
	•	Update status: Once embedding is done for all chunks, that recording is fully processed. If not already ‘completed’, set recordings.status = 'completed'.
	•	If any error in embedding (rare, maybe API issues or chunk too large for embedding model):
	•	We could attempt to shorten that chunk or skip it (losing a bit of data but not critical).
	•	We log any failures; likely continue with others.

Outcome: The recording’s textual content is now indexed for semantic search. The AI assistant can use these vectors to find relevant pieces.

Reliability & Scalability:
	•	Embedding many chunks: For a 1-hour video, transcript ~10k words maybe, chunk into say 50 chunks of ~200 words. 50 embedding calls is fine. If multiple videos at once, OpenAI’s rate limit might be a concern (we might batch multiple texts in one request as their API supports  up to 2048 tokens per request of multiple inputs).
	•	We could optimize by doing embedding in parallel for different chunks or sequentially. Given each is quick, sequential is okay unless transcripts are huge.
	•	If our volume grows, we might consider doing embedding in batches or on a separate queue to manage rate limits.
	•	Should ensure vector index is updated transactionally with transcripts: We might do it in one transaction or after confirming doc done. If doc fails, maybe still embed transcript so search still works on raw data? Possibly, but if doc fails, likely we mark error and might not embed to avoid partial data. Once user fixes/regenerates doc, we can embed then.
	•	If using Postgres:
	•	We already have pgvector index. We should periodically vacuum and ensure performance. It’s fine for a moderate number of vectors (< millions).
	•	For scale beyond that or better query latency, we plan to move to Pinecone (see vector-strategy.md), which means this pipeline would send data to Pinecone. We’d likely run both in parallel during migration (embedding to PG and Pinecone).
	•	If a new recording is added, only that recording’s embeddings are inserted. Searches will naturally include it. If a recording is deleted, we should delete its chunks (cascade will handle if foreign key).
	•	Multi-tenant: We include org_id in chunk for filtering. In PG, our similarity query will include WHERE org_id = X. In Pinecone, we’ll use namespace per org. So pipeline would specify the namespace = org_id when upserting vectors, ensuring isolation.

5. Publication & Post-processing

This is not a single step but an umbrella for any finishing touches after main pipeline:
	•	We mark things as done and available. The user can now view the transcript and doc in the UI. Possibly, we flip some flag or send an event to the front-end if they’re waiting in real-time.
	•	If the user opted to auto-publish the doc (maybe a setting), and if allowed, we generate a public URL now. That could mean:
	•	Creating a short UUID or slug for the doc and storing it in a public_docs table or in documents (like a share_id).
	•	That way, we can serve that via a public endpoint without auth. That could be done here or later when user actually clicks “share”.
	•	We might create a thumbnail of the video: e.g., take a frame from 10 seconds in. This could be done either in the client before upload (if we had the video blob, capture frame) or on server using FFmpeg. Not critical, but improves UI listing. If we do it server-side:
	•	After video is uploaded, a job could run ffmpeg on the stored file (if we have a server with ffmpeg) to grab a frame and put in storage.
	•	Or we rely on the video element in browser to generate when needed (for dashboard).
	•	Clean up: if we had any temporary files or data, remove them. In our flow, not much temp on serverless unless we downloaded the video for processing (we avoided that by direct links).
	•	Logging/analytics: We log the pipeline completion, perhaps store metrics (duration of each stage, etc.) for monitoring performance and cost.
	•	Set up any links between objects: e.g., now that doc is ready, if we have a search index for docs separate from transcripts, ensure it’s updated. (We currently use transcripts for search, but if including docs, would embed those too now.)
	•	Possibly notify other org members: e.g., “New document published: X” if we want to encourage knowledge dissemination. That could be an email or in-app feed (this could be considered later as part of engagement features).

Error Handling Summary:
	•	Each stage (upload, transcription, doc gen, embedding) has its own error handling and does not block the others unnecessarily.
	•	If transcription fails, we cannot proceed to doc or embedding. So that recording stops with error. The user might be given an option to retry transcription (maybe use a different method).
	•	If doc gen fails, we could still allow search on transcript because that’s available. But we mark error so user knows doc isn’t ready. They might retry doc gen. Our system could allow a manual “Regenerate document” which re-triggers that stage (keeping transcript and embeddings).
	•	If embedding fails for some reason, the user can still read the doc; only search/chat is affected. We could mark a non-critical error and maybe schedule a retry in background later without bothering the user, because they might not notice missing embeddings until they search. Alternatively, notify admin that search indexing failed for that recording.
	•	We plan to surface errors in the UI on the recording card, e.g., a warning icon with tooltip “Transcription failed, click to retry.”

Workflow Orchestration:
	•	We currently envision a somewhat linear chain with webhooks:
	•	Upload complete -> call transcription service -> callback -> call doc generation -> then embedding.
	•	We can implement it as:
	•	A single queue system where one job type leads to enqueueing the next job type. E.g., a job transcribe(recording_id) on completion enqueues generate_doc(recording_id), then that enqueues embed(recording_id).
	•	Or event-driven: update of DB status triggers next via a listener. If using Supabase, could use database triggers or functions (but probably easier to manage in app code).
	•	For clarity, likely manage in code: The transcription webhook itself, after saving transcript, can directly call a function to start doc generation (synchronously, which might be too slow to do in the webhook response; better to enqueue it).
	•	Perhaps better: The transcription webhook just updates DB and status. We have a background worker polling or listening for recordings in ‘transcribed’ status and then processes doc gen. (If using Supabase, could use their realtime or cron triggers to pick those up.)
	•	For MVP, a simpler approach: Kick off doc gen from webhook right away (fire-and-forget an async function, respond 200 to webhook while doc gen runs). In Node, we can do that by not awaiting the OpenAI call, but we must be careful with serverless as it might cut off execution after sending response (some platforms do). Alternatively, have the webhook call a separate job via an API or queue.
	•	Because of the complexity of orchestration, an alternate architecture: use a managed workflow service or message queue:
	•	E.g., AWS Step Functions could orchestrate: on S3 upload -> transcribe (maybe with AWS Transcribe) -> when done -> Lambda to generate doc -> etc. But that ties to AWS infra.
	•	Or simpler: an in-app queue library as mentioned. Given time, a lightweight solution might be to use the database as a queue: a jobs table where each job has type and status and a worker polling it. But on serverless (Vercel), we don’t have a always-on process to poll. Might need an external worker or use something like temporal.
	•	Perhaps the easiest: rely on external triggers as much as possible:
	•	Transcription service calls us.
	•	We call OpenAI for doc (this we have to do).
	•	For now, do that in the same request to keep it simple (if transcripts are small).
	•	If worried about timeouts (like doc generation might take 30s, maybe okay on serverless if within limits, often 10-30s?), if it might exceed, then need background approach.
	•	Vercel Edge Functions run quickly, but Node serverless might allow up to 10s by default, can be extended maybe. If GPT-5 Nano summarizing a huge text, could exceed.
	•	We might break it: webhook returns quickly after starting doc job, and we rely on some scheduled check to finish doc. But that introduces complexity.
	•	Another approach: Offload doc gen to a separate environment (e.g., a small VM or container) that can run longer tasks. That’s more devops heavy but could be needed for robust pipeline.
	•	For MVP, we try to streamline: using GPT-3.5 if possible (faster), likely can finish in a few seconds for moderate text.
	•	We will test with realistic lengths to ensure within serverless time. If not, we consider using something like a background function (like Vercel has background functions with up to 500s execution but they are in beta or for Enterprise).
	•	If not available, we could use a workaround: split doc generation: maybe do half now, half on next request, but that’s messy.

Monitoring & Scaling:
	•	We should monitor pipeline durations and success rates. Logging each step’s start and finish times (maybe in the jobs table or an internal log) helps identify bottlenecks.
	•	For scaling, each pipeline largely fan-out per recording. If 100 recordings are being processed concurrently (like after a big import), external services might throttle. We may queue tasks to avoid hitting rate limits (like only 5 concurrent transcriptions if not handled by service, etc).
	•	Also, we consider the cost: each step (transcription minutes, OpenAI tokens, embedding calls) costs money. We might implement per-org quotas or at least tracking in the future. But pipeline doesn’t directly worry about that beyond possibly checking “if org is free tier and already used X minutes, maybe do not auto-process until they upgrade”. But to start, likely just process and we will handle billing outside pipeline (or not in MVP).
	•	If using Pinecone later, the pipeline step “embedding” would include an API call to Pinecone’s upsert. That’s fine but if Pinecone is unreachable, we need to retry. We could also first store vectors locally and have a separate sync service to push to Pinecone asynchronously (to decouple vector DB from user-facing flows slightly). Possibly not needed if Pinecone is reliable.

In summary, the pipelines ensure that from the moment a user clicks “stop recording”, the heavy lifting is done in the background, and the user is eventually presented with a transcript and document, and can use the AI assistant to query it. Each pipeline stage is designed to be fault-tolerant and scalable through the use of asynchronous jobs and external services specialized for the task. By modularizing the pipeline, we can maintain and improve each part (for instance, swap out transcription provider or add a new post-processing step like translation) without affecting the others, as long as the triggers and data contracts remain consistent.

⸻

File: api-spec.md

API Specification

This document outlines all relevant API endpoints and route handlers in our application, including their purpose, request/response format, authentication requirements, rate limiting considerations, streaming capabilities, and integration with background tasks. The API is organized by feature area (auth, recordings, transcription webhooks, documents, search/chat, etc.). All endpoints are prefixed with /api as we are using Next.js API routes (App Router). These endpoints are primarily consumed by our frontend and some by external services (webhooks).

General Considerations
	•	Auth: All endpoints (except auth callbacks or public content) require authentication. We use Clerk’s middleware to protect API routes. This means each request will have an authenticated user (with req.auth or similar providing userId, orgId, and roles). If a request is unauthenticated, it gets a 401 or redirect to login.
	•	Data Scope: Many endpoints require an org_id context (which we get from the session or header via Clerk). We ensure that the user belongs to that org and has necessary permissions for the action. If not, respond with 403 Forbidden.
	•	Rate Limiting: We will implement basic rate limiting on certain endpoints to prevent abuse:
	•	E.g., the chat endpoint (vector search / AI answer) might be limited to, say, 60 requests per minute per user or a similar quota, especially on free plan.
	•	The recording upload endpoints might be limited in number of concurrent uploads or total per day for free plan users.
	•	We can use a library or Vercel’s Edge Middleware to do rate limit by IP/user. Alternatively, since Clerk gives user ID, a simple in-memory or KV store count can be used. For MVP, we might not enforce strictly but will design to add easily.
	•	Streaming: Some endpoints (like the chat answer) will use streaming responses (Server-Sent Events or incremental HTTP chunking) to send data progressively. We ensure proper headers (Content-Type: text/event-stream or similar) and flush behavior for these.
	•	Task Queue Triggers: Certain endpoints won’t complete the full processing synchronously but will enqueue background tasks. For example, when receiving a transcription webhook, after storing data we might enqueue a doc generation job.

Now, specific endpoints:

Auth Endpoints (Clerk-managed)

We largely rely on Clerk’s hosted components for auth (so users are redirected to Clerk’s pages or using Clerk React components). Thus, we have minimal custom auth endpoints. Clerk provides:
	•	/api/auth/* (Clerk’s Next.js middleware uses internal routes).
	•	Webhooks from Clerk (if any, e.g., for user created, organization events) – we might set up an endpoint to receive those and sync to our DB.

Example:
	•	GET /api/auth/session – (Provided by Clerk) returns current session info. Not something we write; Clerk’s SDK handles retrieving user profile, etc., on front-end.
	•	Clerk Webhooks (if used): e.g., /api/webhooks/clerk – to handle events like organization created, member added, etc. We would verify the signature and update our organizations or user_organizations tables accordingly (though Clerk might make a direct call unnecessary if we query each time or use their JWT claims). If implemented:
	•	Request: JSON payload from Clerk describing the event.
	•	Response: Usually 200 if processed.
	•	Auth: Basic (Clerk signs it, we verify with secret).
	•	Behavior: Update DB or log.
	•	Rate limiting: N/A (coming from Clerk, low volume).

User/Org Management Endpoints

If we provide custom endpoints for creating orgs or inviting users (which could also be done via Clerk’s frontend):
	•	POST /api/organizations – Create a new organization.
	•	Auth: User must be authenticated (this will be the owner of new org).
	•	Request: JSON body with at least { name: "Org Name" }.
	•	Response: 201 Created with JSON of org { org_id, name, ... } or error if e.g., name invalid.
	•	Behavior: Creates org in our DB (and possibly via Clerk API if using Clerk Orgs to manage invites).
	•	If using Clerk’s organization feature, ideally we call Clerk’s server API to create an organization, which will handle membership. Clerk might then call a webhook to us or we query the created org ID to insert in our DB.
	•	If not using Clerk Orgs, we create DB entry and add user to user_organizations as admin.
	•	Rate limit: Minimal (creating org is rare).
	•	GET /api/organizations/current – Get current org’s info and membership list.
	•	Auth: Must be a member of an org (and probably admin to see full member list).
	•	Response: JSON like { org: {...}, members: [ {user_id, name, email, role}, ...] }.
	•	Behavior: Look up org by session’s org_id, fetch org info and join with user_organizations->users for members if admin, or just basic org info if member.
	•	Possibly for multi-org context, GET /api/organizations to list all orgs user is in (so they can switch).
	•	POST /api/organizations/invite – Invite a new member by email.
	•	Auth: Org Admin only.
	•	Request: { email: "foo@bar.com", role: "member" }.
	•	Response: 200 with { success: true } or error.
	•	Behavior: If using Clerk Orgs, we might call Clerk’s invite API to send an invitation. If we manage ourselves, we create a temporary invite token in DB, email it to that address with a link to sign up and join org.
	•	Rate limiting: yes, to prevent spam invites (e.g., max 10 invites per hour per org).
	•	DELETE /api/organizations/members/{userId} – Remove a member.
	•	Auth: Org Admin and cannot remove themselves unless another admin exists (perhaps).
	•	Behavior: If using Clerk, call Clerk remove member API. Also remove from our DB membership (Clerk might do that via webhook too). Return 204 No Content on success.

(We rely heavily on Clerk for auth flows, so the above may be thin wrappers or not needed if we use their components which handle invites.)

Recording Endpoints
	•	POST /api/recordings – Initiate a new recording entry (could be optional since uploading might create it).
	•	Auth: Auth required.
	•	Request: Could include metadata like { title (optional), description (optional) }. Or even could allow uploading small file directly (but we prefer separate upload step).
	•	Response: JSON with { recording_id, upload_url(s) } if we choose to return a pre-signed URL or instructions for uploading.
	•	Behavior:
	•	Generate a new recording_id (UUID).
	•	Create DB entry with status ‘uploading’ or ‘pending’.
	•	If using direct upload to S3 approach:
	•	Call S3 to get a pre-signed URL (or an AWS SDK upload ID and part URLs for multipart).
	•	Return those to client.
	•	If using Supabase:
	•	We might not need this endpoint; the client could upload via supabase library using user’s auth.
	•	But if we want to enforce a key naming scheme, we might tell client: upload to bucket X path org/<orgId>/<recording_id>.webm.
	•	If chunking with custom approach, maybe we return an endpoint /api/recordings/{id}/upload to which the client can PUT chunks with a query param like ?part=1.
	•	Note: We might simplify and not use a distinct call; the client could directly start an upload via an SDK and then call the complete endpoint.
	•	PUT /api/recordings/{id} – Update recording metadata.
	•	Auth: Owner or admin of org.
	•	Request: JSON with fields to update (title, description, maybe privacy setting).
	•	Response: 200 and updated object or 204.
	•	Behavior: Write to DB after checking permission. Title/desc can be updated anytime.
	•	Rate limit: low.
	•	DELETE /api/recordings/{id} – Delete a recording.
	•	Auth: Owner or admin.
	•	Response: 204 No Content on success.
	•	Behavior: Mark as deleting or directly remove:
	•	Delete DB entries (recording, cascades to transcript, doc, chunks).
	•	Delete video file from storage (we may call storage API or queue deletion).
	•	Possibly cancel any ongoing jobs for it (if deletion happens mid-processing).
	•	This might be a long operation if video is large to delete physically; but S3 deletion is quick, so fine.
	•	We could perform file deletion asynchronously if needed, but likely fine to do in the request since it’s a simple API call to storage.
	•	GET /api/recordings – List recordings for current org.
	•	Auth: Yes.
	•	Query Params: Could support pagination (?limit=50&offset=0) or filtering (e.g., by creator or by status).
	•	Response: JSON array of recordings (with fields like id, title, user, status, created_at, maybe partial transcript preview or doc snippet if we want).
	•	Behavior: DB query for all recordings where org_id = currentOrg. Apply any filters. Perhaps join user to get creator name.
	•	Might only list those that are not deleted. If we had soft-delete, filter that out.
	•	GET /api/recordings/{id} – Get details of a specific recording.
	•	Auth: Member of org.
	•	Response: JSON with recording details including:
	•	metadata: id, title, description, user, created_at, status.
	•	transcript text (possibly full or maybe we load lazily? Probably can send full text).
	•	document content (the markdown).
	•	We might exclude the raw embedding data – not needed by frontend.
	•	Maybe include a URL to stream or download the video (like the S3/Supabase public URL or a signed URL if private).
	•	Behavior: Fetch from DB (recordings join transcripts join documents).
	•	Also generate or provide the video link:
	•	If the bucket is private, either create a short-lived signed URL here, or route video through an API that streams it.
	•	Supabase provides a way to retrieve with user token. If using that on frontend, might not need our API to proxy.
	•	Possibly we mark our bucket as public for simplicity, since it’s mostly internal data not public, but accessible to all in org anyway. However, not all org members should have link? Actually if link is unguessable (with recording_id), still, if bucket is public and someone guesses URL they could get it. Better to keep protected.
	•	So one approach: have a route /api/recordings/{id}/video that checks auth and then streams file from storage. But that doubles bandwidth through our server (costly).
	•	Alternative: Use signed URLs: Vercel server can generate a signed URL for S3 object that lasts 1 hour and respond with redirect to it. That way client downloads directly from S3. This is efficient.
	•	For Supabase, we might rely on supabase client in front-end with user’s JWT; they can call storage.getPublicUrl (but if not public, then .download with auth).
	•	Perhaps easiest: in our GET /recordings/{id}, include video_url which if using S3 is a signed URL (just generate one each time, it will be valid short time). If using Supabase, we can call supabase storage with service key to get a URL or serve via our own.
	•	Possibly handle if not processed: if status is not completed, transcript or doc might be null or partial. We still return what we have (maybe transcript if done, doc if done).
	•	POST /api/recordings/{id}/publish – (Optional) Publish/unpublish a recording’s doc publicly.
	•	Auth: Maybe only Admin or Owner can publish.
	•	Request: JSON { "publish": true, "includeVideo": false } or similar.
	•	Response: 200 with maybe a public URL or token.
	•	Behavior: If publish true:
	•	Set documents.is_published = true for that recording.
	•	Generate a shareable link (if using ID is enough, since we can have a public route like /share/doc/{recording_id} that anyone can open if is_published).
	•	Optionally, if includeVideo was requested and we allow it, we might also mark something to allow unauthenticated video streaming (maybe we create a signed URL and embed it or serve through our share page).
	•	If publish false: set is_published false (and any existing share links would stop working or share page checks that flag).
	•	Rate limiting: minimal.

Webhook Endpoints
	•	POST /api/webhook/transcription – receives callbacks from the transcription service.
	•	Auth: It’s unauthenticated publicly, but we verify a signature or secret key included by the service.
	•	Request: The exact payload depends on service. For example, AssemblyAI might send { "status": "completed", "text": "...", "id": "xyz", ... }. We’ll document expecting certain fields:
	•	a job id or reference, which we match to a recording (we might have stored the job id in recordings or jobs).
	•	the transcript text (or a URL to fetch it from).
	•	possibly a confidence or word-by-word info.
	•	Response: Likely 200 with no content; we just acknowledge.
	•	Behavior:
	•	Verify signature (like HMAC header).
	•	Identify which recording this is for. If the service let us set a webhook per request with an ID, maybe we encoded recording_id in the webhook URL (like /api/webhook/transcription?recording_id=abc). Or we look up by the job id in DB.
	•	Update the transcripts table with the text.
	•	Update recordings.status = 'transcribed'.
	•	Kick off document generation. Possibly by simply calling the doc generation function or enqueuing a job (maybe using a small in-memory queue or something).
	•	Return 200 quickly.
	•	Rate limiting: not needed for external triggers (should be low volume, but we ensure this can handle bursts if many finish at once).
	•	POST /api/webhook/stripe – handle Stripe billing events.
	•	Auth: Verify Stripe signature.
	•	Behavior: Not core to product features, but for completeness:
	•	Listen for invoice paid, failed, subscription upgraded, etc. Update organizations.plan or set flags if needed.
	•	Notifies user or restricts service if payment failed, etc.
	•	This ensures the tech stack doc’s mention of billing integration is implemented.

AI Assistant Endpoints
	•	POST /api/chat/query – Query the AI assistant (vector search + LLM answer).
	•	Auth: Yes (org member).
	•	Request: JSON like { "query": "How do I reset the database?", "history": [ { "role": "user/assistant", "content": "..."} ], "scope": "all" | "record:ID" }.
	•	The history could be included if we maintain context on server, but likely we will manage context client-side for now. Alternatively, we use conversationId to track persistent context.
	•	scope or some param can specify if the user wants to limit search to a specific recording or tag. If scope=record:xyz, we filter vector search to that recording only.
	•	Response: This will likely be a stream. We set Transfer-Encoding: chunked and stream partial answer.
	•	We might first send some preliminary data like which records were found (maybe not to clutter answer, but sometimes showing sources as we go).
	•	We then stream the answer as it’s generated by OpenAI.
	•	We might format response in SSE format: data: ... lines, so client can use EventSource. Or use fetch and read the stream.
	•	If not streaming, we wait for full answer then return JSON { answer: “…”, references: [ {recording_id, snippet, confidence} ] }.
	•	Behavior:
	•	Receive query.
	•	Perform vector search in transcript_chunks where org_id = currentOrg (and further filter if scope given).
	•	Get top N chunks (say 5) and their text + maybe recording_id.
	•	Form a prompt for the LLM: e.g., “Using the info below, answer the question…\n\n<>\ntext…\n<>…\nQuestion: {query}\nAnswer:”. Possibly include some instruction to cite sources by maybe referring to [1], [2] etc.
	•	Call OpenAI ChatCompletion (likely gpt-3.5 or gpt-4) with system and user prompt containing those documents.
	•	We use the streaming option from OpenAI. As tokens arrive, we flush them to client.
	•	We also capture which sources were used. We might attempt to parse model output for references if we instruct it to output them, or simpler: after answer, we attach the known top chunks as context sources. Could refine later to match which chunk text overlaps answer.
	•	Once done, end stream. The client would assemble tokens into the final answer. If not including references inline, we might at the end send a JSON block with references.
	•	The client UI will show answer, and perhaps list sources (like “From Recording X (Feb 1, 2025)” linking to it).
	•	Rate limiting: Important here. We’ll likely restrict to e.g. 5 queries in 10 seconds or similar, to avoid someone making a loop to use our API as openAI proxy. And overall perhaps X per month per user on free plan. Implementation: Could use an in-memory counter or upstash redis to track queries by user id. On exceed, return 429 Too Many Requests with an error “Rate limit exceeded”.
	•	Error handling: If vector DB or LLM fails:
	•	If vector search returns nothing (rare unless no data), we can respond with something like “I don’t know” or let model handle “no relevant info”.
	•	If OpenAI API errors (timeout or 500), we catch and return a 500 with message “Assistant is currently unavailable, try again.”.
	•	POST /api/chat/feedback – (Optional) send feedback on answer quality.
	•	Could allow user to thumbs-up/down an answer, which we log to improve prompts or metrics.
	•	Auth: yes.
	•	Request: { conversationId, messageId, feedback: "up"|"down", comment: "optional text" }.
	•	Behavior: Store in a small table or send to an analytics pipeline. Not a priority initially.

Misc Endpoints
	•	If we embed images, e.g., for marketing site or user uploaded an image, might have endpoints. Not in scope now.
	•	GET /api/sitemap.xml – maybe generate sitemap for SEO. Only if needed; Next can statically do for marketing pages.

Streaming Implementation Detail

For POST /api/chat/query streaming:
	•	In Next.js (Node) API route, we can set up the response as a stream by:
	•	Using the res directly (which is a Node http.ServerResponse) to write chunks. Ensure res.writeHead(200, { Content-Type: 'text/event-stream', Cache-Control: 'no-cache', Connection: 'keep-alive' }) for SSE or text/plain if just raw chunks.
	•	Use OpenAI SDK with streaming: it gives a stream of events or callbacks per token. We’ll forward those.
	•	We need to flush periodically (res.flush() if available, or ensure auto flush).
	•	Finally end the response.
	•	Alternatively, Next 13 App Router might allow using new Response(stream) to return a streamed response. Actually, in the App Router, if using the new Route Handlers, we can do: return new NextResponse(stream, { status: 200, headers: { ... } }).
	•	We’ll have to test this, but it’s doable. The UI will use EventSource or fetch with reader to consume the stream.

Development and Testing
	•	We’ll test endpoints with tools like Postman or curl:
	•	Ensure auth middleware working (Clerk provides a way to simulate user tokens in dev).
	•	Test upload flow: hitting POST /recordings, using returned URL to PUT a file, then hitting complete.
	•	Simulate a webhook by calling it ourselves with sample data to ensure it triggers doc gen.
	•	Test chat with some known content to see if it returns expected format.
	•	For streaming, test via curl or a Node script reading from http to confirm chunked output.

Conclusion of API Spec

This API provides the backbone for our front-end to interact with the system and for external integrations. It balances synchronous operations (quick data fetches, UI actions) with asynchronous hand-offs (webhooks and background tasks). By clearly defining endpoints and their roles, internal engineers and AI agents can interact with the system predictably, and we maintain security and performance through auth checks and rate limiting where appropriate. Each endpoint corresponds to a piece of the product functionality described earlier, tying together the overall architecture.