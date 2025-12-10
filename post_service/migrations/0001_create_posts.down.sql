DROP INDEX IF EXISTS idx_posts_tags_gin;
DROP INDEX IF EXISTS idx_posts_updated_at;
DROP INDEX IF EXISTS idx_posts_created_at;
DROP INDEX IF EXISTS idx_posts_status;
DROP INDEX IF EXISTS idx_posts_author_id;

DROP TABLE IF EXISTS posts;
