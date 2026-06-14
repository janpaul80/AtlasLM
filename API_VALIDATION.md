# AtlasLM API Endpoint Validation

Use this guide to verify each API endpoint works correctly before running browser tests.

## Prerequisites

- Backend running on `http://localhost:8000`
- Database running with test data
- PostMan, Insomnia, or `curl` available (or use browser DevTools Network tab)

---

## Health Check

### Endpoint: `/health`
```
GET http://localhost:8000/health
```

**Expected Response:**
```json
{
  "status": "ok"
}
```

**What to check:**
- [ ] Returns 200
- [ ] Response is JSON
- [ ] Status is "ok"

---

## Authentication Endpoints

### 1. Get User from Token

**Endpoint:** `GET /api/v1/users/me`

**Headers:**
```
Authorization: Bearer {YOUR_SUPABASE_JWT_TOKEN}
Content-Type: application/json
```

**Expected Response:**
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "created_at": "2024-01-01T00:00:00Z"
}
```

**What to check:**
- [ ] Returns 200 with auth token
- [ ] Returns 401 without auth token
- [ ] User ID matches Supabase user

---

## Workspace Endpoints

### 2. List Workspaces

**Endpoint:** `GET /api/v1/workspaces`

**Headers:**
```
Authorization: Bearer {TOKEN}
Content-Type: application/json
```

**Expected Response:**
```json
[
  {
    "id": "workspace-uuid",
    "user_id": "user-uuid",
    "name": "My Workspace",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

**What to check:**
- [ ] Returns 200 with valid auth
- [ ] Returns 401 without auth
- [ ] Returns only user's workspaces (not other users')
- [ ] Response is an array

### 3. Create Workspace

**Endpoint:** `POST /api/v1/workspaces`

**Headers:**
```
Authorization: Bearer {TOKEN}
Content-Type: application/json
```

**Body:**
```json
{
  "name": "Test Workspace"
}
```

**Expected Response:**
```json
{
  "id": "new-workspace-uuid",
  "user_id": "user-uuid",
  "name": "Test Workspace",
  "created_at": "2024-01-01T00:00:00Z"
}
```

**What to check:**
- [ ] Returns 201 (Created)
- [ ] Workspace ID is a valid UUID
- [ ] Workspace name matches request
- [ ] user_id matches authenticated user

### 4. Get Workspace

**Endpoint:** `GET /api/v1/workspaces/{workspace_id}`

**Headers:**
```
Authorization: Bearer {TOKEN}
Content-Type: application/json
```

**Expected Response:**
```json
{
  "id": "workspace-uuid",
  "user_id": "user-uuid",
  "name": "My Workspace",
  "created_at": "2024-01-01T00:00:00Z"
}
```

**What to check:**
- [ ] Returns 200 if workspace belongs to user
- [ ] Returns 403/404 if workspace belongs to different user

---

## Document Endpoints

### 5. List Documents in Workspace

**Endpoint:** `GET /api/v1/workspaces/{workspace_id}/documents`

**Headers:**
```
Authorization: Bearer {TOKEN}
Content-Type: application/json
```

**Expected Response:**
```json
[
  {
    "id": "doc-uuid",
    "workspace_id": "workspace-uuid",
    "name": "example.pdf",
    "file_type": "pdf",
    "file_size": 1024000,
    "status": "ready",
    "uploaded_at": "2024-01-01T00:00:00Z",
    "ingestion_started_at": "2024-01-01T00:00:01Z",
    "ingestion_completed_at": "2024-01-01T00:01:00Z"
  }
]
```

**What to check:**
- [ ] Returns 200
- [ ] Only returns documents from this workspace
- [ ] Status is one of: "pending", "processing", "ready", "failed"
- [ ] file_type is "pdf", "txt", or "md"

### 6. Upload Document

**Endpoint:** `POST /api/v1/workspaces/{workspace_id}/documents/upload`

**Headers:**
```
Authorization: Bearer {TOKEN}
Content-Type: multipart/form-data
```

**Body:**
```
file: <binary PDF file>
```

**Expected Response:**
```json
{
  "id": "doc-uuid",
  "workspace_id": "workspace-uuid",
  "name": "uploaded_file.pdf",
  "file_type": "pdf",
  "file_size": 2048000,
  "status": "processing",
  "uploaded_at": "2024-01-01T00:00:00Z"
}
```

**What to check:**
- [ ] Returns 201
- [ ] Document ID is UUID
- [ ] Status is "processing"
- [ ] File name preserved
- [ ] File size recorded

**Then wait and recheck:**
- [ ] After 5-30 seconds, GET documents again
- [ ] Document status should change to "ready"
- [ ] Chunks should be indexed (see endpoint #7)

### 7. Get Document Chunks

**Endpoint:** `GET /api/v1/documents/{document_id}/chunks`

**Headers:**
```
Authorization: Bearer {TOKEN}
Content-Type: application/json
```

**Expected Response:**
```json
[
  {
    "id": "chunk-uuid",
    "document_id": "doc-uuid",
    "page_number": 1,
    "chunk_index": 0,
    "content": "This is the text content of chunk 1...",
    "token_count": 150,
    "embedding_id": "embedding-uuid"
  },
  {
    "id": "chunk-uuid-2",
    "document_id": "doc-uuid",
    "page_number": 1,
    "chunk_index": 1,
    "content": "This is the text content of chunk 2...",
    "token_count": 200,
    "embedding_id": "embedding-uuid"
  }
]
```

**What to check:**
- [ ] Returns 200
- [ ] Returns array of chunks
- [ ] Each chunk has page_number
- [ ] Each chunk has content
- [ ] Chunks are in order (chunk_index increases)

---

## Session & Chat Endpoints

### 8. List Sessions in Workspace

**Endpoint:** `GET /api/v1/workspaces/{workspace_id}/sessions`

**Headers:**
```
Authorization: Bearer {TOKEN}
Content-Type: application/json
```

**Expected Response:**
```json
[
  {
    "id": "session-uuid",
    "workspace_id": "workspace-uuid",
    "user_id": "user-uuid",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

**What to check:**
- [ ] Returns 200
- [ ] Returns only sessions from this workspace
- [ ] Returns only user's sessions

### 9. Create Session

**Endpoint:** `POST /api/v1/workspaces/{workspace_id}/sessions`

**Headers:**
```
Authorization: Bearer {TOKEN}
Content-Type: application/json
```

**Body:**
```json
{}
```

**Expected Response:**
```json
{
  "id": "new-session-uuid",
  "workspace_id": "workspace-uuid",
  "user_id": "user-uuid",
  "created_at": "2024-01-01T00:00:00Z"
}
```

**What to check:**
- [ ] Returns 201
- [ ] Session ID is UUID
- [ ] user_id matches authenticated user

### 10. Get Session Messages

**Endpoint:** `GET /api/v1/sessions/{session_id}/messages`

**Headers:**
```
Authorization: Bearer {TOKEN}
Content-Type: application/json
```

**Expected Response:**
```json
[
  {
    "id": "msg-uuid",
    "session_id": "session-uuid",
    "user_id": "user-uuid",
    "role": "user",
    "content": "What is this document about?",
    "created_at": "2024-01-01T00:00:00Z"
  },
  {
    "id": "msg-uuid-2",
    "session_id": "session-uuid",
    "user_id": "user-uuid",
    "role": "assistant",
    "content": "The document is about [source_1] and [source_2]...",
    "citations": [
      {
        "source_id": 1,
        "document_id": "doc-uuid",
        "chunk_id": "chunk-uuid",
        "page_number": 1
      }
    ],
    "created_at": "2024-01-01T00:00:01Z"
  }
]
```

**What to check:**
- [ ] Returns 200
- [ ] Messages are in order (oldest first)
- [ ] Each message has role: "user" or "assistant"
- [ ] Assistant messages include citations array
- [ ] Citations have source_id, document_id, chunk_id, page_number

---

## Chat/Streaming Endpoint

### 11. Stream Chat Response

**Endpoint:** `POST /api/v1/sessions/{session_id}/chat`

**Headers:**
```
Authorization: Bearer {TOKEN}
Content-Type: application/json
```

**Body:**
```json
{
  "message": "What is the main topic of the documents?",
  "document_ids": ["doc-uuid"]
}
```

**Expected Response:** Server-Sent Events (SSE)

```
data: {"chunk":"The","type":"text_chunk","index":0}
data: {"chunk":" main","type":"text_chunk","index":1}
data: {"chunk":" topic","type":"text_chunk","index":2}
...
data: {"citations":[{"source_id":1,"document_id":"doc-uuid","chunk_id":"chunk-uuid","page_number":1}],"type":"citations"}
data: {"message_id":"msg-uuid","type":"complete"}
```

**What to check:**
- [ ] Returns 200 with Content-Type: text/event-stream
- [ ] Streams text chunks in real-time
- [ ] Each chunk has type: "text_chunk"
- [ ] Final message includes citations array
- [ ] Citations include source_id, document_id, chunk_id, page_number
- [ ] Stream ends with {"type":"complete"}

**Frontend code to test this:**
```javascript
const eventSource = new EventSource(
  'http://localhost:8000/api/v1/sessions/{SESSION_ID}/chat',
  {
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  }
);

eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  console.log('Chunk:', data);
  
  if (data.type === 'complete') {
    console.log('Stream complete!');
    eventSource.close();
  }
});

eventSource.onerror = (error) => {
  console.error('Stream error:', error);
  eventSource.close();
};
```

---

## Citation Endpoints

### 12. Get Citation Content

**Endpoint:** `GET /api/v1/citations/{document_id}/{chunk_id}`

**Headers:**
```
Authorization: Bearer {TOKEN}
Content-Type: application/json
```

**Expected Response:**
```json
{
  "document_id": "doc-uuid",
  "document_name": "example.pdf",
  "chunk_id": "chunk-uuid",
  "page_number": 3,
  "content": "This is the exact text from the PDF that was used as evidence..."
}
```

**What to check:**
- [ ] Returns 200
- [ ] Content matches what's shown in citation drawer
- [ ] Page number is accurate

---

## User Isolation Tests

### Test 1: User B Cannot Access User A's Workspace

**Setup:**
- User A JWT token
- User B JWT token
- User A workspace ID

**Test:**
```
GET /api/v1/workspaces/{USER_A_WORKSPACE_ID}
Authorization: Bearer {USER_B_JWT_TOKEN}
```

**Expected Response:**
```json
{
  "detail": "Not found"
}
```

**Status:** 404 or 403 (not 200)

**What to check:**
- [ ] Returns 404 or 403 (not 200)
- [ ] User B cannot access User A's workspace

### Test 2: User B Cannot Access User A's Documents

**Test:**
```
GET /api/v1/workspaces/{USER_A_WORKSPACE_ID}/documents
Authorization: Bearer {USER_B_JWT_TOKEN}
```

**Expected Response:** 404 or 403 (not 200)

**What to check:**
- [ ] Returns error
- [ ] User B cannot see User A's files

### Test 3: User B Cannot Access User A's Sessions

**Test:**
```
GET /api/v1/workspaces/{USER_A_WORKSPACE_ID}/sessions
Authorization: Bearer {USER_B_JWT_TOKEN}
```

**Expected Response:** 404 or 403 (not 200)

**What to check:**
- [ ] Returns error
- [ ] User B cannot access User A's chat history

### Test 4: Unauthenticated Access Blocked

**Test:**
```
GET /api/v1/workspaces
(no Authorization header)
```

**Expected Response:**
```json
{
  "detail": "Not authenticated"
}
```

**Status:** 401

**What to check:**
- [ ] Returns 401
- [ ] No auth → no access

---

## Ingestion Pipeline Validation

### Check 1: Document Status Progression

1. Upload document → status should be "processing"
2. Wait 10-30 seconds
3. Recheck → status should be "ready"

**Expected progression:**
- `processing` (file accepted, chunking started)
- → `ready` (chunks indexed, embeddings generated)

**What to check:**
- [ ] Status changes to "ready"
- [ ] Chunks are created and indexed
- [ ] Embeddings are stored in pgvector

**Backend check:**
```bash
docker exec atlaslm-db-1 psql -U atlas_user -d atlas_db << 'EOF'
-- Check chunks were created
SELECT COUNT(*) as chunk_count FROM chunks WHERE document_id = '{DOCUMENT_ID}';

-- Check embeddings were generated
SELECT COUNT(*) as embedding_count FROM embeddings WHERE document_id = '{DOCUMENT_ID}';

-- Check one chunk
SELECT id, page_number, content FROM chunks 
WHERE document_id = '{DOCUMENT_ID}' 
LIMIT 1;
EOF
```

---

## Quick Test Checklist

Run these in order:

- [ ] Health check returns 200
- [ ] Get user (/me) returns current user
- [ ] Create workspace returns 201
- [ ] List workspaces returns created workspace
- [ ] Upload document returns 201 with status "processing"
- [ ] Wait 30 seconds
- [ ] List documents returns status "ready"
- [ ] Get chunks returns chunk data
- [ ] Create session returns 201
- [ ] Stream chat returns SSE with chunks and citations
- [ ] Get session messages returns all messages with citations
- [ ] User isolation test: User B cannot access User A workspace (403/404)

If all pass: Backend is ready for browser testing.

---

## Tools for Testing

### Using Postman/Insomnia

1. Create collection: "AtlasLM API Tests"
2. Add environment variables:
   - `base_url`: http://localhost:8000
   - `token`: {YOUR_SUPABASE_JWT}
   - `workspace_id`: {CREATED_WORKSPACE_ID}
   - `document_id`: {UPLOADED_DOCUMENT_ID}
   - `session_id`: {CREATED_SESSION_ID}
3. Create folder structure matching endpoints
4. Test each endpoint with pre/post-request scripts

### Using Browser Console

```javascript
// Store credentials
const BASE_URL = 'http://localhost:8000';
const TOKEN = localStorage.getItem('supabase.auth.token');

// Helper function
async function apiCall(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  if (body) options.body = JSON.stringify(body);
  
  const response = await fetch(`${BASE_URL}${path}`, options);
  return { status: response.status, data: await response.json() };
}

// Test endpoints
await apiCall('GET', '/health');
await apiCall('GET', '/api/v1/users/me');
await apiCall('GET', '/api/v1/workspaces');
```

### Using cURL

```bash
# Health check
curl http://localhost:8000/health

# Get user (requires token)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/users/me

# Create workspace
curl -X POST http://localhost:8000/api/v1/workspaces \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test"}'
```

---

## Troubleshooting API Issues

### Issue: All requests return 401

**Possible causes:**
- JWT token expired
- Supabase credentials invalid
- Token not in Authorization header

**Fix:**
- Log out and log back in
- Get new token from localStorage: `localStorage.getItem('supabase.auth.token')`
- Use Bearer prefix: `Authorization: Bearer {token}`

### Issue: Upload succeeds but document status stays "processing"

**Possible causes:**
- Ingestion pipeline crashed
- LLM provider not working
- Database not initialized

**Fix:**
```bash
docker logs atlaslm-backend-1 | grep -i "ingest\|error\|fail"
```

### Issue: Streaming returns empty chunks

**Possible causes:**
- No documents provided in request
- Vector search returned no results
- LLM not configured

**Fix:**
- Verify document_ids in chat request
- Check backend logs for vector search
- Verify LLM provider credentials

---

## Success Criteria

All of these must pass before browser testing:

1. ✓ Health endpoint responds
2. ✓ Authentication endpoints work
3. ✓ Workspace CRUD works
4. ✓ Document upload works
5. ✓ Document status progresses to "ready"
6. ✓ Chunks are indexed
7. ✓ Chat streaming returns chunks
8. ✓ Citations are included in response
9. ✓ Session messages include citations
10. ✓ User isolation blocks cross-user access

If any fail, check backend logs and fix before proceeding.
