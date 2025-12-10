CREATE TABLE IF NOT EXISTS post_ratings (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    rate INT NOT NULL CHECK (rate >= 1 AND rate <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_rating_per_user UNIQUE (post_id, user_id)
);

-- Индексы для ускорения агрегаций и поиска
CREATE INDEX IF NOT EXISTS idx_post_ratings_post_id ON post_ratings (post_id);
CREATE INDEX IF NOT EXISTS idx_post_ratings_user_id ON post_ratings (user_id);
