package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

type Favorite struct {
	ID        string    `db:"id"`
	UserID    string    `db:"user_id"`
	PostID    string    `db:"post_id"`
	CreatedAt time.Time `db:"created_at"`
}

type FavoriteRepository interface {
	AddFavorite(ctx context.Context, userID, postID string) error
	RemoveFavorite(ctx context.Context, userID, postID string) error
	CountFavoritesByPostID(ctx context.Context, postID string) (int32, error)
	GetUserFavorites(ctx context.Context, userID string, limit, offset int) ([]Favorite, int32, error)
	GetFavoritePosts(ctx context.Context, userID string, limit, offset int) ([]Post, int32, error)
	GetCountFavouriteByMentor(ctx context.Context, mentorID string) (int64, error)
}

type favoriteRepository struct {
	db *sqlx.DB
}

func NewFavoriteRepository(db *sqlx.DB) FavoriteRepository {
	return &favoriteRepository{db: db}
}

func (r *favoriteRepository) AddFavorite(ctx context.Context, userID, postID string) error {
	if r.db == nil {
		return nil
	}

	isFavorite, err := r.IsFavorite(ctx, userID, postID)
	if err != nil {
		return err
	}
	if isFavorite {
		return nil 
	}

	const query = `
		INSERT INTO user_post_favorites (id, user_id, post_id, created_at)
		VALUES ($1, $2, $3, $4)
	`

	_, err = r.db.ExecContext(ctx, query,
		uuid.NewString(),
		userID,
		postID,
		time.Now().UTC(),
	)

	return err
}

func (r *favoriteRepository) RemoveFavorite(ctx context.Context, userID, postID string) error {
	if r.db == nil {
		return nil
	}

	const query = `
		DELETE FROM user_post_favorites
		WHERE user_id = $1 AND post_id = $2
	`

	result, err := r.db.ExecContext(ctx, query, userID, postID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return errors.New("favorite not found")
	}

	return nil
}

func (r *favoriteRepository) IsFavorite(ctx context.Context, userID, postID string) (bool, error) {
	if r.db == nil {
		return false, nil
	}

	const query = `
		SELECT COUNT(*)
		FROM user_post_favorites
		WHERE user_id = $1 AND post_id = $2
	`

	var count int
	err := r.db.GetContext(ctx, &count, query, userID, postID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return false, nil
		}
		return false, err
	}

	return count > 0, nil
}

func (r *favoriteRepository) CountFavoritesByPostID(ctx context.Context, postID string) (int32, error) {
	if r.db == nil {
		return 0, nil
	}

	const query = `
		SELECT COUNT(*)
		FROM user_post_favorites
		WHERE post_id = $1
	`

	var count int32
	err := r.db.GetContext(ctx, &count, query, postID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, nil
		}
		return 0, err
	}

	return count, nil
}

func (r *favoriteRepository) GetUserFavorites(ctx context.Context, userID string, limit, offset int) ([]Favorite, int32, error) {
	if r.db == nil {
		return []Favorite{}, 0, nil
	}

	countQuery := `
		SELECT COUNT(*)
		FROM user_post_favorites
		WHERE user_id = $1
	`

	var total int32
	err := r.db.GetContext(ctx, &total, countQuery, userID)
	if err != nil {
		return nil, 0, err
	}

	// Получаем записи с пагинацией
	query := `
		SELECT id, user_id, post_id, created_at
		FROM user_post_favorites
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	var favorites []Favorite
	err = r.db.SelectContext(ctx, &favorites, query, userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	return favorites, total, nil
}

// GetFavoritePosts - получает посты, добавленные пользователем в избранное
func (r *favoriteRepository) GetFavoritePosts(ctx context.Context, userID string, limit, offset int) ([]Post, int32, error) {
	if r.db == nil {
		return []Post{}, 0, nil
	}

	// Получаем общее количество
	countQuery := `
		SELECT COUNT(*)
		FROM user_post_favorites f
		JOIN posts p ON f.post_id = p.id
		WHERE f.user_id = $1 AND p.status = 'PUBLISHED'
	`

	var total int32
	err := r.db.GetContext(ctx, &total, countQuery, userID)
	if err != nil {
		return nil, 0, err
	}

	query := `
		SELECT p.id, p.author_id, p.avatar_url, p.title, p.content, p.tags, p.status, p.created_at, p.updated_at
		FROM user_post_favorites f
		JOIN posts p ON f.post_id = p.id
		WHERE f.user_id = $1 AND p.status = 'PUBLISHED'
		ORDER BY f.created_at DESC
		LIMIT $2 OFFSET $3
	`

	var posts []Post
	err = r.db.SelectContext(ctx, &posts, query, userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	return posts, total, nil
}

func (r *favoriteRepository) GetCountFavouriteByMentor(ctx context.Context, mentorID string) (int64, error) {
	if r.db == nil {
		return 0, nil
	}

	query := `SELECT COUNT(DISTINCT user_id) 
			  FROM user_post_favorites f
			  JOIN posts p ON f.post_id = p.id
			  WHERE p.author_id = $1 AND p.status = 'PUBLISHED'`
	
	var count int64 
	err := r.db.GetContext(ctx, &count, query, mentorID)
	if err != nil {
		return 0, fmt.Errorf("failed to get count favourite posts by mentor: %w", err)
	}

	return count, nil
}