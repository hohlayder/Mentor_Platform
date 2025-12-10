-- 002_create_post_ratings.sql
CREATE TABLE IF NOT EXISTS post_ratings (
    id          TEXT PRIMARY KEY,
    post_id     TEXT        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id     TEXT        NOT NULL,
    rate        INT         NOT NULL CHECK (rate >= 1 AND rate <= 5),
    comment     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uniq_post_user UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_ratings_post_id ON post_ratings (post_id);
CREATE INDEX IF NOT EXISTS idx_post_ratings_user_id ON post_ratings (user_id);
