package utils

type SuccessResponse struct {
    Success bool `json:"success"` 
    Message string `json:"message,omitempty"`
}
type ErrorResponse struct {
    Error   string `json:"error"`
    Message string `json:"message"`
    Details string `json:"details,omitempty"`
}