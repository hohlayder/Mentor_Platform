package postgres

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/jmoiron/sqlx"
)

type RepositoryTokenPostgres struct {
	db *sqlx.DB
}

func NewRepositoryTokenPostgres(db *sqlx.DB) *RepositoryTokenPostgres{
	return &RepositoryTokenPostgres{db: db}
}

func (r *RepositoryTokenPostgres) CreateRefreshToken(ctx context.Context, userId string, hashRefreshToken string, expiresAt time.Time) error{
	query := `INSERT INTO refresh_tokens (user_id, hash_token, expires_at) VALUES ($1, $2, $3)`
	_, err := r.db.ExecContext(ctx, query, userId, hashRefreshToken, expiresAt)

	return err
}

func (r *RepositoryTokenPostgres) GetRefreshToken(ctx context.Context, hashToken string) (string, error) {
	var userId string
	query := `SELECT user_id FROM refresh_tokens WHERE hash_token=$1 AND revoked=FALSE AND expires_at > NOW()`
	
	err := r.db.GetContext(ctx, &userId, query, hashToken)
	if err != nil {
		return "", fmt.Errorf("failed to get token: %w", err)
	}

	return userId, nil
}

func (r *RepositoryTokenPostgres) DeleteRefreshToken(ctx context.Context, hashToken string) error {
	query := `DELETE FROM refresh_tokens WHERE hash_token=$1`
	_, err := r.db.ExecContext(ctx, query, hashToken) 
	if err != nil {
		return fmt.Errorf("failed to delete token: %w", err)
	}
	return nil
} 

func (r *RepositoryTokenPostgres) RevokedToken(ctx context.Context, hashToken string) error {
	query := `UPDATE refresh_tokens SET revoked=TRUE WHERE hash_token=$1`
	result, err := r.db.ExecContext(ctx, query, hashToken)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("failed does not exists")
		}
		return fmt.Errorf("failed to revoked token: %w", err)
	}
	
	rowsAffected, _ := result.RowsAffected()
    if rowsAffected == 0 {
        return errors.New("token not found")
    }
	
	return nil
}