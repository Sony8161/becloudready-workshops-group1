# Notice Board Tracker – Frontend

React + TypeScript + Vite, React Router, Tailwind CSS v4.

## Getting started

```bash
cp .env.example .env
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

On Windows PowerShell with a restricted execution policy, use `npm.cmd` instead of `npm`.

## Environment

| Variable             | Description                                                        |
| -------------------- | ------------------------------------------------------------------ |
| `VITE_API_URL`       | Base URL of the backend API (Passport + JWT), e.g. `http://localhost:3000/api` |
| `VITE_USE_MOCK_AUTH` | `true` (default) uses the in-browser mock auth; `false` calls the backend |

## Authentication

`src/services/authService.ts` expects the backend to expose:

- `POST /auth/login` – body `{ email, password }`, returns `{ token, user }`
- `GET /auth/me` – `Authorization: Bearer <token>`, returns `user`

`user` is `{ id, name, email, role }` where `role` is `admin | hr | manager | trainee`.

### Mock users (development only)

All passwords are `password123`.

| Role             | Email                     |
| ---------------- | ------------------------- |
| Admin            | admin@noticeboard.dev     |
| HR / People Team | hr@noticeboard.dev        |
| Training Manager | manager@noticeboard.dev   |
| Trainee          | trainee@noticeboard.dev   |

## Structure

```
src/
  components/   route guards, shared UI
  config/       role-based navigation
  context/      AuthProvider
  hooks/        useAuth
  layouts/      AuthLayout (login), AppLayout (header + sidebar)
  mocks/        mock auth service
  pages/        Login, Home, 404/403
  services/     fetch wrapper, auth service
  types/        shared types
  router.tsx    route definitions
```

Protect a route by role with `<ProtectedRoute allowedRoles={['admin', 'hr']} />`, and add its link to `src/config/navigation.ts`.
