# ---- build stage ----
FROM golang:1.23-alpine AS builder
RUN apk add --no-cache git gcc musl-dev
WORKDIR /src
# cache modules
COPY go.mod go.sum* ./
RUN go mod download || true
COPY . .
# Copy prebuilt UI dist into embed folder if provided
ARG UI_DIST=dist
COPY ${UI_DIST} /src/dist/
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o /out/netmon .

# ---- runtime ----
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=builder /out/netmon /app/netmon
COPY config.example.yaml /app/config.yaml
RUN mkdir -p /app/data
ENV NETMON_DATABASE_DSN=/app/data/netmon.db
ENV TZ=Asia/Jakarta
EXPOSE 8080
# non-root
RUN adduser -D -h /app netmon && chown -R netmon /app
USER netmon
ENTRYPOINT ["/app/netmon"]
CMD ["-config", "/app/config.yaml"]
