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
	Session *SessionClient
	Post *PostClient
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

	sessionConn, err := grpc.NewClient(os.Getenv("SESSION_SERVICE_URL"), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}

	postConn, err := grpc.NewClient(os.Getenv("POST_SERVICE_URL"), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}

	return &Client{
		User: NewUserClient(userConn),
		Auth: NewAuthClient(authConn),
		Chat: NewChatClient(chatConn),
		Session: NewSessionClient(sessionConn),
		Post: NewPostClient(postConn),
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

	if c.Session != nil {
		if closeErr := c.Session.Close(); closeErr != nil {
			slog.Error("failed to close session client", "err", closeErr)
			err = closeErr
		}
	}
	
	return err
}