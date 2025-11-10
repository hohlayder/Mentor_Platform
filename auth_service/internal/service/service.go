package service

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	userv1 "github.com/Sergey-1214/contracts_mentors/user/v1"

	"github.com/hohlayder/Mentor_Platform/auth_service/internal/domain"
	"github.com/hohlayder/Mentor_Platform/auth_service/internal/repository"

	jwt "github.com/hohlayder/Mentor_Platform/auth_service/internal/auth/jwt"
	"golang.org/x/crypto/bcrypt"
)

type TokenManager interface {
    GenerateTokenPair(userID string) (*jwt.TokenPair, error)
    RefreshTokens(refreshToken string) (*jwt.TokenPair, error)
}

type AuthRepository interface {
	Register(ctx context.Context, id string, hashPassword string) error
	GetCredentialByUserId(ctx context.Context, userId string) (*domain.Credential, error)
}

type TokenRepository interface {
	CreateRefreshToken(ctx context.Context, userId string, hashRefreshToken string, expiresAt time.Time) error
	GetRefreshToken(ctx context.Context, hashToken string) (string, error)
	RevokedToken(ctx context.Context, hashToken string) error
	DeleteRefreshToken(ctx context.Context, hashToken string) error
}

type AuthService struct {
	authRepo     repository.AuthRepository
	tokenRepo    repository.TokenRepository
	userClient   userv1.UserServiceClient
	tokenManager TokenManager
}

func NewAuthService(authRepo AuthRepository, tokenRepo TokenRepository, client userv1.UserServiceClient, tokenManager TokenManager) *AuthService{
	return &AuthService{
		authRepo: authRepo,
		tokenRepo: tokenRepo,
		userClient: client,
		tokenManager: tokenManager,
	}
}

func (s *AuthService) Register(ctx context.Context, name string, surname string, email string, password string) (string, error) {
	req := &userv1.CreateUserRequest{
		FirstName: name,
		LastName: surname,
		Email: email,
	}
	
	hashPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("failed to generate hash password: %w", err)
	}

	resp, err := s.userClient.CreateUser(ctx, req)
	if err != nil {
		return "", fmt.Errorf("failed to create user: %w", err)
	}

	err = s.authRepo.Register(ctx, resp.UserId, string(hashPassword))
	if err != nil {
		//Если не удалось сохранить, то нужно откатить в user (удалить запись)
		req := &userv1.DeleteUserRequest{
			UserId: resp.UserId,
		}

		rollbackCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		_, delErr := s.userClient.DeleteUser(rollbackCtx, req)
		if delErr != nil {
			slog.Error("Failed to delete user when rollback user create")
			return "", fmt.Errorf("failed to delete user when rollback user create: %w", delErr)
		}

		return "", fmt.Errorf("failed to register user: %w", err)
	}

	return resp.UserId, nil
}


func (s *AuthService) Login(ctx context.Context, email string, password string) (*jwt.TokenPair, error){
	userId, err := s.ValidateCredential(email, password)
	if err != nil {
		return nil, fmt.Errorf("failed to validate credential: %w", err)
	}
	slog.Info("credential validated")

	tokens, err := s.tokenManager.GenerateTokenPair(userId)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token pair: %w", err)
	}
	slog.Info("token generated")
	
	return tokens, nil
}

func (s *AuthService) RefreshToken(ctx context.Context, refreshToken string) (*jwt.TokenPair, error) {
	return s.tokenManager.RefreshTokens(refreshToken)
}

func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	hashRefreshToken := jwt.HashToken(refreshToken)
	err := s.tokenRepo.RevokedToken(ctx, hashRefreshToken)
	if err != nil {
		return fmt.Errorf("failed revoked token: %w", err)
	}

	return nil
}

func (s *AuthService) ValidateCredential(email string, password string) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req := &userv1.GetUserByEmailRequest{
		Email: email,
	}

	resp, err := s.userClient.GetUserByEmail(ctx, req)
	slog.Info("user got")
	if err != nil {
		return "", fmt.Errorf("failed to get user: %w", err)
	}

	userId := resp.User.UserId
	credential, err := s.authRepo.GetCredentialByUserId(ctx, userId)
	if err != nil {
		return "", err
	}
	slog.Info("credential took")
	if err = bcrypt.CompareHashAndPassword([]byte(credential.HashPassword), []byte(password)); err != nil {
		return "", fmt.Errorf("invalid password")
	}

	return userId, nil
}

