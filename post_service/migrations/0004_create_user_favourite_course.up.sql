CREATE TABLE user_post_favorites (
    id UUID NOT NULL,
    user_id UUID NOT NULL,
    post_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, post_id),
    CONSTRAINT fk_favorite_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_favorites_user_id ON user_post_favorites(user_id);