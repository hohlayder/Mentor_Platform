package client

import (
	"log/slog"
	"os"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type Client struct {
	User *UserClient
	Auth *AuthClient
	Chat *ChatClient
}

func NewClient() (*Client, error) {	
	userConn, err := grpc.NewClient(os.Getenv("USER_SERVICE_URL"), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}

	authConn, err := grpc.NewClient(os.Getenv("AUTH_SERVICE_URL"), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}

	chatConn, err := grpc.NewClient(os.Getenv("CHAT_SERVICE_URL"), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}

	return &Client{
		User: NewUserClient(userConn),
		Auth: NewAuthClient(authConn),
		Chat: NewChatClient(chatConn),
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

	if c.Auth != nil {
		if closeErr := c.Auth.Close(); closeErr != nil {
			slog.Error("failed to close auth client", "err", closeErr)
			err = closeErr
		}
	}

	if c.Chat != nil {
		if closeErr := c.Chat.Close(); closeErr != nil {
			slog.Error("failed to close chat client", "err", closeErr)
			err = closeErr
		}
	}
	
	return err
}