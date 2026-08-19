# Phase 1 Notes

## Bugs Found and Fixed

### 1. Auth Service — Login Always Fails (`JWT_SECRET` Typo)

**File:** `services/auth-service-node/src/routes/auth.js`

**Problem:**
The `/login` handler used `process.env.JWT_SECERT` instead of `process.env.JWT_SECRET`.

The `.env.example` correctly defines `JWT_SECRET`, so the value was always `undefined`. As a result, `jsonwebtoken` failed to create a token and `POST /api/auth/login` returned `500`.

**Fix:**
Corrected the environment variable name:

```js
process.env.JWT_SECRET
```

---

### 2. Auth Service — `.env` Was Not Loaded

**File:** `services/auth-service-node/src/index.js`

**Problem:**
Although `dotenv` was listed as a dependency and a `.env.example` file existed, the service never loaded the `.env` file.

Therefore, variables such as `JWT_SECRET`, `PGHOST`, and others remained undefined.

**Fix:**
Added the following as the first line of `index.js`:

```js
require('dotenv').config();
```

---

### 3. Frontend — Incorrect Shared `API_BASE_URL`

**File:** `frontend/src/api.js`

**Problem:**
The frontend originally sent all requests to:

```text
http://localhost:8080
```

Phase 1 does not have an API gateway. Each service runs on its own port:

| Service    |   Port |
| ---------- | -----: |
| Catalog    | `8081` |
| Auth       | `8082` |
| Booking    | `8083` |
| AI Insight | `8084` |
| Analytics  | `8085` |

Nothing was running on port `8080`, causing API requests to fail.

**Fix:**
Updated `api.js` to use separate URLs:

```text
AUTH_URL
CATALOG_URL
BOOKING_URL
AI_URL
ANALYTICS_URL
```

---

### 4. Missing CORS Configuration

**Files:**

* `services/auth-service-node/src/index.js`
* `services/booking-service-python/app/main.py`
* `services/ai-insight-service-python/app/main.py`

**Problem:**
The frontend runs on:

```text
http://localhost:3000
```

while backend services run on different ports. This makes the requests cross-origin.

Auth, Booking, and AI Insight did not have CORS configured, causing browsers to block requests even when the services themselves worked correctly.

**Fix:**
Added CORS middleware to all three services, allowing:

```text
http://localhost:3000
```

Catalog and Analytics already had CORS configured.

---

### 5. Legacy Catalog Service — Missing `/health`

**File:**
`services/legacy-catalog-java/.../CatalogController.java`

**Problem:**
`docs/API_CONTRACT.md` requires every service to provide:

```http
GET /health
```

The Catalog service did not have this endpoint.

**Fix:**
Added:

```http
GET /health
```

Returning:

```json
{
  "status": "ok"
}
```


# Verification

The following checks were successfully completed:

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
```

Login now returns a valid JWT token without a `500` error.

### Catalog

The frontend successfully loads events from:

```text
http://localhost:8081
```

with no CORS errors in the browser console.

### Booking & Reviews

Successfully tested:

```text
Book an event
      ↓
Submit a review
      ↓
Run analytics job
      ↓
Refresh dashboard
```

The booking and review data appears in the dashboard charts and table.

### Health Check

```bash
curl http://localhost:8081/health
```

Response:

```json
{"status":"ok"}
```

---

# Phase 1 Status

| Component             | Status    |
| --------------------- | --------- |
| Auth Service          | ✅ Fixed   |
| JWT Authentication    | ✅ Working |
| Environment Variables | ✅ Fixed   |
| Frontend API URLs     | ✅ Fixed   |
| CORS                  | ✅ Fixed   |
| Catalog `/health`     | ✅ Added   |
| Registration          | ✅ Working |
| Login                 | ✅ Working |
| Catalog               | ✅ Working |
| Booking               | ✅ Working |
| Reviews               | ✅ Working |
| AI Sentiment          | ✅ Working |
| Analytics Job         | ✅ Working |
| Dashboard             | ✅ Working |

