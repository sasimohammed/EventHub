from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

from .redis_client import read_snapshot, write_snapshot
from .snapshot import compute_snapshot

app = FastAPI(title="analytics-service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/analytics/summary")
def summary(response: Response):
    # Prevent browser/proxy caching.
    response.headers["Cache-Control"] = (
        "no-store, no-cache, must-revalidate"
    )
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"

    try:
        # Always calculate a fresh snapshot
        # from the latest catalog, bookings and reviews.
        snapshot = compute_snapshot()

        # Save the newest successful snapshot in Redis.
        write_snapshot(snapshot)

        return snapshot

    except Exception as exc:
        # If fresh calculation fails,
        # return the last successful snapshot.
        cached_snapshot = read_snapshot()

        if cached_snapshot is not None:
            return cached_snapshot

        raise HTTPException(
            status_code=503,
            detail=f"Could not calculate analytics: {str(exc)}",
        )