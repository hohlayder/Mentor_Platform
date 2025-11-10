package postgres


import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRepositoryTokenPostgres_CreateRefreshToken(t *testing.T) {
	tests := []struct {
		name           string
		userId         string
		hashToken      string
		expiresAt      time.Time
		setupMock      func(mock sqlmock.Sqlmock)
		expectedError  bool
		expectedErrMsg string
	}{
		{
			name:      "successful token creation",
			userId:    "user-123",
			hashToken: "hash_token_123",
			expiresAt: time.Now().Add(24 * time.Hour),
			setupMock: func(mock sqlmock.Sqlmock) {
				mock.ExpectExec(`INSERT INTO refresh_tokens \(user_id, hash_token, expires_at\) VALUES \(\$1, \$2, \$3\)`).
					WithArgs("user-123", "hash_token_123", sqlmock.AnyArg()).
					WillReturnResult(sqlmock.NewResult(1, 1))
			},
			expectedError: false,
		},
		{
			name:      "database error on token creation",
			userId:    "user-123",
			hashToken: "hash_token_123",
			expiresAt: time.Now().Add(24 * time.Hour),
			setupMock: func(mock sqlmock.Sqlmock) {
				mock.ExpectExec(`INSERT INTO refresh_tokens \(user_id, hash_token, expires_at\) VALUES \(\$1, \$2, \$3\)`).
					WithArgs("user-123", "hash_token_123", sqlmock.AnyArg()).
					WillReturnError(errors.New("database error"))
			},
			expectedError:  true,
			expectedErrMsg: "database error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db, mock, err := sqlmock.New()
			require.NoError(t, err)
			defer db.Close()

			sqlxDB := sqlx.NewDb(db, "sqlmock")
			defer sqlxDB.Close()

			repo := NewRepositoryTokenPostgres(sqlxDB)
			tt.setupMock(mock)

			ctx := context.Background()
			err = repo.CreateRefreshToken(ctx, tt.userId, tt.hashToken, tt.expiresAt)

			if tt.expectedError {
				assert.Error(t, err)
				if tt.expectedErrMsg != "" {
					assert.Contains(t, err.Error(), tt.expectedErrMsg)
				}
			} else {
				assert.NoError(t, err)
			}

			assert.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

func TestRepositoryTokenPostgres_GetRefreshToken(t *testing.T) {
	tests := []struct {
		name           string
		hashToken      string
		setupMock      func(mock sqlmock.Sqlmock)
		expectedUserId string
		expectedError  bool
		expectedErrMsg string
	}{
		{
			name:      "successful get token",
			hashToken: "valid_hash_token",
			setupMock: func(mock sqlmock.Sqlmock) {
				rows := sqlmock.NewRows([]string{"user_id"}).
					AddRow("user-123")
				mock.ExpectQuery(`SELECT user_id FROM refresh_tokens WHERE hash_token=\$1 AND revoked=FALSE AND expires_at > NOW\(\)`).
					WithArgs("valid_hash_token").
					WillReturnRows(rows)
			},
			expectedUserId: "user-123",
			expectedError:  false,
		},
		{
			name:      "token not found",
			hashToken: "non_existent_token",
			setupMock: func(mock sqlmock.Sqlmock) {
				mock.ExpectQuery(`SELECT user_id FROM refresh_tokens WHERE hash_token=\$1 AND revoked=FALSE AND expires_at > NOW\(\)`).
					WithArgs("non_existent_token").
					WillReturnError(sql.ErrNoRows)
			},
			expectedUserId: "",
			expectedError:  true,
			expectedErrMsg: "failed to get token",
		},
		{
			name:      "database error",
			hashToken: "valid_hash_token",
			setupMock: func(mock sqlmock.Sqlmock) {
				mock.ExpectQuery(`SELECT user_id FROM refresh_tokens WHERE hash_token=\$1 AND revoked=FALSE AND expires_at > NOW\(\)`).
					WithArgs("valid_hash_token").
					WillReturnError(errors.New("connection error"))
			},
			expectedUserId: "",
			expectedError:  true,
			expectedErrMsg: "failed to get token: connection error",
		},
		{
			name:      "token revoked",
			hashToken: "revoked_token",
			setupMock: func(mock sqlmock.Sqlmock) {
				mock.ExpectQuery(`SELECT user_id FROM refresh_tokens WHERE hash_token=\$1 AND revoked=FALSE AND expires_at > NOW\(\)`).
					WithArgs("revoked_token").
					WillReturnError(sql.ErrNoRows)
			},
			expectedUserId: "",
			expectedError:  true,
			expectedErrMsg: "failed to get token",
		},
		{
			name:      "token expired",
			hashToken: "expired_token",
			setupMock: func(mock sqlmock.Sqlmock) {
				mock.ExpectQuery(`SELECT user_id FROM refresh_tokens WHERE hash_token=\$1 AND revoked=FALSE AND expires_at > NOW\(\)`).
					WithArgs("expired_token").
					WillReturnError(sql.ErrNoRows)
			},
			expectedUserId: "",
			expectedError:  true,
			expectedErrMsg: "failed to get token",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db, mock, err := sqlmock.New()
			require.NoError(t, err)
			defer db.Close()

			sqlxDB := sqlx.NewDb(db, "sqlmock")
			defer sqlxDB.Close()

			repo := NewRepositoryTokenPostgres(sqlxDB)
			tt.setupMock(mock)

			ctx := context.Background()
			userId, err := repo.GetRefreshToken(ctx, tt.hashToken)

			if tt.expectedError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErrMsg)
				assert.Equal(t, tt.expectedUserId, userId)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedUserId, userId)
			}

			assert.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

func TestRepositoryTokenPostgres_DeleteRefreshToken(t *testing.T) {
	tests := []struct {
		name           string
		hashToken      string
		setupMock      func(mock sqlmock.Sqlmock)
		expectedError  bool
		expectedErrMsg string
	}{
		{
			name:      "successful token deletion",
			hashToken: "hash_token_to_delete",
			setupMock: func(mock sqlmock.Sqlmock) {
				mock.ExpectExec(`DELETE FROM refresh_tokens WHERE hash_token=\$1`).
					WithArgs("hash_token_to_delete").
					WillReturnResult(sqlmock.NewResult(0, 1))
			},
			expectedError: false,
		},
		{
			name:      "token not found for deletion",
			hashToken: "non_existent_token",
			setupMock: func(mock sqlmock.Sqlmock) {
				mock.ExpectExec(`DELETE FROM refresh_tokens WHERE hash_token=\$1`).
					WithArgs("non_existent_token").
					WillReturnResult(sqlmock.NewResult(0, 0))
			},
			expectedError: false, // No error expected even if no rows deleted
		},
		{
			name:      "database error on deletion",
			hashToken: "hash_token_to_delete",
			setupMock: func(mock sqlmock.Sqlmock) {
				mock.ExpectExec(`DELETE FROM refresh_tokens WHERE hash_token=\$1`).
					WithArgs("hash_token_to_delete").
					WillReturnError(errors.New("database error"))
			},
			expectedError:  true,
			expectedErrMsg: "failed to delete token: database error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db, mock, err := sqlmock.New()
			require.NoError(t, err)
			defer db.Close()

			sqlxDB := sqlx.NewDb(db, "sqlmock")
			defer sqlxDB.Close()

			repo := NewRepositoryTokenPostgres(sqlxDB)
			tt.setupMock(mock)

			ctx := context.Background()
			err = repo.DeleteRefreshToken(ctx, tt.hashToken)

			if tt.expectedError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedErrMsg)
			} else {
				assert.NoError(t, err)
			}

			assert.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

func TestRepositoryTokenPostgres_RevokedToken(t *testing.T) {
	tests := []struct {
		name           string
		hashToken      string
		setupMock      func(mock sqlmock.Sqlmock)
		expectedError  bool
		expectedErrMsg string
	}{
		{
			name:      "successful token revocation",
			hashToken: "hash_token_to_revoke",
			setupMock: func(mock sqlmock.Sqlmock) {
				mock.ExpectExec(`UPDATE refresh_tokens SET revoked=TRUE WHERE hash_token=\$1`).
					WithArgs("hash_token_to_revoke").
					WillReturnResult(sqlmock.NewResult(0, 1))
			},
			expectedError: false,
		},
		{
			name:      "token not found for revocation",
			hashToken: "non_existent_token",
			setupMock: func(mock sqlmock.Sqlmock) {
				mock.ExpectExec(`UPDATE refresh_tokens SET revoked=TRUE WHERE hash_token=\$1`).
					WithArgs("non_existent_token").
					WillReturnResult(sqlmock.NewResult(0, 0))
			},
			expectedError:  true,
			expectedErrMsg: "token not found",
		},
		{
			name:      "database error on revocation",
			hashToken: "hash_token_to_revoke",
			setupMock: func(mock sqlmock.Sqlmock) {
				mock.ExpectExec(`UPDATE refresh_tokens SET revoked=TRUE WHERE hash_token=\$1`).
					WithArgs("hash_token_to_revoke").
					WillReturnError(errors.New("database error"))
			},
			expectedError:  true,
			expectedErrMsg: "failed to revoked token: database error",
		},
		{
			name:      "sql no rows error on revocation",
			hashToken: "hash_token_to_revoke",
			setupMock: func(mock sqlmock.Sqlmock) {
				mock.ExpectExec(`UPDATE refresh_tokens SET revoked=TRUE WHERE hash_token=\$1`).
					WithArgs("hash_token_to_revoke").
					WillReturnError(sql.ErrNoRows)
			},
			expectedError:  true,
			expectedErrMsg: "failed does not exists",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db, mock, err := sqlmock.New()
			require.NoError(t, err)
			defer db.Close()

			sqlxDB := sqlx.NewDb(db, "sqlmock")
			defer sqlxDB.Close()

			repo := NewRepositoryTokenPostgres(sqlxDB)
			tt.setupMock(mock)

			ctx := context.Background()
			err = repo.RevokedToken(ctx, tt.hashToken)

			if tt.expectedError {
				assert.Error(t, err)
				if tt.expectedErrMsg != "" {
					assert.Contains(t, err.Error(), tt.expectedErrMsg)
				}
			} else {
				assert.NoError(t, err)
			}

			assert.NoError(t, mock.ExpectationsWereMet())
		})
	}
}
