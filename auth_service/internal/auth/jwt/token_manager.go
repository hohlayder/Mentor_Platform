package jwt

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
)

type TokenRepository interface {
	CreateRefreshToken(ctx context.Context, userId string, hashRefreshToken string, expiresAt time.Time) error
	GetRefreshToken(ctx context.Context, hashToken string) (string, error)
	RevokedToken(ctx context.Context, hashToken string) error
	DeleteRefreshToken(ctx context.Context, hashToken string) error
}


type TokenManager struct {
	secret       []byte
	accessExpiry time.Duration
	refreshExpiry time.Duration
	tokenRepo TokenRepository
}

func NewTokenManager(secret []byte, accessExpiry time.Duration, refreshExpiry time.Duration, tokenRepo TokenRepository) *TokenManager{
	return &TokenManager{
		secret: secret,
		accessExpiry: accessExpiry,
		refreshExpiry: refreshExpiry,
		tokenRepo: tokenRepo,
	}
}

func (m *TokenManager) GenerateTokenPair(userId string) (*TokenPair, error) {
	accessToken, expiresIn, err := m.GenerateAccessToken(userId)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	refreshToken, err := m.generateRefreshToken() 
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token:%w", err)
	}

	hashRefreshToken := HashToken(refreshToken)
	expiresAt := time.Now().Add(m.refreshExpiry)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := m.tokenRepo.CreateRefreshToken(ctx, userId, hashRefreshToken, expiresAt); err != nil {
		return nil, fmt.Errorf("failed to save refreshToken: %w", err)
	}

	return &TokenPair{
		AccessToken: accessToken,
		RefreshToken: refreshToken,
		ExpiresIn: expiresIn,
		TokenType: "Bearer",
		ExpiresAt: expiresAt,
	}, nil
}

func (m *TokenManager) RefreshTokens(refreshToken string) (*TokenPair, error) {
	hashRefreshToken := HashToken(refreshToken)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	userId, err := m.tokenRepo.GetRefreshToken(ctx, hashRefreshToken)
	if err != nil {
		return nil, fmt.Errorf("failed to check token valid: %w", err)
	}

	tokens, err := m.GenerateTokenPair(userId); 
	if err != nil {
		return nil, fmt.Errorf("failed to genereate tokens: %w", err)
	}

	if err := m.tokenRepo.RevokedToken(ctx, hashRefreshToken); err != nil {
		return nil, fmt.Errorf("failed to revoked token: %w", err)
	}

	return tokens, nil
}

func (m *TokenManager) generateRefreshToken() (string, error) {
    bytes := make([]byte, 32)
    if _, err := rand.Read(bytes); err != nil {
        return "", fmt.Errorf("failed to generate random bytes: %w", err)
    }
    return hex.EncodeToString(bytes), nil
}

func (m *TokenManager) GenerateAccessToken(userId string) (string, int64, error) {
	expiresAt := time.Now().Add(m.accessExpiry)
	expiresIn := int64(m.accessExpiry / time.Second)

	jwtClaims := CustomClaims{
		UserId: userId,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
		TokenType: "access",
	}

	jwtToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwtClaims) 

	token, err := jwtToken.SignedString(m.secret)
	if err != nil {
		return "", 0, err
	}
	return token, expiresIn, nil
}



func HashToken(token string) string {
    hash := sha256.Sum256([]byte(token))
    return hex.EncodeToString(hash[:])
}
