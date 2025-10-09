-- ============================================================================
-- SUPABASE STORAGE BUCKETS CONFIGURATION
-- ============================================================================

-- Recordings bucket (for raw and processed video files)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'recordings',
    'recordings',
    FALSE, -- Private bucket, requires signed URLs
    5368709120, -- 5GB max file size
    ARRAY['video/webm', 'video/mp4', 'video/x-matroska', 'audio/webm', 'audio/mp4']
)
ON CONFLICT (id) DO NOTHING;

-- Thumbnails bucket (for video thumbnails)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'thumbnails',
    'thumbnails',
    TRUE, -- Public bucket for fast thumbnail access
    2097152, -- 2MB max file size
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

-- Allow authenticated users to upload to their org's folder
CREATE POLICY "Users can upload recordings to their org folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'recordings'
    AND (storage.foldername(name))[1] = 'org_' || ANY(
        SELECT org_id::text FROM user_organizations
        WHERE user_id = auth.uid()
    )
);

-- Allow authenticated users to read recordings from their org
CREATE POLICY "Users can read their org's recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'recordings'
    AND (storage.foldername(name))[1] = 'org_' || ANY(
        SELECT org_id::text FROM user_organizations
        WHERE user_id = auth.uid()
    )
);

-- Allow service role full access (for backend operations)
CREATE POLICY "Service role has full access"
ON storage.objects FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Public read access to thumbnails
CREATE POLICY "Public can read thumbnails"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'thumbnails');

-- Authenticated users can upload thumbnails to their org
CREATE POLICY "Users can upload thumbnails to their org folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'thumbnails'
    AND (storage.foldername(name))[1] = 'org_' || ANY(
        SELECT org_id::text FROM user_organizations
        WHERE user_id = auth.uid()
    )
);

-- ============================================================================
-- NOTES
-- ============================================================================

-- File naming convention:
-- org_{org_id}/recordings/{recording_id}/raw.webm
-- org_{org_id}/recordings/{recording_id}/processed.mp4
-- org_{org_id}/thumbnails/{recording_id}.jpg
