package postgres

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/hohlayder/Mentor_Platform/auth_service/internal/domain"

	"github.com/jmoiron/sqlx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAuthRepositoryPostgres_Register(t *testing.T) {
	tests := []struct {
		name           string
		id             string
		hashPassword   string
		setupMock      func(mock sqlmock.Sqlmock)
		expectedError  bool
		expectedErrMsg string
	}{
		{
			name:         "successful registration",
			id:           "user-123",
			hashPassword: "hashed_password",
			setupMock: func(mock sqlmock.Sqlmock) {
				mock.ExpectExec(`INSERT INTO auth_credentials\(user_id, hash_password\) VALUES \(\$1, \$2\)`).
					WithArgs("user-123", "hashed_password").
					WillReturnResult(sqlmock.NewResult(1, 1))
			},
			expectedError: false,
		},
		{
			name:         "database error on registration",
			id:           "user-123",
			hashPassword: "hashed_password",
			setupMock: func(mock sqlmock.Sqlmock) {
				mock.ExpectExec(`INSERT INTO auth_credentials\(user_id, hash_password\) VALUES \(\$1, \$2\)`).
					WithArgs("user-123", "hashed_password").
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

			repo := NewAuthRepositoryPostgres(sqlxDB)
			tt.setupMock(mock)

			ctx := context.Background()
			err = repo.Register(ctx, tt.id, tt.hashPassword)

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

func TestAuthRepositoryPostgres_GetCredentialByUserId(t *testing.T) {
	now := time.Now()
	
	tests := []struct {
		name           string
		userId         string
		setupMock      func(mock sqlmock.Sqlmock)
		expectedResult *domain.Credential
		expectedError  bool
		expectedErrMsg string
	}{
		{
			name:   "successful get credential",
			userId: "user-123",
			setupMock: func(mock sqlmock.Sqlmock) {
				rows := sqlmock.NewRows([]string{"user_id", "hash_password", "last_login_at"}).
					AddRow("user-123", "hashed_password", now)
				mock.ExpectQuery(`SELECT \* FROM auth_credentials WHERE user_id=\$1`).
					WithArgs("user-123").
					WillReturnRows(rows)
			},
			expectedResult: &domain.Credential{
				UserId:       "user-123",
				HashPassword: "hashed_password",
				LastLoginAt:  sql.NullTime{Time: now, Valid: true},
			},
			expectedError: false,
		},
		{
			name:   "credential not found",
			userId: "non-existent-user",
			setupMock: func(mock sqlmock.Sqlmock) {
				mock.ExpectQuery(`SELECT \* FROM auth_credentials WHERE user_id=\$1`).
					WithArgs("non-existent-user").
					WillReturnError(sql.ErrNoRows)
			},
			expectedResult: nil,
			expectedError:  true,
			expectedErrMsg: "no rows",
		},
		{
			name:   "database error",
			userId: "user-123",
			setupMock: func(mock sqlmock.Sqlmock) {
				mock.ExpectQuery(`SELECT \* FROM auth_credentials WHERE user_id=\$1`).
					WithArgs("user-123").
					WillReturnError(errors.New("connection failed"))
			},
			expectedResult: nil,
			expectedError:  true,
			expectedErrMsg: "connection failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			db, mock, err := sqlmock.New()
			require.NoError(t, err)
			defer db.Close()

			sqlxDB := sqlx.NewDb(db, "sqlmock")
			defer sqlxDB.Close()

			repo := NewAuthRepositoryPostgres(sqlxDB)
			tt.setupMock(mock)

			ctx := context.Background()
			result, err := repo.GetCredentialByUserId(ctx, tt.userId)

			if tt.expectedError {
				assert.Error(t, err)
				if tt.expectedErrMsg != "" {
					assert.Contains(t, err.Error(), tt.expectedErrMsg)
				}
				assert.Nil(t, result)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}

			assert.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

func TestNewAuthRepositoryPostgres(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	sqlxDB := sqlx.NewDb(db, "sqlmock")
	defer sqlxDB.Close()

	repo := NewAuthRepositoryPostgres(sqlxDB)

	assert.NotNil(t, repo)
	assert.Equal(t, sqlxDB, repo.db)

	assert.NoError(t, mock.ExpectationsWereMet())
}

