-- 001_create_posts.sql
CREATE TABLE IF NOT EXISTS posts (
    id          TEXT PRIMARY KEY,
    author_id   TEXT        NOT NULL,
    title       TEXT        NOT NULL,
    content     TEXT        NOT NULL,
    tags        TEXT[]      NOT NULL DEFAULT '{}',
    status      TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
