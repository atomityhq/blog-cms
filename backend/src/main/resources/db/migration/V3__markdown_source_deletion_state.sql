-- Keep the storage key when Nextcloud deletion fails, so DELETE can be retried.
-- A pending source cannot be attached to a new post.
ALTER TABLE markdown_sources ADD COLUMN deletion_pending BOOLEAN NOT NULL DEFAULT FALSE;
