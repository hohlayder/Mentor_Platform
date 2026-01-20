package client

import (
	"context"

	sessionv1 "github.com/Sergey-1214/contracts_mentors/session/v1"
	"google.golang.org/grpc"
)

type SessionClient struct {
	Client sessionv1.MentorshipServiceClient
	conn *grpc.ClientConn
}

func NewSessionClient(conn *grpc.ClientConn) *SessionClient{
	return &SessionClient{
		Client: sessionv1.NewMentorshipServiceClient(conn),
		conn: conn,
	}
}


func (c *SessionClient) CreateSlot(ctx context.Context, in *sessionv1.CreateSlotRequest) (*sessionv1.CreateSlotResponse, error){
	return c.Client.CreateSlot(ctx, in)
}

func (c *SessionClient) GetSlot(ctx context.Context, in *sessionv1.GetSlotRequest) (*sessionv1.GetSlotResponse, error) {
	return c.Client.GetSlot(ctx, in)
}

func (c *SessionClient) UpdateSlot(ctx context.Context, in *sessionv1.UpdateSlotRequest) (*sessionv1.UpdateSlotResponse, error) {
	return c.Client.UpdateSlot(ctx, in)
}

func (c *SessionClient) DeleteSlot(ctx context.Context, in *sessionv1.DeleteSlotRequest) (*sessionv1.DeleteSlotResponse, error) {
	return c.Client.DeleteSlot(ctx, in)
}

func (c *SessionClient) CreateSession(ctx context.Context, in *sessionv1.CreateSessionRequest) (*sessionv1.CreateSessionResponse, error) {
	return c.Client.CreateSession(ctx, in)
}

func (c *SessionClient) GetSession(ctx context.Context, in *sessionv1.GetSessionRequest) (*sessionv1.GetSessionResponse, error) {
	return c.Client.GetSession(ctx, in)
}

func (c *SessionClient) UpdateSession(ctx context.Context, in *sessionv1.UpdateSessionRequest) (*sessionv1.UpdateSessionResponse, error) {
	return c.Client.UpdateSession(ctx, in)
}

func (c *SessionClient) DeleteSession(ctx context.Context, in *sessionv1.DeleteSessionRequest) (*sessionv1.DeleteSessionResponse, error) {
	return c.Client.DeleteSession(ctx, in)
}

func (c *SessionClient) ListSessionsByMentor(ctx context.Context, in *sessionv1.ListSessionsByMentorRequest) (*sessionv1.ListSessionsResponse, error) {
	return c.Client.ListSessionsByMentor(ctx, in)
}

func (c *SessionClient) ListSessionsByStudent(ctx context.Context, in *sessionv1.ListSessionsByStudentRequest) (*sessionv1.ListSessionsResponse, error) {
	return c.Client.ListSessionsByStudent(ctx, in)
}

func (c *SessionClient) UpdateSlotStatus(ctx context.Context, in *sessionv1.UpdateSlotStatusRequest) (*sessionv1.UpdateSlotStatusResponse, error) {
	return c.Client.UpdateSlotStatus(ctx, in)
}

func (c *SessionClient) RateSession(ctx context.Context, in *sessionv1.RateSessionRequest) (*sessionv1.RateSessionResponse, error) {
	return c.Client.RateSession(ctx, in)
}

func (c *SessionClient) GetSlotsByMentor(ctx context.Context, in *sessionv1.GetSlotsByMentorRequest) (*sessionv1.GetSlotsByMentorResponse, error) {
	return c.Client.GetSlotsByMentor(ctx, in)
}

func (c SessionClient) GetMentorPaymentAmount(ctx context.Context, in *sessionv1.GetMentorPaymentAmountRequest) (*sessionv1.GetMentorPaymentAmountResponse, error) {
	return c.Client.GetMentorPaymentAmount(ctx, in)
}

func (c *SessionClient) Close() error {
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}