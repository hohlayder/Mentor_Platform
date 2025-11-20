package client

import (
	"context"

	authv1 "github.com/Sergey-1214/contracts_mentors/auth/v1"
	"google.golang.org/grpc"
)

type AuthClient struct {
	Client authv1.AuthServiceClient
	conn *grpc.ClientConn
}

func NewAuthClient(conn *grpc.ClientConn) *AuthClient{
	return &AuthClient{
		Client: authv1.NewAuthServiceClient(conn),
		conn: conn,
	}
}

func (c *AuthClient) Register(ctx context.Context, in *authv1.RegisterRequest) (*authv1.RegisterResponse, error) {
    return c.Client.Register(ctx, in)
}

func (c *AuthClient) Login(ctx context.Context, in *authv1.LoginRequest) (*authv1.LoginResponse, error) {
    return c.Client.Login(ctx, in)
}

func (c *AuthClient) Refresh(ctx context.Context, in *authv1.RefreshRequest) (*authv1.RefreshResponse, error) {
    return c.Client.Refresh(ctx, in)
}

func (c *AuthClient) Logout(ctx context.Context, in *authv1.LogoutRequest) (*authv1.LogoutResponse, error) {
    return c.Client.Logout(ctx, in)
}

func (c *AuthClient) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}