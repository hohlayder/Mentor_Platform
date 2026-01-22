package e2e

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"os"
	"testing"
	"time"
)

func baseURL() string {
	if v := os.Getenv("BASE_URL"); v != "" {
		return v
	}
	return "http://localhost:8080/api/v1"
}

func doJSON(t *testing.T, method, url string, reqBody any, out any) (*http.Response, []byte) {
	t.Helper()

	var body io.Reader
	if reqBody != nil {
		b, err := json.Marshal(reqBody)
		if err != nil {
			t.Fatalf("marshal request: %v", err)
		}
		body = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, url, body)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	if reqBody != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("http do: %v", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)

	if out != nil && len(raw) > 0 {
		if err := json.Unmarshal(raw, out); err != nil {
			t.Fatalf("unmarshal response: %v, body=%s", err, string(raw))
		}
	}

	return resp, raw
}

func TestAuthRegisterLoginAndFetchUser(t *testing.T) {
	rand.Seed(time.Now().UnixNano())

	email := fmt.Sprintf("e2e_%d_%d@example.com", time.Now().Unix(), rand.Intn(100000))
	password := "securepassword123"

	registerReq := map[string]any{
		"name":     "John",
		"surname":  "Doe",
		"email":    email,
		"password": password,
	}

	var registerResp struct {
		ID string `json:"id"`
	}

	resp, raw := doJSON(t, http.MethodPost, baseURL()+"/auth/register", registerReq, &registerResp)
	if resp.StatusCode != 200 && resp.StatusCode != 201 {
		t.Fatalf("register status=%d body=%s", resp.StatusCode, string(raw))
	}
	if registerResp.ID == "" {
		t.Fatalf("register response id is empty, body=%s", string(raw))
	}

	loginReq := map[string]any{
		"email":    email,
		"password": password,
	}

	var loginResp struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int64  `json:"expires_in"`
	}

	resp, raw = doJSON(t, http.MethodPost, baseURL()+"/auth/login", loginReq, &loginResp)
	if resp.StatusCode != 200 {
		t.Fatalf("login status=%d body=%s", resp.StatusCode, string(raw))
	}
	if loginResp.AccessToken == "" || loginResp.RefreshToken == "" {
		t.Fatalf("login tokens are empty, body=%s", string(raw))
	}

	var userResp struct {
		UserID    string `json:"user_id"`
		Email     string `json:"email"`
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
	}

	resp, raw = doJSON(t, http.MethodGet, baseURL()+"/users/email/"+email, nil, &userResp)
	if resp.StatusCode != 200 {
		t.Fatalf("get user status=%d body=%s", resp.StatusCode, string(raw))
	}
	if userResp.Email != email {
		t.Fatalf("expected email=%s got=%s body=%s", email, userResp.Email, string(raw))
	}
	if userResp.UserID == "" {
		t.Fatalf("expected non-empty user_id body=%s", string(raw))
	}
}
