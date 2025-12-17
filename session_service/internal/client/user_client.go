package client

import (
	"context"

	userv1 "github.com/Sergey-1214/contracts_mentors/user/v1"
	"google.golang.org/grpc"
)

type UserClient struct {
	Client userv1.UserServiceClient
	conn *grpc.ClientConn
}

func NewUserClient(conn *grpc.ClientConn) *UserClient{
	return &UserClient{
		Client: userv1.NewUserServiceClient(conn),
		conn: conn,
	}
}

func (c *UserClient) CreateUser(ctx context.Context, in *userv1.CreateUserRequest) (*userv1.CreateUserResponse, error) {
    return c.Client.CreateUser(ctx, in)
}

func (c *UserClient) GetUserById(ctx context.Context, in *userv1.GetUserByIdRequest) (*userv1.GetUserByIdResponse, error) {
    return c.Client.GetUserById(ctx, in)
}

func (c *UserClient) GetUserByEmail(ctx context.Context, in *userv1.GetUserByEmailRequest) (*userv1.GetUserByEmailResponse, error) {
    return c.Client.GetUserByEmail(ctx, in)
}

func (c *UserClient) DeleteUser(ctx context.Context, in *userv1.DeleteUserRequest) (*userv1.DeleteUserResponse, error) {
    return c.Client.DeleteUser(ctx, in)
}

func (c *UserClient) GetProfileById(ctx context.Context, in *userv1.GetProfileByIdRequest) (*userv1.GetProfileByIdResponse, error) {
    return c.Client.GetProfileById(ctx, in)
}

func (c *UserClient) UpdateProfile(ctx context.Context, in *userv1.UpdateProfileRequest) (*userv1.UpdateProfileResponse, error) {
    return c.Client.UpdateProfile(ctx, in)
}

func (c *UserClient) UploadAvatar(ctx context.Context, in *userv1.UploadAvatarRequest) (*userv1.UploadAvatarResponse, error) {
    return c.Client.UploadAvatar(ctx, in)
}

func (c *UserClient) DeleteAvatar(ctx context.Context, in *userv1.DeleteAvatarRequest) (*userv1.DeleteAvatarResponse, error) {
    return c.Client.DeleteAvatar(ctx, in)
}

func (c *UserClient) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}