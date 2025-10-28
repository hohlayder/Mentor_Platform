package grpc

import (
	"context"
	"log/slog"

	authv1 "github.com/Sergey-1214/contracts_mentors/auth/v1"
	"github.com/hohlayder/Mentor_Platform/auth_service/internal/auth/jwt"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)
type AuthService interface {
	Register(ctx context.Context, name string, surname string, email string, password string) (string, error)
	Login(ctx context.Context, email string, password string) (*jwt.TokenPair, error)
	RefreshToken(ctx context.Context, refreshToken string) (*jwt.TokenPair, error)
	Logout(ctx context.Context, refreshToken string) error
}

type GRPCHandler struct {
	service AuthService
    authv1.UnimplementedAuthServiceServer
}

func NewGRPCHandler(service AuthService) *GRPCHandler {
    return &GRPCHandler{service: service}
}

func (h *GRPCHandler) RegisterServer(server *grpc.Server) {
	authv1.RegisterAuthServiceServer(server, h)
}

func (h *GRPCHandler) Register(ctx context.Context, req *authv1.RegisterRequest) (*authv1.RegisterResponse, error) {
    id, err := h.service.Register(ctx, req.Name, req.Surname, req.Email, req.Password)
    if err != nil {
		slog.Error(err.Error())
        return nil, status.Error(codes.Internal, "failed to register user")
    }

	resp := authv1.RegisterResponse{
		Id: id,
	}

	return &resp, nil
}

func (h *GRPCHandler) Login(ctx context.Context, req *authv1.LoginRequest) (*authv1.LoginResponse, error) {
	tokens, err := h.service.Login(ctx, req.Email, req.Password)
	if err != nil {
		slog.Error(err.Error())
		return nil, status.Error(codes.Internal, "failed to login") 
	}

	resp := authv1.LoginResponse{
		AccessToken: tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresIn: tokens.ExpiresIn,
	}

	return &resp, err
}

func (h *GRPCHandler) RefreshToken(ctx context.Context, req *authv1.RefreshRequest) (*authv1.RefreshResponse, error) {
	tokens, err := h.service.RefreshToken(ctx, req.RefreshToken)
	if err != nil {
		slog.Error(err.Error())
		return nil, status.Error(codes.Internal, "failed to refresh token") 
	}

	resp := authv1.RefreshResponse{
		AccessToken: tokens.AccessToken,
		RefreshToken: tokens.RefreshToken,
		ExpiresIn: tokens.ExpiresIn,
	}

	return &resp, nil
}

func (h *GRPCHandler) Logout(ctx context.Context, req *authv1.LogoutRequest) (*authv1.LogoutResponse, error) {
	err := h.service.Logout(ctx, req.RefreshToken)
	if err != nil {
		slog.Error(err.Error())
		return nil, status.Error(codes.Internal, "failed to logout") 
	}

	resp := authv1.LogoutResponse{
		Success: true,
	}

	return &resp, nil
} 






