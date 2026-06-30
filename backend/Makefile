BINARY  := netmon
PKG     := github.com/polije/netmon
VERSION ?= 2.6.0
LDFLAGS := -s -w -X main.version=$(VERSION)

.PHONY: all build run tidy docker clean

all: build

tidy:
	cd .. && go mod tidy

build:
	CGO_ENABLED=1 go build -ldflags="$(LDFLAGS)" -o $(BINARY) .

run: build
	./$(BINARY) -config config.example.yaml

docker:
	docker build -t polije/netmon:$(VERSION) .
	docker tag polije/netmon:$(VERSION) polije/netmon:latest

lint:
	go vet ./...

clean:
	rm -f $(BINARY)
	rm -rf data/
