# post_service/Dockerfile

# --- Стадия сборки ---
FROM golang:1.24.4 AS builder

WORKDIR /app

ENV CGO_ENABLED=0 GOOS=linux GOARCH=amd64

# Сначала зависимости, чтобы кешировалось
COPY go.mod go.sum ./
RUN go mod download

# Затем весь исходный код сервиса
COPY . .

# Собираем бинарник
RUN go build -o /app/post_service ./cmd/post

# --- Финальный образ ---
FROM alpine:3.20

RUN adduser -D -g '' appuser && \
    apk add --no-cache ca-certificates

USER appuser
WORKDIR /app

COPY --from=builder /app/post_service /app/post_service

ENV GRPC_PORT=50056

EXPOSE 50056

CMD ["/app/post_service"]
