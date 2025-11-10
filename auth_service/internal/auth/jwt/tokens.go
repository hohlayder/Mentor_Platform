package jwt

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type TokenPair struct {
    AccessToken  string    `json:"access_token"`
    RefreshToken string    `json:"refresh_token"`
    ExpiresIn    int64     `json:"expires_in"`
    TokenType    string    `json:"token_type"`
    ExpiresAt    time.Time `json:"expires_at"`
}

type CustomClaims struct {
	UserId string
	jwt.RegisteredClaims
	TokenType string `json:"type"`
}

type Config struct {
	AccessSecret  string
	AccessExpiry  time.Duration
	RefreshExpiry time.Duration
}