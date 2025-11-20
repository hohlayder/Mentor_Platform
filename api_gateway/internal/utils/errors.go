package utils

type SuccessResponse struct {
    Message string `json:"message"`
}

type ErrorResponse struct {
    Error   string `json:"error"`
    Message string `json:"message"`
    Details string `json:"details,omitempty"`
}