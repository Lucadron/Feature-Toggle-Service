
# Feature Toggle Service
📖 [Türkçe olarak görüntüle (README.tr.md)](README.tr.md)

## Overview

This project is a comprehensive, multi-tenant Feature Toggle Service. It allows multiple tenants to manage and retrieve feature flags based on different environments (dev, staging, prod) via a REST API.

The service is built with a production-ready mindset, including JWT authentication, Redis caching for high performance, per-tenant rate limiting, detailed audit logging, and a functional React-based admin UI.

## Core Features

* **Multi-Tenant & Environment-Based:** Feature flags are scoped per tenant and environment (`dev`, `staging`, `prod`).
* **Secure REST API:** Exposes a full suite of endpoints for managing the service:
    * `POST /auth/token`: Authenticates a tenant using `apiKey` and `apiSecret` to issue a JWT.
    * `GET /features`: Retrieves evaluated feature flags for a tenant/env. Supports pagination, filtering by name, and results are cached in Redis.
    * `POST /features`: Creates or updates (upsert) a feature flag. Invalidates the cache and creates an audit log.
    * `DELETE /features/{id}`: Deletes a specific feature flag instance by its ID. Invalidates cache and logs the change.
    * `GET /audit`: Retrieves paginated audit logs for the authenticated tenant.
    * `POST /promote`: Promotes all flags from one environment (e.g., staging) to another (e.g., prod) in a single transaction.
* **Authentication:** Uses JWT (JSON Web Tokens) for securing all API endpoints (except `/auth/token` and `/health`).
* **Caching:** Implements a Redis caching layer for `GET /features` to ensure fast reads. Cache is automatically invalidated on any write operation (`POST`, `DELETE`, `PROMOTE`).
* **Evaluation Strategies:** Supports `BOOLEAN` and `PERCENTAGE` rollout strategies, applied in real-time on `GET /features` requests.
* **Audit Logging:** Logs all C/U/D and promotion actions to an `audit_logs` table, including actor, timestamp, and a JSON diff of changes.
* **Rate Limiting:** Implements Redis-backed, per-tenant rate limiting on all secured endpoints to prevent abuse.
* **Observability:** Exposes a `/metrics` endpoint with Prometheus-compatible counters for HTTP requests and feature flag evaluations.
* **API Documentation:** Provides interactive API documentation using **Swagger UI**, accessible at `/api-docs`.
* **Frontend Admin UI:** A complete, functional single-page admin panel built with React, TypeScript, and Tailwind CSS. The UI allows users to:
    * Authenticate using a JWT.
    * Select an environment.
    * View all feature flags for that environment (paginated).
    * Toggle flags on or off.
    * Create new feature flags.
    * Delete feature flags.

## Tech Stack

| Domain | Technology | Purpose |
| :--- | :--- | :--- |
| **Backend** | Node.js, Express.js | Server runtime and framework |
| | TypeScript | Type safety and modern JavaScript |
| **Database** | PostgreSQL | Primary data persistence |
| **ORM** | Prisma | Database access, schema management, and migrations |
| **Caching** | Redis | Caching `GET /features` responses |
| **Rate Limiting** | Redis | Storing rate limit counters (via `rate-limit-redis`) |
| **Auth** | JWT (jsonwebtoken), bcrypt | Token generation/validation and password hashing |
| **API Docs** | Swagger (swagger-jsdoc, swagger-ui-express) | Interactive API documentation |
| **Observability** | Prometheus (prom-client) | Exposing metrics at `/metrics` |
| **Testing** | Jest, Supertest | Integration testing for API endpoints |
| **Containerization** | Docker, Docker Compose | Running ancillary services (Postgres, Redis) |
| **Frontend** | React, Vite | UI library and build tooling |
| | TypeScript | Type safety for the frontend |
| | Tailwind CSS | Utility-first CSS framework for rapid styling |
| | Axios | HTTP client for communicating with the backend |

## Project Structure

This repository is structured as a monorepo, containing both the backend service and the frontend UI in the same repository.

* `/` (Root): The backend Node.js/Express service.
* `/feature-toggle-service-ui`: The frontend React/Vite application.

## Setup & Running

**Prerequisites:**
* Node.js (v18.x or v20.x recommended)
* npm (v8.x or later)
* Docker & Docker Compose

### 1. Backend Setup (Main Service)

1.  **Navigate to the backend directory** (the root of this repository):
    ```bash
    cd feature-toggle-service
    ```
2.  **Install backend dependencies:**
    ```bash
    npm install
    ```
3.  **Set up Environment Variables:**
    * Create a `.env` file (you can copy `.env.example` if it exists).
    * Ensure `DATABASE_URL` matches the Docker setup and add a `JWT_SECRET`.
    * *Example `.env`:*
        ```env
        DATABASE_URL="postgresql://zebra:password@localhost:5432/feature_toggles?schema=public"
        JWT_SECRET="YOUR_SUPER_SECRET_KEY_HERE"
        CACHE_TTL=60
        ```
4.  **Start Docker Services (Postgres & Redis):**
    ```bash
    npm run db:up
    # Wait for containers to be healthy (check with 'docker ps')
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
    # Backend server will be running on http://localhost:3000
    ```

### 2. Frontend Setup (UI)

1.  **Open a new terminal.**
2.  **Navigate to the frontend directory:**
    ```bash
    cd feature-toggle-service-ui
    ```
3.  **Install frontend dependencies:**
    ```bash
    npm install
    ```
4.  **Start the Frontend Server (Development Mode):**
    ```bash
    npm run dev
    # Frontend UI will be running on http://localhost:5173 (or similar)
    ```

### 3. Accessing the Application

* **API Service:** `http://localhost:3000`
* **API Docs:** `http://localhost:3000/api-docs`
* **Metrics:** `http://localhost:3000/metrics`
* **Admin UI:** `http://localhost:5173`

To use the UI, first get a token from the API (`/auth/token` endpoint via Swagger/Postman, using `apiKey: "zebra_api_key"` and `apiSecret: "zebra_secret_123"`) and paste it into the UI's login field.

## Running Tests

To run the backend integration tests:

```bash
# From the root (backend) directory
npm test
