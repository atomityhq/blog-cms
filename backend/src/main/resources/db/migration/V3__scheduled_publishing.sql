
-- Support scheduled publication of posts.
-- scheduled_at is the intended publication time, stored as a timezone-aware timestamp.

ALTER TABLE posts
    ADD COLUMN scheduled_at TIMESTAMPTZ;

ALTER TABLE posts
    DROP CONSTRAINT ck_posts_status;

ALTER TABLE posts
    ADD CONSTRAINT ck_posts_status
    CHECK (status IN ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'));

-- Help the scheduler find scheduled posts whose publication time has arrived.
CREATE INDEX idx_posts_scheduled_at
    ON posts (scheduled_at)
    WHERE status = 'SCHEDULED';
