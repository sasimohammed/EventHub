# Runbook — one-line start per service

Assumes one-time setup is done for each service (deps installed, `.env`
copied from `.env.example`, matching database running locally on Windows
as a service). After that, start each independently from its own folder:

| Service | Folder | Start command |
|---|---|---|
| Legacy catalog (Java) | `services/legacy-catalog-java` | Run `CatalogApplication` from IntelliJ, or `mvn spring-boot:run` |
| Auth (Node.js) | `services/auth-service-node` | `npm start` |
| Booking (Python) | `services/booking-service-python` | `uvicorn app.main:app --host 0.0.0.0 --port 8083` |
| Notification worker (Go) | `services/notification-worker-go` | `go run main.go` |
| AI Insight (Python) | `services/ai-insight-service-python` | `uvicorn app.main:app --host 0.0.0.0 --port 8084` |
| Analytics API (Python) | `services/analytics-service-python` | `uvicorn app.main:app --host 0.0.0.0 --port 8085` |
| Analytics job (Python, one-shot) | `services/analytics-service-python` | `python job.py` |
| Frontend (React) | `frontend` | `npm run dev` |
