package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

// Rating — доменная модель оценки/отзыва
type Rating struct {
	ID        string    `db:"id"`
	PostID    string    `db:"post_id"`
	UserID    string    `db:"user_id"`
	Rate      int32     `db:"rate"`
	Comment   string    `db:"comment"`
	CreatedAt time.Time `db:"created_at"`
}

// RatingAgg — агрегированные данные по рейтингу поста.
type RatingAgg struct {
	PostID        string  `db:"post_id"`
	AverageRating float64 `db:"avg_rating"`
	RatingsCount  int32   `db:"ratings_count"`
}

// RatingRepository — интерфейс репозитория рейтингов.
type RatingRepository interface {
	UpsertRating(ctx context.Context, postID, userID string, rate int32, comment string) error
	GetAggregatedRating(ctx context.Context, postID string) (float64, int32, error)
	GetAggregatedRatingsForPosts(ctx context.Context, postIDs []string) (map[string]RatingAgg, error)
	GetRatingsByPostID(ctx context.Context, postID string, limit, offset int) ([]Rating, int32, error)
}

type ratingRepository struct {
	db *sqlx.DB
}

func NewRatingRepository(db *sqlx.DB) RatingRepository {
	return &ratingRepository{db: db}
}

// UpsertRating — вставка или обновление рейтинга пользователя для поста.
func (r *ratingRepository) UpsertRating(ctx context.Context, postID, userID string, rate int32, comment string) error {
	if r.db == nil {
		return nil
	}

	const query = `
		INSERT INTO post_ratings (id, post_id, user_id, rate, comment, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (post_id, user_id)
		DO UPDATE SET
			rate = EXCLUDED.rate,
			comment = EXCLUDED.comment,
			created_at = EXCLUDED.created_at
	`

	_, err := r.db.ExecContext(ctx, query,
		uuid.NewString(),
		postID,
		userID,
		rate,
		comment,
		time.Now().UTC(),
	)

	return err
}

func (r *ratingRepository) GetRatingsByPostID(ctx context.Context, postID string, limit, offset int) ([]Rating, int32, error) {
	if r.db == nil {
		return nil, 0, nil
	}

	// Получаем общее количество
	countQuery := `
		SELECT COUNT(*) 
		FROM post_ratings 
		WHERE post_id = $1
	`
	var total int32
	err := r.db.GetContext(ctx, &total, countQuery, postID)
	if err != nil {
		return nil, 0, err
	}

	// Получаем отзывы с пагинацией
	query := `
		SELECT id, post_id, user_id, rate, comment, created_at
		FROM post_ratings
		WHERE post_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	var ratings []Rating
	err = r.db.SelectContext(ctx, &ratings, query, postID, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	return ratings, total, nil
}

// GetAggregatedRating — средняя оценка и количество оценок для одного поста.
func (r *ratingRepository) GetAggregatedRating(ctx context.Context, postID string) (float64, int32, error) {
	if r.db == nil {
		return 0, 0, nil
	}

	const query = `
		SELECT post_id, AVG(rate) AS avg_rating, COUNT(*) AS ratings_count
		FROM post_ratings
		WHERE post_id = $1
		GROUP BY post_id
	`

	var agg RatingAgg
	err := r.db.GetContext(ctx, &agg, query, postID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, 0, nil
		}
		return 0, 0, err
	}

	return agg.AverageRating, agg.RatingsCount, nil
}

// GetAggregatedRatingsForPosts — агрегаты по набору постов.
func (r *ratingRepository) GetAggregatedRatingsForPosts(ctx context.Context, postIDs []string) (map[string]RatingAgg, error) {
	result := make(map[string]RatingAgg)
	if r.db == nil {
		return result, nil
	}
	if len(postIDs) == 0 {
		return result, nil
	}

	const query = `
		SELECT post_id, AVG(rate) AS avg_rating, COUNT(*) AS ratings_count
		FROM post_ratings
		WHERE post_id = ANY($1)
		GROUP BY post_id
	`

	var aggs []RatingAgg
	// КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: []string -> pq.StringArray
	err := r.db.SelectContext(ctx, &aggs, query, pq.StringArray(postIDs))
	if err != nil {
		return nil, err
	}

	for _, a := range aggs {
		result[a.PostID] = a
	}

	return result, nil
}
