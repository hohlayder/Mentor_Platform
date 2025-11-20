package client

import (
	"context"

	chatv1 "github.com/Sergey-1214/contracts_mentors/chat/v1"
	"google.golang.org/grpc"
)

type ChatClient struct {
	Client chatv1.ChatServiceClient
	conn *grpc.ClientConn
}

func NewChatClient(conn *grpc.ClientConn) *ChatClient{
	return &ChatClient{
		Client: chatv1.NewChatServiceClient(conn),
		conn: conn,
	}
}

func (c *ChatClient) CreateChat(ctx context.Context, in *chatv1.CreateChatRequest) (*chatv1.CreateChatResponse, error) {
    return c.Client.CreateChat(ctx, in)
}

func (c *ChatClient) GetUserChats(ctx context.Context, in *chatv1.GetUserChatsRequest) (*chatv1.GetUserChatsResponse, error) {
    return c.Client.GetUserChats(ctx, in)
}

func (c *ChatClient) GetChatById(ctx context.Context, in *chatv1.GetChatByIdRequest) (*chatv1.GetChatByIdResponse, error) {
    return c.Client.GetChatById(ctx, in)
}

func (c *ChatClient) GetChatMessages(ctx context.Context, in *chatv1.GetChatMessagesRequest) (*chatv1.GetChatMessagesResponse, error) {
    return c.Client.GetChatMessages(ctx, in)
}

func (c *ChatClient) MarkMessagesRead(ctx context.Context, in *chatv1.MarkMessagesReadRequest) (*chatv1.MarkMessagesReadResponse, error) {
    return c.Client.MarkMessagesRead(ctx, in)
}

func (c *ChatClient) CheckUserAccessToChat(ctx context.Context, in *chatv1.CheckUserAccessToChatRequest) (*chatv1.CheckUserAccessToChatResponse, error) {
    return c.Client.CheckUserAccessToChat(ctx, in)
}

func (c *ChatClient) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}