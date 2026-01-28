# T-Absensi Edge Functions

## Overview

This folder contains Supabase Edge Functions for secure server-side operations.

## Functions

### 1. `clock-in`
Handles employee clock-in with:
- User authentication verification
- Duplicate attendance prevention (one per day)
- Late detection based on system settings
- Server-side timestamp generation
- Geolocation validation (optional)
- Audit logging

### 2. `clock-out`
Handles employee clock-out with:
- User authentication verification
- Clock-in existence validation
- Early leave detection
- Automatic work hours calculation
- Audit logging

### 3. `create-employee`
Creates new employee accounts with profiles and roles.

### 4. `reset-password`
Handles password reset requests.

### 5. `list-employees`
Lists all employees (admin only).

### 6. `export-database`
Exports database data (admin only).

## Deployment

### Prerequisites
1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref qfpbrislzyjrjyknsqmy
   ```

### Deploy All Functions
```bash
supabase functions deploy --no-verify-jwt
```

### Deploy Individual Function
```bash
supabase functions deploy clock-in --no-verify-jwt
supabase functions deploy clock-out --no-verify-jwt
```

### Environment Variables
Ensure these secrets are set in your Supabase project:
- `SUPABASE_URL` (auto-set)
- `SUPABASE_ANON_KEY` (auto-set)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-set)

## Testing

### Test Clock-In
```bash
curl -X POST 'https://qfpbrislzyjrjyknsqmy.supabase.co/functions/v1/clock-in' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"location": "-6.175392, 106.827153", "latitude": -6.175392, "longitude": 106.827153}'
```

### Test Clock-Out
```bash
curl -X POST 'https://qfpbrislzyjrjyknsqmy.supabase.co/functions/v1/clock-out' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"location": "-6.175392, 106.827153", "latitude": -6.175392, "longitude": 106.827153}'
```

## Error Handling

### Clock-In Errors
- `401`: Unauthorized (no/invalid JWT)
- `409`: Duplicate attendance (already clocked in today)
- `403`: Outside allowed location radius
- `500`: Server error

### Clock-Out Errors
- `401`: Unauthorized (no/invalid JWT)
- `400`: No clock-in record for today
- `409`: Already clocked out
- `500`: Server error
