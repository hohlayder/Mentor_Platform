package jwt

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

type mockTokenRepository struct {
	mock.Mock
}

func (m *mockTokenRepository) CreateRefreshToken(ctx context.Context, userID string, tokenHash string, expiresAt time.Time) error {
	args := m.Called(ctx, userID, tokenHash, expiresAt)
	return args.Error(0)
}

func (m *mockTokenRepository) GetRefreshToken(ctx context.Context, tokenHash string) (string, error) {
	args := m.Called(ctx, tokenHash)
	return args.String(0), args.Error(1)
}

func (m *mockTokenRepository) RevokedToken(ctx context.Context, tokenHash string) error {
	args := m.Called(ctx, tokenHash)
	return args.Error(0)
}

func (m *mockTokenRepository) DeleteRefreshToken(ctx context.Context, tokenHash string) error {
	args := m.Called(ctx, tokenHash)
	return args.Error(0)
}

func TestTokenManager_GenerateTokenPair_Success(t *testing.T) {
	secret := []byte("test-secret")
	accessExpiry := 15 * time.Minute
	refreshExpiry := 24 * time.Hour
	
	mockTokenRepo := &mockTokenRepository{}
	tm := NewTokenManager(secret, accessExpiry, refreshExpiry, mockTokenRepo)

	userID := "user-123"

	mockTokenRepo.On("CreateRefreshToken", mock.Anything, userID, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).
		Return(nil)

	tokenPair, err := tm.GenerateTokenPair(userID)

	assert.NoError(t, err)
	assert.NotNil(t, tokenPair)
	assert.NotEmpty(t, tokenPair.AccessToken)
	assert.NotEmpty(t, tokenPair.RefreshToken)
	assert.Equal(t, "Bearer", tokenPair.TokenType)
	assert.True(t, tokenPair.ExpiresIn > 0)
	assert.True(t, time.Until(tokenPair.ExpiresAt) > 0)

	mockTokenRepo.AssertCalled(t, "CreateRefreshToken", mock.Anything, userID, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time"))
}

func TestTokenManager_GenerateTokenPair_SaveTokenError(t *testing.T) {
	secret := []byte("test-secret")
	accessExpiry := 15 * time.Minute
	refreshExpiry := 24 * time.Hour
	
	mockTokenRepo := &mockTokenRepository{}
	tm := NewTokenManager(secret, accessExpiry, refreshExpiry, mockTokenRepo)

	userID := "user-123"
	dbError := errors.New("database error")

	mockTokenRepo.On("CreateRefreshToken", mock.Anything, userID, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).
		Return(dbError)

	tokenPair, err := tm.GenerateTokenPair(userID)

	assert.Error(t, err)
	assert.Nil(t, tokenPair)
	assert.Contains(t, err.Error(), "failed to save refreshToken")
	assert.Contains(t, err.Error(), "database error")
}

func TestTokenManager_RefreshTokens_Success(t *testing.T) {
	secret := []byte("test-secret")
	accessExpiry := 15 * time.Minute
	refreshExpiry := 24 * time.Hour
	
	mockTokenRepo := &mockTokenRepository{}
	tm := NewTokenManager(secret, accessExpiry, refreshExpiry, mockTokenRepo)

	refreshToken := "test-refresh-token"
	hashedToken := HashToken(refreshToken)
	userID := "user-123"

	mockTokenRepo.On("GetRefreshToken", mock.Anything, hashedToken).
		Return(userID, nil)

	mockTokenRepo.On("CreateRefreshToken", mock.Anything, userID, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).
		Return(nil)

	mockTokenRepo.On("RevokedToken", mock.Anything, hashedToken).
		Return(nil)

	newTokenPair, err := tm.RefreshTokens(refreshToken)

	assert.NoError(t, err)
	assert.NotNil(t, newTokenPair)
	assert.NotEmpty(t, newTokenPair.AccessToken)
	assert.NotEmpty(t, newTokenPair.RefreshToken)

	mockTokenRepo.AssertCalled(t, "GetRefreshToken", mock.Anything, hashedToken)
	mockTokenRepo.AssertCalled(t, "RevokedToken", mock.Anything, hashedToken)
}

func TestTokenManager_RefreshTokens_InvalidToken(t *testing.T) {
	secret := []byte("test-secret")
	accessExpiry := 15 * time.Minute
	refreshExpiry := 24 * time.Hour
	
	mockTokenRepo := &mockTokenRepository{}
	tm := NewTokenManager(secret, accessExpiry, refreshExpiry, mockTokenRepo)

	refreshToken := "invalid-refresh-token"
	hashedToken := HashToken(refreshToken)

	mockTokenRepo.On("GetRefreshToken", mock.Anything, hashedToken).
		Return("", errors.New("token not found"))

	tokenPair, err := tm.RefreshTokens(refreshToken)

	assert.Error(t, err)
	assert.Nil(t, tokenPair)
	assert.Contains(t, err.Error(), "failed to check token valid")
	assert.Contains(t, err.Error(), "token not found")
}

func TestTokenManager_RefreshTokens_RevokeError(t *testing.T) {
	secret := []byte("test-secret")
	accessExpiry := 15 * time.Minute
	refreshExpiry := 24 * time.Hour
	
	mockTokenRepo := &mockTokenRepository{}
	tm := NewTokenManager(secret, accessExpiry, refreshExpiry, mockTokenRepo)

	refreshToken := "test-refresh-token"
	hashedToken := HashToken(refreshToken)
	userID := "user-123"

	mockTokenRepo.On("GetRefreshToken", mock.Anything, hashedToken).
		Return(userID, nil)

	mockTokenRepo.On("CreateRefreshToken", mock.Anything, userID, mock.AnythingOfType("string"), mock.AnythingOfType("time.Time")).
		Return(nil)

	mockTokenRepo.On("RevokedToken", mock.Anything, hashedToken).
		Return(errors.New("revoke failed"))

	tokenPair, err := tm.RefreshTokens(refreshToken)

	assert.Error(t, err)
	assert.Nil(t, tokenPair)
	assert.Contains(t, err.Error(), "failed to revoked token")
	assert.Contains(t, err.Error(), "revoke failed")
}

func TestTokenManager_GenerateAccessToken_Success(t *testing.T) {
	secret := []byte("test-secret")
	accessExpiry := 15 * time.Minute
	refreshExpiry := 24 * time.Hour
	
	mockTokenRepo := &mockTokenRepository{}
	tm := NewTokenManager(secret, accessExpiry, refreshExpiry, mockTokenRepo)

	userID := "user-123"

	token, expiresIn, err := tm.GenerateAccessToken(userID)

	require.NoError(t, err)
	assert.NotEmpty(t, token)
	assert.Equal(t, int64(accessExpiry/time.Second), expiresIn)

	parsedToken, err := jwt.ParseWithClaims(token, &CustomClaims{}, func(token *jwt.Token) (interface{}, error) {
		return secret, nil
	})

	require.NoError(t, err)
	assert.True(t, parsedToken.Valid)

	claims, ok := parsedToken.Claims.(*CustomClaims)
	require.True(t, ok)
	assert.Equal(t, userID, claims.UserId)
	assert.Equal(t, "access", claims.TokenType)
	assert.True(t, time.Until(claims.ExpiresAt.Time) > 0)
}

func TestTokenManager_generateRefreshToken_Success(t *testing.T) {
	secret := []byte("test-secret")
	accessExpiry := 15 * time.Minute
	refreshExpiry := 24 * time.Hour
	
	mockTokenRepo := &mockTokenRepository{}
	tm := NewTokenManager(secret, accessExpiry, refreshExpiry, mockTokenRepo)

	tokens := make(map[string]bool)
	for i := 0; i < 10; i++ {
		token, err := tm.generateRefreshToken()
		require.NoError(t, err)
		assert.NotEmpty(t, token)
		assert.Len(t, token, 64) 

		assert.False(t, tokens[token])
		tokens[token] = true
	}
}




