package client

import (
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type Client struct {
	User *UserClient
}

func NewClient() (*Client, error) {
	conn, err := grpc.NewClient("user-service:50051", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}

	return &Client{
		User: NewUserClient(conn),
	}, nil
}

func (c *Client) Close() error {
	if err := c.User.Close(); err != nil {
		return err
	}

	return nil
}