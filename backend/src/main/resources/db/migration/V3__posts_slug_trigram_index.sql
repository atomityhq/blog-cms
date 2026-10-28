-- Post search (PostSpecifications.matches) ORs ILIKE '%term%' across title, excerpt, slug
-- and content_text. V1 gave every one of those columns a trigram index except slug, and
-- PostgreSQL can only answer an OR from indexes when every branch has one, so each search
-- read the whole posts table instead. With slug indexed too, it combines all four indexes.
CREATE INDEX idx_posts_slug_trgm ON posts USING gin (slug gin_trgm_ops);
