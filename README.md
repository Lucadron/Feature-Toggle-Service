# Zebra Engineering Assignment: Feature Toggle Service

## Overview

This project implements a simplified Feature Toggle Service as per the Zebra Engineering assignment. It allows multiple tenants to manage and retrieve feature flags based on different environments (dev, staging, prod) via a REST API. The service includes authentication, caching, rate limiting, audit logging, and other production-ready features.

## Features Implemented

* **Multi-Tenant & Environment-Based:** Feature flags are stored and retrieved per tenant and environment (`dev`, `staging`, `prod`).
* **REST API:** Exposes endpoints for managing feature flags:
    * `POST /auth/token`: Authenticates tenants using `apiKey` and `apiSecret` to issue JWTs.
    * `GET /features`: Retrieves evaluated feature flags for a tenant and environment, supporting pagination (`page`, `limit`) and filtering (`filter` by name). Utilizes Redis caching.
    * `POST /features`: Creates or updates (upsert) a feature flag for a specific tenant, feature, and environment. Invalidates cache and logs the change.
    * `DELETE /features/{id}`: Deletes a specific feature flag instance by its unique ID. Invalidates cache and logs the change.
    * `GET /audit`: Retrieves paginated audit logs for the authenticated tenant, showing changes made to feature flags.
    * `POST /promote`: Promotes all feature flags from a source environment to a target environment for the authenticated tenant.
* **Authentication:** Uses JWT (JSON Web Tokens) for securing API endpoints. Tokens are obtained via the `/auth/token` endpoint.
* **Caching:** Implements a Redis caching layer for `GET /features` requests to ensure fast reads. Includes Time-To-Live (TTL) and cache invalidation logic on writes (`POST`, `DELETE`, `PROMOTE`).
* **Evaluation Strategies:** Supports `BOOLEAN` and `PERCENTAGE` rollout strategies during flag evaluation in the `GET /features` endpoint. The strategy is stored per flag.
* **Audit Logging:** Logs all create, update, delete, and promotion actions to an `audit_logs` table, including actor, timestamp, and a diff of changes (where applicable). Accessible via `GET /audit`.
* **Environment Promotion:** Provides a `POST /promote` endpoint to safely copy/update flags from one environment (e.g., staging) to another (e.g., prod) within a database transaction.
* **Rate Limiting:** Implements Redis-backed, per-tenant rate limiting on secured endpoints to prevent abuse. Includes standard `RateLimit-*` headers in responses.
* **Database:** Uses PostgreSQL for data persistence, managed via Prisma ORM. Includes schema migrations.
* **Observability:** Exposes basic Prometheus-compatible metrics at the `/metrics` endpoint, including counters for HTTP requests and feature flag evaluations.
* **API Documentation:** Provides interactive API documentation using Swagger UI, accessible at `/api-docs`.
* **Database Seeding:** Includes a `seed.ts` script (`npm run prisma:seed`) to populate the database with initial tenant and feature data for testing.
* **Dockerized Setup:** Uses Docker Compose to easily set up and run the required PostgreSQL and Redis services.
* **Testing:** Includes basic integration tests using Jest and Supertest for core endpoints (Authentication, Audit, Promotion). *(Note: `features.test.ts` contains known issues requiring further investigation).*

## Tech Stack

* **Backend:** Node.js, Express.js, TypeScript
* **Database:** PostgreSQL
* **ORM:** Prisma
* **Caching/Rate Limiting:** Redis
* **Authentication:** JWT (jsonwebtoken library), bcrypt
* **Testing:** Jest, Supertest
* **API Documentation:** Swagger UI, swagger-jsdoc
* **Containerization:** Docker, Docker Compose
* **Linting/Formatting:** (Assumed ESLint/Prettier setup if standard)
* **Frontend (Attempted):** Vite, React, TypeScript, Axios *(Note: Encountered persistent build/configuration issues with Tailwind/PostCSS, UI component development was not completed due to time constraints).*

## Setup & Running

**Prerequisites:**
* Node.js (v18.x or v20.x recommended)
* npm (v8.x or later)
* Docker & Docker Compose

**Steps:**

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd zebra-toggle-service
    ```
2.  **Install backend dependencies:**
    ```bash
    npm install
    ```
3.  **Set up Environment Variables:**
    * Copy the example environment file: `cp .env.example .env`
    * Review and update the variables in `.env` if necessary (especially `JWT_SECRET`). The default `DATABASE_URL` matches the Docker Compose setup.
4.  **Start Docker Services:**
    ```bash
    npm run db:up
    # Wait for PostgreSQL and Redis containers to be healthy (check with 'docker ps')
    ```
5.  **Run Database Migrations:**
    ```bash
    npx prisma migrate dev
    ```
6.  **Seed Initial Data:**
    ```bash
    npm run prisma:seed
    ```
7.  **Start the Backend Server (Development Mode):**
    ```bash
    npm run dev
    # Server will be running on http://localhost:3000 (or specified PORT)
    ```
8.  **(Optional - If Frontend Exists)** Navigate to the frontend directory (`cd ../zebra-ui`), run `npm install`, then `npm run dev`. Access the UI via the URL provided by Vite (e.g., `http://localhost:5173`).

## API Documentation

Interactive API documentation is available via Swagger UI when the backend server is running:
* [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

Use the `/auth/token` endpoint (or the seed script output) to get credentials, then use the "Authorize" button in Swagger UI to authenticate your requests.

## Testing

Run the integration tests using Jest:

```bash
npm test
```
## Known Issues / Limitations
Feature Tests: src/__tests__/features.test.ts contains failing tests related to foreign key constraints (P2003) during POST operations and pagination logic. This likely indicates issues with test isolation or setup regarding seed data consistency.

Open Handles in Tests: Jest may report open handles after tests complete (--detectOpenHandles). This is likely due to Redis client connections not being perfectly torn down in all test scenarios.

Frontend UI: The React frontend (zebra-ui directory) setup encountered persistent configuration issues with Tailwind CSS/PostCSS integration within the allocated time. The UI components (App.tsx contains basic structure) are incomplete and non-functional.

Schema Migration Workflow: A formal process for production database schema changes (e.g., zero-downtime migration strategy) is not detailed but would typically involve review, backup, phased rollout, and monitoring. Prisma Migrate handles the script generation and application.

