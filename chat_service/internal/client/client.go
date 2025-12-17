package client

import (
	"log/slog"
	"os"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type Client struct {
	User *UserClient
}

func NewClient() (*Client, error) {	
	userConn, err := grpc.NewClient(os.Getenv("USER_SERVICE_URL"), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}

	return &Client{
		User: NewUserClient(userConn),
	}, nil
}

func (c *Client) Close() error {
	var err error
	if c.User != nil {
		if closeErr := c.User.Close(); closeErr != nil {
			slog.Error("failed to close user client", "err", closeErr)
			err = closeErr
		}
	}

	return err
}