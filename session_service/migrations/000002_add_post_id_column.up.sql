ALTER TABLE slots 
ADD COLUMN IF NOT EXISTS post_id UUID;

-- Создаем индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_slots_post_id ON slots(post_id);