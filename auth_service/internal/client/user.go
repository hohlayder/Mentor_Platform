package client

import (
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

func (c *UserClient) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	
	return nil
}