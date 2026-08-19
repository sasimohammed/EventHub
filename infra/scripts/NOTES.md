\# Phase 2 Notes



\- Containerized all services using Podman Containerfiles.

\- Created a dedicated `eventhub-net` Podman network.

\- Used named persistent volumes for PostgreSQL, MySQL, MongoDB, Redis, and RabbitMQ.

\- Services communicate using container names instead of localhost.

\- Added readiness polling before starting dependent services.

\- Analytics supports both API and background job entrypoints.

\- Analytics job runs once at the end of `run-all.sh` to generate the dashboard snapshot.

\- Docker Compose was not used.

