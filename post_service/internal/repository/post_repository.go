package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

// Post — доменная модель поста в слое репозитория.
type Post struct {
	ID        string         `db:"id"`
	AuthorId  string         `db:"author_id"`
	AvatarURL *string         `db:"avatar_url"`
	Title     string         `db:"title"`
	Content   string         `db:"content"`
	Tags      pq.StringArray `db:"tags"` // ВАЖНО: pq.StringArray для TEXT[]
	Status    string         `db:"status"`
	CreatedAt time.Time      `db:"created_at"`
	UpdatedAt time.Time      `db:"updated_at"`
}

// ErrNotFound — доменная ошибка "пост не найден".
var ErrNotFound = errors.New("post not found")

// ListParams — параметры для выборки списка постов.
type ListParams struct {
	Limit       int
	Offset      int
	AuthorID    string
	Status      string
	Tags        []string
	SearchQuery string
	SortField   string // "created_at", "updated_at", "title"
	SortOrder   string // "ASC" или "DESC"
}

// PostRepository — интерфейс репозитория постов.
type PostRepository interface {
	Save(ctx context.Context, post *Post) error
	GetByID(ctx context.Context, id string) (*Post, error)
	List(ctx context.Context, params ListParams) ([]Post, int32, error)
	Update(ctx context.Context, post *Post, fields []string) (*Post, error)
	DeleteByID(ctx context.Context, id string) error
	UpdateAvatarURL(ctx context.Context, authorID string, avatarURL string) error 
}

// postRepository — реализация репозитория на sqlx.
type postRepository struct {
	db *sqlx.DB
}

// NewPostRepository — конструктор репозитория.
func NewPostRepository(db *sqlx.DB) PostRepository {
	return &postRepository{db: db}
}

// Save — сохраняет пост в базу данных (создание).
func (r *postRepository) Save(ctx context.Context, post *Post) error {
	if r.db == nil {
		return nil
	}

	if post.ID == "" {
		post.ID = uuid.NewString()
	}

	now := time.Now().UTC()

	if post.CreatedAt.IsZero() {
		post.CreatedAt = now
	}
	post.UpdatedAt = now

	const query = `
		INSERT INTO posts (id, author_id, avatar_url, title, content, tags, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	_, err := r.db.ExecContext(
		ctx,
		query,
		post.ID,
		post.AuthorId,
		post.AvatarURL,
		post.Title,
		post.Content,
		post.Tags, // pq.StringArray
		post.Status,
		post.CreatedAt,
		post.UpdatedAt,
	)

	return err
}

// GetByID — получает пост по ID.
func (r *postRepository) GetByID(ctx context.Context, id string) (*Post, error) {
	if r.db == nil {
		return nil, ErrNotFound
	}

	const query = `
		SELECT id, author_id, avatar_url, title, content, tags, status, created_at, updated_at
		FROM posts
		WHERE id = $1
	`

	var post Post
	err := r.db.GetContext(ctx, &post, query, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &post, nil
}

// List — возвращает список постов + total_count по тем же фильтрам.
func (r *postRepository) List(ctx context.Context, params ListParams) ([]Post, int32, error) {
	if r.db == nil {
		return nil, 0, nil
	}

	whereClauses := make([]string, 0)
	args := make([]any, 0)
	argIdx := 1

	if params.AuthorID != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("author_id = $%d", argIdx))
		args = append(args, params.AuthorID)
		argIdx++
	}

	if params.Status != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, params.Status)
		argIdx++
	}

	if len(params.Tags) > 0 {
		whereClauses = append(whereClauses, fmt.Sprintf("tags && $%d", argIdx))
		args = append(args, pq.StringArray(params.Tags))
		argIdx++
	}

	if params.SearchQuery != "" {
		q := "%" + params.SearchQuery + "%"
		whereClauses = append(whereClauses,
			fmt.Sprintf("(title ILIKE $%d OR content ILIKE $%d)", argIdx, argIdx+1))
		args = append(args, q, q)
		argIdx += 2
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = "WHERE " + joinWithAnd(whereClauses)
	}

	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM posts
		%s
	`, whereSQL)

	var total int64
	if err := r.db.GetContext(ctx, &total, countQuery, args...); err != nil {
		return nil, 0, err
	}

	sortField := "created_at"
	switch params.SortField {
	case "updated_at":
		sortField = "updated_at"
	case "title":
		sortField = "title"
	}

	sortOrder := "DESC"
	if params.SortOrder == "ASC" {
		sortOrder = "ASC"
	}

	argsWithLimit := append(args, params.Limit, params.Offset)
	limitIdx := argIdx
	offsetIdx := argIdx + 1

	query := fmt.Sprintf(`
		SELECT id, author_id, avatar_url, title, content, tags, status, created_at, updated_at
		FROM posts
		%s
		ORDER BY %s %s
		LIMIT $%d OFFSET $%d
	`, whereSQL, sortField, sortOrder, limitIdx, offsetIdx)

	var posts []Post
	if err := r.db.SelectContext(ctx, &posts, query, argsWithLimit...); err != nil {
		return nil, 0, err
	}

	return posts, int32(total), nil
}

// Update — частичное обновление полей поста по ID.
func (r *postRepository) Update(ctx context.Context, post *Post, fields []string) (*Post, error) {
	if r.db == nil {
		return nil, ErrNotFound
	}

	if post.ID == "" {
		return nil, ErrNotFound
	}

	columnByField := map[string]string{
		"avatar_url": "avatar_url",
		"title":   "title",
		"content": "content",
		"tags":    "tags",
		"status":  "status",
	}

	setParts := make([]string, 0, len(fields)+1)
	args := make([]any, 0, len(fields)+2)

	args = append(args, post.ID)
	argIndex := 2

	for _, f := range fields {
		col, ok := columnByField[f]
		if !ok {
			continue
		}

		switch f {
		case "avatar_url":
			setParts = append(setParts, fmt.Sprintf("%s = $%d", col, argIndex))
			args = append(args, post.AvatarURL)
		case "title":
			setParts = append(setParts, fmt.Sprintf("%s = $%d", col, argIndex))
			args = append(args, post.Title)
		case "content":
			setParts = append(setParts, fmt.Sprintf("%s = $%d", col, argIndex))
			args = append(args, post.Content)
		case "tags":
			setParts = append(setParts, fmt.Sprintf("%s = $%d", col, argIndex))
			args = append(args, post.Tags) // pq.StringArray
		case "status":
			setParts = append(setParts, fmt.Sprintf("%s = $%d", col, argIndex))
			args = append(args, post.Status)
		}

		argIndex++
	}

	now := time.Now().UTC()
	setParts = append(setParts, fmt.Sprintf("updated_at = $%d", argIndex))
	args = append(args, now)

	if len(setParts) == 1 {
		return r.GetByID(ctx, post.ID)
	}

	query := fmt.Sprintf(`
		UPDATE posts
		SET %s
		WHERE id = $1
		RETURNING id, author_id, avatar_url, title, content, tags, status, created_at, updated_at
	`, joinWithComma(setParts))

	var updated Post
	err := r.db.GetContext(ctx, &updated, query, args...)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &updated, nil
}

func (r *postRepository) UpdateAvatarURL(ctx context.Context, authorID string, avatarURL string) error {
	if r.db == nil {
		return nil
	}

	const query = `
		UPDATE posts
		SET avatar_url = $1, updated_at = NOW()
		WHERE author_id = $2
	`

	_, err := r.db.ExecContext(ctx, query, avatarURL, authorID)
	return err
}


// DeleteByID — удаляет пост по ID.
func (r *postRepository) DeleteByID(ctx context.Context, id string) error {
	if r.db == nil {
		return ErrNotFound
	}

	const query = `
		DELETE FROM posts
		WHERE id = $1
	`

	res, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return err
	}

	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}

	if affected == 0 {
		return ErrNotFound
	}

	return nil
}

func joinWithAnd(parts []string) string {
	if len(parts) == 0 {
		return ""
	}
	res := parts[0]
	for i := 1; i < len(parts); i++ {
		res += " AND " + parts[i]
	}
	return res
}

func joinWithComma(parts []string) string {
	if len(parts) == 0 {
		return ""
	}
	res := parts[0]
	for i := 1; i < len(parts); i++ {
		res += ", " + parts[i]
	}
	return res
}
