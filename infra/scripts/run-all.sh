#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

NETWORK="eventhub-net"

echo "========================================"
echo " EventHub Phase 2 - Starting"
echo "========================================"

# ==================================================
# Helpers
# ==================================================

container_exists() {
    podman container exists "$1"
}

container_running() {
    [ "$(podman inspect --format '{{.State.Status}}' "$1" 2>/dev/null || true)" = "running" ]
}

ensure_network() {
    if podman network exists "$NETWORK"; then
        echo "Network $NETWORK already exists."
    else
        echo "Creating network $NETWORK..."
        podman network create "$NETWORK"
    fi
}

ensure_network_connection() {
    local container="$1"

    if ! podman inspect "$container" \
        --format '{{range $name, $net := .NetworkSettings.Networks}}{{$name}}{{"\n"}}{{end}}' \
        2>/dev/null | grep -qx "$NETWORK"; then

        echo "Connecting $container to $NETWORK..."
        podman network connect "$NETWORK" "$container"
    fi
}

wait_for_container() {
    local name="$1"

    echo "Waiting for $name..."

    for i in $(seq 1 60); do
        if container_running "$name"; then
            echo "$name is running."
            return 0
        fi

        sleep 2
    done

    echo "ERROR: $name did not start."
    podman logs "$name" 2>/dev/null || true
    exit 1
}

wait_for_port() {
    local container="$1"
    local host="$2"
    local port="$3"

    echo "Waiting for $container ($host:$port)..."

    for i in $(seq 1 60); do

        if podman exec "$container" \
            sh -c "nc -z $host $port >/dev/null 2>&1" 2>/dev/null; then

            echo "$container:$port is ready."
            return 0
        fi

        sleep 2
    done

    echo "ERROR: $host:$port is not ready."
    podman logs "$container" 2>/dev/null || true
    exit 1
}

remove_stale() {
    local name="$1"

    if container_exists "$name" && ! container_running "$name"; then
        echo "Removing stopped container: $name"
        podman rm "$name" >/dev/null 2>&1 || true
    fi
}

# ==================================================
# Network
# ==================================================

echo ""
echo "==> Checking EventHub network..."

ensure_network

# ==================================================
# Infrastructure
# ==================================================

echo ""
echo "==> Starting infrastructure..."

# ---------------- PostgreSQL ----------------

if ! container_exists eventhub-postgres; then

    podman run -d \
        --name eventhub-postgres \
        --network "$NETWORK" \
        -e POSTGRES_USER=eventhub \
        -e POSTGRES_PASSWORD=eventhub \
        -e POSTGRES_DB=eventhub_auth \
        -v eventhub-postgres-data:/var/lib/postgresql/data \
        postgres:16

else
    echo "eventhub-postgres already exists."
    ensure_network_connection eventhub-postgres

    if ! container_running eventhub-postgres; then
        echo "Starting eventhub-postgres..."
        podman start eventhub-postgres >/dev/null
    fi
fi

# ---------------- MongoDB ----------------

if ! container_exists eventhub-mongo; then

    podman run -d \
        --name eventhub-mongo \
        --network "$NETWORK" \
        -v eventhub-mongo-data:/data/db \
        mongo:7

else
    echo "eventhub-mongo already exists."
    ensure_network_connection eventhub-mongo

    if ! container_running eventhub-mongo; then
        echo "Starting eventhub-mongo..."
        podman start eventhub-mongo >/dev/null
    fi
fi

# ---------------- MySQL ----------------

if ! container_exists eventhub-mysql; then

    podman run -d \
        --name eventhub-mysql \
        --network "$NETWORK" \
        -e MYSQL_ROOT_PASSWORD=rootpassword \
        -e MYSQL_DATABASE=eventhub_catalog \
        -v eventhub-mysql-data:/var/lib/mysql \
        mysql:8

else
    echo "eventhub-mysql already exists."
    ensure_network_connection eventhub-mysql

    if ! container_running eventhub-mysql; then
        echo "Starting eventhub-mysql..."
        podman start eventhub-mysql >/dev/null
    fi
fi

# ---------------- Redis ----------------

if ! container_exists eventhub-redis; then

    podman run -d \
        --name eventhub-redis \
        --network "$NETWORK" \
        -v eventhub-redis-data:/data \
        redis:7

else
    echo "eventhub-redis already exists."
    ensure_network_connection eventhub-redis

    if ! container_running eventhub-redis; then
        echo "Starting eventhub-redis..."
        podman start eventhub-redis >/dev/null
    fi
fi

# ---------------- RabbitMQ ----------------

if ! container_exists eventhub-rabbitmq; then

    podman run -d \
        --name eventhub-rabbitmq \
        --network "$NETWORK" \
        -v eventhub-rabbitmq-data:/var/lib/rabbitmq \
        rabbitmq:3

else
    echo "eventhub-rabbitmq already exists."
    ensure_network_connection eventhub-rabbitmq

    if ! container_running eventhub-rabbitmq; then
        echo "Starting eventhub-rabbitmq..."
        podman start eventhub-rabbitmq >/dev/null
    fi
fi

# ==================================================
# Wait for infrastructure
# ==================================================

wait_for_container eventhub-postgres
wait_for_container eventhub-mongo
wait_for_container eventhub-mysql
wait_for_container eventhub-redis
wait_for_container eventhub-rabbitmq

# ==================================================
# Build images
# ==================================================

echo ""
echo "==> Building images..."

podman build -t eventhub-auth services/auth-service-node
podman build -t eventhub-booking services/booking-service-python
podman build -t eventhub-ai services/ai-insight-service-python
podman build -t eventhub-catalog services/legacy-catalog-java
podman build -t eventhub-notification services/notification-worker-go
podman build -t eventhub-analytics services/analytics-service-python
podman build -t eventhub-frontend frontend

# ==================================================
# Remove old service containers
# ==================================================

echo ""
echo "==> Removing old EventHub service containers..."

for container in \
    eventhub-ai \
    eventhub-auth \
    eventhub-catalog \
    eventhub-booking \
    eventhub-notification \
    eventhub-analytics \
    eventhub-frontend
do
    remove_stale "$container"
done

# ==================================================
# AI
# ==================================================

echo ""
echo "==> Starting AI..."

if ! container_exists eventhub-ai; then

    podman run -d \
        --name eventhub-ai \
        --network "$NETWORK" \
        -p 8084:8084 \
        -e PORT=8084 \
        -e OLLAMA_URL=http://host.containers.internal:11434 \
        -e OLLAMA_MODEL=llama3.2:1b \
        eventhub-ai

else
    podman start eventhub-ai >/dev/null 2>&1 || true
fi

wait_for_container eventhub-ai

# ==================================================
# Auth
# ==================================================

echo ""
echo "==> Starting Auth..."

if ! container_exists eventhub-auth; then

    podman run -d \
        --name eventhub-auth \
        --network "$NETWORK" \
        -p 8082:8082 \
        -e PORT=8082 \
        -e PGHOST=eventhub-postgres \
        -e PGPORT=5432 \
        -e PGUSER=eventhub \
        -e PGPASSWORD=eventhub \
        -e PGDATABASE=eventhub_auth \
        -e JWT_SECRET=change-me-in-production \
        eventhub-auth

else
    podman start eventhub-auth >/dev/null 2>&1 || true
fi

wait_for_container eventhub-auth

# ==================================================
# Catalog
# ==================================================

echo ""
echo "==> Starting Catalog..."

if ! container_exists eventhub-catalog; then

    podman run -d \
        --name eventhub-catalog \
        --network "$NETWORK" \
        -p 8081:8081 \
        -e SPRING_DATASOURCE_URL=jdbc:mysql://eventhub-mysql:3306/eventhub_catalog \
        -e SPRING_DATASOURCE_USERNAME=root \
        -e SPRING_DATASOURCE_PASSWORD=rootpassword \
        eventhub-catalog

else
    podman start eventhub-catalog >/dev/null 2>&1 || true
fi

wait_for_container eventhub-catalog

# ==================================================
# Booking
# ==================================================

echo ""
echo "==> Starting Booking..."

if ! container_exists eventhub-booking; then

    podman run -d \
        --name eventhub-booking \
        --network "$NETWORK" \
        -p 8083:8083 \
        -e MONGO_URI=mongodb://eventhub-mongo:27017 \
        -e MONGO_DB=eventhub_bookings \
        -e RABBITMQ_URL=amqp://guest:guest@eventhub-rabbitmq:5672/ \
        -e RABBITMQ_QUEUE=bookings \
        -e AI_INSIGHT_URL=http://eventhub-ai:8084 \
        eventhub-booking

else
    podman start eventhub-booking >/dev/null 2>&1 || true
fi

wait_for_container eventhub-booking

# ==================================================
# Notification
# ==================================================

echo ""
echo "==> Starting Notification Worker..."

if ! container_exists eventhub-notification; then

    podman run -d \
        --name eventhub-notification \
        --network "$NETWORK" \
        -e RABBITMQ_URL=amqp://guest:guest@eventhub-rabbitmq:5672/ \
        -e RABBITMQ_QUEUE=bookings \
        eventhub-notification

else
    podman start eventhub-notification >/dev/null 2>&1 || true
fi

wait_for_container eventhub-notification

# ==================================================
# Analytics API
# ==================================================

echo ""
echo "==> Starting Analytics API..."

if ! container_exists eventhub-analytics; then

    podman run -d \
        --name eventhub-analytics \
        --network "$NETWORK" \
        -p 8085:8085 \
        -e REDIS_URL=redis://eventhub-redis:6379/0 \
        -e SNAPSHOT_KEY=analytics:snapshot \
        eventhub-analytics \
        uvicorn app.main:app \
        --host 0.0.0.0 \
        --port 8085

else
    podman start eventhub-analytics >/dev/null 2>&1 || true
fi

wait_for_container eventhub-analytics

# ==================================================
# Frontend
# ==================================================

echo ""
echo "==> Starting Frontend..."

if ! container_exists eventhub-frontend; then

    podman run -d \
        --name eventhub-frontend \
        --network "$NETWORK" \
        -p 3000:80 \
        eventhub-frontend

else
    podman start eventhub-frontend >/dev/null 2>&1 || true
fi

wait_for_container eventhub-frontend

# ==================================================
# DNS verification
# ==================================================

echo ""
echo "==> Verifying EventHub network..."

podman inspect eventhub-postgres --format "{{json .NetworkSettings.Networks}}"
podman inspect eventhub-mysql --format "{{json .NetworkSettings.Networks}}"
podman inspect eventhub-catalog --format "{{json .NetworkSettings.Networks}}"

echo "EventHub network verification complete."

# ==================================================
# Analytics job
# ==================================================

echo ""
echo "==> Running analytics job..."

podman run --rm \
    --network "$NETWORK" \
    -e REDIS_URL=redis://eventhub-redis:6379/0 \
    -e BOOKING_SERVICE_URL=http://eventhub-booking:8083 \
    -e CATALOG_SERVICE_URL=http://eventhub-catalog:8081 \
    -e SNAPSHOT_KEY=analytics:snapshot \
    eventhub-analytics \
    python job.py

# ==================================================
# Done
# ==================================================

echo ""
echo "========================================"
echo " EventHub Phase 2 is running!"
echo "========================================"
echo ""
echo "Network:   $NETWORK"
echo ""
echo "Frontend:  http://localhost:3000"
echo "Auth:      http://localhost:8082"
echo "Catalog:   http://localhost:8081"
echo "Booking:   http://localhost:8083"
echo "AI:        http://localhost:8084"
echo "Analytics: http://localhost:8085"
echo ""
echo "========================================"