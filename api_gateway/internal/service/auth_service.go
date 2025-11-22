package service

import (
	"context"
	"fmt"

	authv1 "github.com/Sergey-1214/contracts_mentors/auth/v1"
	"github.com/hohlayder/Mentor_Platform/api_gateway/internal/domain"
)

type AuthClient interface {
    Register(ctx context.Context, in *authv1.RegisterRequest) (*authv1.RegisterResponse, error)
    Login(ctx context.Context, in *authv1.LoginRequest) (*authv1.LoginResponse, error)
    Refresh(ctx context.Context, in *authv1.RefreshRequest) (*authv1.RefreshResponse, error)
    Logout(ctx context.Context, in *authv1.LogoutRequest) (*authv1.LogoutResponse, error)
}

type AuthService struct {
	AuthClient AuthClient
}

func NewAuthService(authClient AuthClient) *AuthService {
	return &AuthService{AuthClient: authClient}
}

func (s *AuthService) Register(ctx context.Context, firstName string, lastName string, email string, password string) (string, error) {
	req := authv1.RegisterRequest{
		Name: firstName,
		Surname: lastName,
		Email: email,
		Password: password,
	}

	resp, err := s.AuthClient.Register(ctx, &req)
	if err != nil {
		return "", fmt.Errorf("failed to register user: %w", err)
	}

	return resp.Id, nil
}

func (s *AuthService) Login(ctx context.Context, email string, password string) (*domain.TokenPair, error) {
	req := authv1.LoginRequest{
		Email: email,
		Password: password,
	}

	resp, err := s.AuthClient.Login(ctx, &req)
	if err != nil {
		return nil, fmt.Errorf("failed to login user: %w", err)
	}

	return &domain.TokenPair{
		AccessToken: resp.AccessToken,
		RefreshToken: resp.RefreshToken,
		ExpiresIn: resp.ExpiresIn,
	}, nil
}

func (s *AuthService) RefreshToken(ctx context.Context, refreshToken string) (*domain.TokenPair, error) {
	req := authv1.RefreshRequest{
		RefreshToken: refreshToken,
	}

	resp, err := s.AuthClient.Refresh(ctx, &req)
	if err != nil {
		return nil, fmt.Errorf("failed to refresh token: %w", err)
	}

	return &domain.TokenPair{
		AccessToken: resp.AccessToken,
		RefreshToken: resp.RefreshToken,
		ExpiresIn: resp.ExpiresIn,
	}, nil
}

func (s *AuthService) Logout(ctx context.Context, refreshToken string) (bool, error) {
	req := authv1.LogoutRequest{
		RefreshToken: refreshToken,
	}

	resp, err := s.AuthClient.Logout(ctx, &req)
	if err != nil {
		return false, fmt.Errorf("failed to logout: %w", err)
	}

	
	return resp.Success, nil
}