# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

```
AI-EDU-V3/
  edulens-backend/services/
    auth-service/          # Node.js — register, login, student CRUD
    test-engine/           # Node.js — test sessions, scoring, insights
    conversation-engine/   # Node.js — parent & student chat (Bedrock streaming)
    profile-engine/        # Python — error pattern analysis (SQLAlchemy)
    background-jobs/       # Node.js — summarization & insights workers (SQS)
    admin-service/         # Node.js — admin APIs (questions, config, metrics)
    stage-registry/        # Node.js — stage management + student activation
    contest-service/       # Node.js — contests CRUD + registration + results
  edulens-frontend/        # Next.js 14 app router
  edulens-infrastructure/  # AWS CDK (TypeScript)
```

## Key Architecture Decisions

### Database Access
- **Node.js services**: use `postgres` (postgres.js) — NOT Prisma (migration complete).
  - `query()` helper in `src/lib/database.ts` wraps `db.unsafe(sql, [params])`.
  - IMPORTANT: `db.unsafe(sql, param)` is wrong — params must be an array: `db.unsafe(sql, [param])`. Always use the `query()` helper instead.
- **Python services**: SQLAlchemy 2.0 with lazy init via Secrets Manager (`DB_SECRET_ARN` env var).
  - Connection module: `profile-engine/src/database/connection.py`

### DB Schema (canonical — canonical PostgreSQL, not ORM-generated)
Key tables: `users`, `students`, `test_sessions`, `session_responses`, `questions`, `tests`, `stages`, `student_stages`, `student_profiles`, `profile_snapshots`, `contest_series`, `contests`, `contest_registrations`, `contest_results`

Column name gotchas (use these exact names):
- `test_sessions`: `scaled_score`, `question_count`, `stage_id`, `total_items`, `correct_count`, `status='active'` (not `'in_progress'`)
- `questions`: `type` (not `question_type`), `estimated_time` (not `estimated_time_seconds`), `correct_answer`
- `session_responses`: no `correct_answer` column (it's in `questions`), no `answered_at` column
- `contests`: `window_start_at`, `window_end_at`, `title` (not `scheduled_start/end`, `name`)
- `contest_series`: `title` (not `name`)

### Lambda Deployment
- **Node.js Lambdas**: CDK uses `NodejsLambda` construct → esbuild bundles per entrypoint. `tsc` errors in unused files (e.g. `session-manager.ts`) do NOT block deployment.
- **Python Lambdas** (profile-engine): manually packaged — `pip install` to `/tmp/profile-light-pkg`, then zip and upload via `aws lambda update-function-code`.
  - Use `requirements-light.txt` (no numpy/scipy — exceeds 250 MB limit).
  - Rebuild command: see "Deploying Python Lambdas" below.

### Stage-based vs Test-based Sessions
- Stage sessions: `test_id = NULL`, `stage_id = 'oc_prep'` (or other stage)
- Test sessions: `test_id = <uuid>`, `stage_id = NULL`
- `student-insights` skips stage sessions (`WHERE test_id IS NOT NULL`)

### Infrastructure Stack Order
Defined in `edulens-infrastructure/bin/app.ts`:
1. NetworkStack, DatabaseStack
2. JobsStack (SQS queues, EventBridge — no Lambda deps)
3. ApiGatewayStack, AlbStack (skeleton)
4. LambdaStack (wired to network, DB, jobs via constructed ARN strings)
5. Routes + target groups wired post-creation
6. MonitoringStack

Cyclic dependency fix: queue/rule ARNs passed as constructed strings, NOT CFN tokens.

## Common Commands

### Backend (Node.js service)
```bash
cd edulens-backend/services/<service-name>
npm install
npm run build           # esbuild or tsc — check package.json
```

### Frontend
```bash
cd edulens-frontend
npm install
npm run dev             # localhost:3000
npm run build
```

### Infrastructure (CDK)
```bash
cd edulens-infrastructure
npm install
npx cdk diff --profile <profile>
npx cdk deploy --all --profile <profile>
```

### Deploying a single Node.js Lambda (without full CDK deploy)
```bash
cd edulens-backend/services/test-engine
npx esbuild src/handlers/<handler>.ts \
  --bundle --platform=node --target=node20 --outfile=/tmp/<handler>.js \
  --external:@aws-sdk/*
cd /tmp && python3 -c "import zipfile; zf=zipfile.ZipFile('<handler>.zip','w',zipfile.ZIP_DEFLATED); zf.write('<handler>.js','index.js'); zf.close()"
aws lambda update-function-code --function-name edulens-<name>-dev \
  --zip-file fileb:///tmp/<handler>.zip --region us-west-2
aws lambda wait function-updated --function-name edulens-<name>-dev --region us-west-2
```

### Deploying Python Lambdas (profile-engine)
```bash
rm -rf /tmp/profile-light-pkg && mkdir -p /tmp/profile-light-pkg
pip3 install sqlalchemy psycopg2-binary "pydantic>=1.10.0,<2.0.0" boto3 \
  -t /tmp/profile-light-pkg --quiet --platform manylinux2014_x86_64 --only-binary=:all:
cp -r edulens-backend/services/profile-engine/src /tmp/profile-light-pkg/src
cd /tmp/profile-light-pkg && python3 -c "
import zipfile, os
with zipfile.ZipFile('/tmp/profile-light.zip','w',zipfile.ZIP_DEFLATED) as zf:
    for root,dirs,files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in ['__pycache__','.git']]
        for f in files:
            if f.endswith('.pyc'): continue
            fp = os.path.join(root,f); zf.write(fp, os.path.relpath(fp,'.'))
"
aws lambda update-function-code --function-name edulens-error-patterns-aggregate-dev \
  --zip-file fileb:///tmp/profile-light.zip --region us-west-2
aws lambda update-function-code --function-name edulens-error-patterns-trends-dev \
  --zip-file fileb:///tmp/profile-light.zip --region us-west-2
```

### DB Migration Lambda (edulens-db-migrate-dev)
One-off DB DDL/queries via invoke:
```bash
aws lambda invoke --function-name edulens-db-migrate-dev --region us-west-2 \
  --payload '{"sql":"SELECT ..."}' /tmp/out.json --cli-binary-format raw-in-base64-out
cat /tmp/out.json
```

## API Details

- **Base URL**: `https://npwg8my4w5.execute-api.us-west-2.amazonaws.com/dev`
- **Auth**: JWT Bearer token from `POST /auth/login` (`email` + `password` body)
- **Admin endpoints** (`/admin/*`): require `x-api-key: 4ufbnf9yed7pNhTasnVpK64zCVgqACQp6AqMdQkI` header
- **Session routes**: `/sessions` (not `/test-sessions`)

## Known Limitations / Pending

- `calculate_profile` Lambda needs numpy/scipy — will exceed 250 MB Lambda limit. Needs Lambda Layer or container image.
- `student_profiles` and `profile_snapshots` tables are NOT in `fix-schema.js` — they were created separately. If DB is re-initialized, run the CREATE TABLE statements manually or add them to the migration script.
- `edulens-admin-system-metrics-dev` and `/admin/config` may have IAM/Secrets Manager permission issues.
