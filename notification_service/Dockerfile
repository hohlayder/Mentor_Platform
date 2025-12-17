FROM golang:1.24.3-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main ./cmd/notification_service

FROM alpine:latest

RUN addgroup -g 1000 -S appuser && \
    adduser -u 1000 -S appuser -G appuser

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /home/appuser/

COPY --from=builder --chown=appuser:appuser /app/main .

COPY --from=builder --chown=appuser:appuser /app/config ./config

RUN chown -R appuser:appuser /home/appuser/

USER appuser

EXPOSE 50054

CMD ["./main"]