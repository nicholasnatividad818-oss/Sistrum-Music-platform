# Sistrum Music Platform

Sistrum is a modern music platform built with React, Vite, TypeScript, and a lightweight Express server. It provides a streaming-inspired UI with catalog browsing, artist and profile surfaces, and a containerized production setup.

## Features

- Music catalog and discovery experience
- Responsive frontend built with React + Vite
- Type-safe app logic with TypeScript
- Backend and API support via Express
- Supabase and Google GenAI integration points
- Production-ready Docker build
- CI checks and automated validation

## Tech Stack

- Frontend: React, Vite, Tailwind CSS
- Runtime: TypeScript, Node.js
- Server: Express
- Data / App Services: Supabase, Google GenAI
- Containerization: Docker
- Quality gates: TypeScript checks, tests, production build

## Prerequisites

Before running the app locally, make sure you have:

- Node.js 22+
- npm
- Docker (for container builds)

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The app runs on port 3000 by default.

## Available Scripts

```bash
npm run dev
npm run build
npm run preview
npm run test
npm run check
npm run lint
```

### Script breakdown

- `npm run dev` — start the Vite dev server
- `npm run build` — production build
- `npm run preview` — preview the production bundle
- `npm run test` — run the automated test suite
- `npm run check` — lint, test, and build the app
- `npm run lint` — TypeScript compile check without emitting files

## Docker

Build the production container:

```bash
docker build -t sistrum .
```

Run the container:

```bash
docker run -p 8080:8080 sistrum
```

Then open:

```text
http://localhost:8080
```

## CI / Validation

This repository includes a GitHub Actions workflow that:

- installs dependencies
- runs the quality check suite
- builds the app
- validates the application health and key routes inside the Docker container

## Project Notes

The app is structured as a frontend-heavy music platform with supporting server-side and integration layers. It is intended to be run locally for development and in a container for deployment-style verification.

## Contributing

Contributions are welcome. Open a pull request with a clear summary of the change and validation performed.

## License

This project does not currently declare a license in the repository metadata. If you intend to distribute or publish it, add an appropriate open-source license before release.
