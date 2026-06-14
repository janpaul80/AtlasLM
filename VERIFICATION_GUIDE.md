# AtlasLM: End-to-End Browser Verification Guide

**Mission:** Verify the complete AtlasLM workflow works reliably in a real browser.

**Timeline:** ~2-3 hours including documentation

**Success Criteria:** All tests pass, user isolation verified, citations persist across refresh.

---

## Documents in This Test Suite

1. **BROWSER_WORKFLOW_TEST.md** — Step-by-step manual browser tests
2. **API_VALIDATION.md** — API endpoint verification guide
3. **test_atlaslm.py** — Automated backend test suite
4. **THIS FILE** — Coordination guide

---

## Quick Start

### Prerequisites

- Backend running: `docker-compose up -d --build`
- Frontend running: `npm run dev` (from `frontend/` folder)
- Browser: Chrome, Firefox, or Safari
- Test PDF: Any real PDF you want to test with

### Step 1: Verify Backend (10 minutes)

```bash
# Option A: Run automated test suite
python3 test_atlaslm.py --token YOUR_JWT_TOKEN --pdf /path/to/test.pdf

# Option B: Manual API testing
# Follow API_VALIDATION.md section by section
```

**Expected outcome:** All endpoints respond, ingestion works, citations generated.

### Step 2: Manual Browser Test (30-45 minutes)

Follow **BROWSER_WORKFLOW_TEST.md** sections in order:

1. Phase 1: Authentication (5 min)
2. Phase 2: Workspace & Documents (10 min)
3. Phase 3: Semantic Search & Streaming (10 min)
4. Phase 4: Citation System (10 min)
5. Phase 5: Session Persistence (5 min)
6. Phase 6: Logout & Access Control (5 min)

### Step 3: User Isolation Test (20-30 minutes)

**Critical security test** — Follow BROWSER_WORKFLOW_TEST.md Phase 7:

1. Create User A account
2. User A creates workspace + uploads document
3. Create User B account (separate browser)
4. Verify User B cannot:
   - See User A's workspace
   - Access User A's documents via API
   - View User A's chat history
5. Verify User A cannot see User B's data

---

## Test Coverage

### Phase 1: Authentication ✓

| Test | Expected | What to Check |
|------|----------|---------------|
| Login | 200 + redirected | Email/password form works |
| Create account | 201 + session | Sign-up succeeds |
| Session persistence | User remains logged in | Page refresh keeps session |
| Logout | Redirected to login | Logout clears session |
| Protected routes | 401 redirect | Cannot access dashboard without auth |

### Phase 2: Workspace & Documents ✓

| Test | Expected | What to Check |
|------|----------|---------------|
| Create workspace | 201 + sidebar update | Workspace appears in list |
| Upload PDF | 201 + status "processing" | File accepted |
| Ingestion complete | Status → "ready" | After 5-30s, document ready |
| Chunks indexed | 200 + chunks array | Chunks created with page numbers |
| View documents | 200 + doc list | Documents visible in sidebar |

### Phase 3: Semantic Search & Streaming ✓

| Test | Expected | What to Check |
|------|----------|---------------|
| Ask question | 200 + streaming chunks | Answer appears word-by-word |
| Response quality | Grounded answer | Answer relates to PDF content |
| Stream completes | Full response + no errors | Answer finishes properly |
| Multiple questions | New messages added | Can ask follow-up questions |

### Phase 4: Citation System ✓

| Test | Expected | What to Check |
|------|----------|---------------|
| Citation tags | [source_1], [source_2], etc. | Tags appear in response |
| Citation pills | Clickable badges | Tags render as styled pills |
| Citation drawer | Modal with file/page/content | Clicking opens drawer |
| Filename correct | Actual PDF filename | "example.pdf" (not generic) |
| Page number | Accurate (e.g., "Page 3 of 10") | Correct page displayed |
| Chunk content | Actual text from PDF | Content matches document |
| Multiple citations | Different chunks for different sources | Each citation shows different content |

### Phase 5: Session Persistence ✓

| Test | Expected | What to Check |
|------|----------|---------------|
| Refresh page | Everything restored | All data visible after F5 |
| Workspace persists | Same workspace selected | localStorage has workspace ID |
| Session persists | Same session selected | localStorage has session ID |
| Messages visible | All chat history visible | Previous messages shown |
| Citations work | Can still click citations | Citation drawer still functional |
| localStorage keys | Two keys present | selectedWorkspaceId, selectedSessionId |

### Phase 6: Logout & Access Control ✓

| Test | Expected | What to Check |
|------|----------|---------------|
| Logout button | Visible in menu | User menu has logout option |
| Logout works | Redirected to login | Session cleared |
| Dashboard blocked | 401 or redirected | Cannot access after logout |
| API protected | 401 response | Direct API calls fail without auth |
| Token required | Bearer in header | Authorization enforced |

### Phase 7: User Isolation ✓ **CRITICAL**

| Test | Expected | What to Check |
|------|----------|---------------|
| User A workspace | User A can see it | Workspace in sidebar |
| User A documents | User A can see them | Documents in list |
| User B login | Separate session | New browser/profile |
| User B workspace view | Empty or own only | User A workspace NOT visible |
| User B API access | 403/404 on User A workspace | Cannot fetch User A data |
| User B document view | Empty or own only | User A documents NOT visible |
| User B create content | Works | User B workspace created |
| User A sees User B? | NO | User A cannot see User B |

---

## Test Report Template

Use this template to document results:

```markdown
# AtlasLM Browser Verification Test Report

**Date:** [DATE]
**Tester:** [YOUR_NAME]
**Environment:** Local (localhost:3000, localhost:8000)
**Duration:** [TIME SPENT]

## Test Results

### Phase 1: Authentication
- [ ] Login successful
- [ ] Account creation working
- [ ] Session persists on page reload
- [ ] Logout works
- [ ] Protected routes blocked after logout

**Notes:** [Any observations]

### Phase 2: Workspace & Documents
- [ ] Workspace creation working
- [ ] PDF upload successful
- [ ] Ingestion progresses (processing → ready)
- [ ] Chunks indexed with page numbers
- [ ] Document list shows uploaded files

**Notes:** [Any observations]

### Phase 3: Semantic Search & Streaming
- [ ] Question submitted successfully
- [ ] Answer streams in real-time
- [ ] Answer content is grounded in PDF
- [ ] Multiple questions work in same session

**Notes:** [Any observations]

### Phase 4: Citation System
- [ ] Citation tags visible ([source_1], [source_2])
- [ ] Citation pills styled correctly
- [ ] Citation drawer opens on click
- [ ] Filename displayed correctly
- [ ] Page number displayed correctly
- [ ] Chunk content is accurate
- [ ] Multiple citations show different content

**Notes:** [Any observations]

### Phase 5: Session Persistence
- [ ] Workspace selection persisted after refresh
- [ ] Session selection persisted after refresh
- [ ] Chat messages visible after refresh
- [ ] Citations still clickable after refresh
- [ ] localStorage contains workspace/session IDs

**Notes:** [Any observations]

### Phase 6: Logout & Access Control
- [ ] Logout button visible and functional
- [ ] Redirected to login after logout
- [ ] Dashboard returns 401 after logout
- [ ] API calls blocked without token

**Notes:** [Any observations]

### Phase 7: User Isolation (CRITICAL)
- [ ] User A workspace created
- [ ] User A document uploaded
- [ ] User B created in separate session
- [ ] User B cannot see User A workspace
- [ ] User B API call to User A workspace: 403/404
- [ ] User B cannot see User A documents
- [ ] User B can create own workspace
- [ ] User A cannot see User B workspace

**Notes:** [Any observations]

## Critical Findings

**Blockers (stop):**
- [ ] None found

**Major issues (fix before production):**
- [ ] None found

**Minor issues (nice to fix):**
- [ ] None found

## Evidence

Screenshots stored in: `BROWSER_WORKFLOW_TEST_EVIDENCE/`

- [x] Login page
- [x] Dashboard loaded
- [x] Workspace created
- [x] PDF uploading
- [x] PDF ready
- [x] Question asked
- [x] Answer streaming
- [x] Citation pills
- [x] Citation drawer
- [x] After refresh
- [x] Logout success
- [x] User A/B isolation

## Sign-Off

**Date Verified:** [DATE]

**Result:** ✓ PASSED / ✗ FAILED

**Verified by:** [YOUR_NAME]

**Comments:** [Final assessment]

---

## Recommended Next Steps

1. ✓ Workflow verified in browser
2. [ ] Real PDF multi-page testing (extended)
3. [ ] Dashboard UI polish
4. [ ] Provider fallback testing
5. [ ] Performance optimization
6. [ ] Mobile app development
7. [ ] Production deployment

---
```

---

## Troubleshooting Guide

### Login Issues

**Symptom:** Login fails or redirects incorrectly

**Checks:**
1. Verify Supabase project is active: `frontend/.env.local`
2. Check backend can verify JWT: `API_VALIDATION.md → Get User`
3. Browser console for error messages
4. Backend logs: `docker logs atlaslm-backend-1 | grep -i auth`

**Fix:**
- Recreate `.env.local` from `.env.example`
- Verify Supabase credentials are correct
- Check CORS settings on backend

### Upload Issues

**Symptom:** PDF upload fails or doesn't progress

**Checks:**
1. File size < 50MB
2. File format is PDF/TXT/MD
3. Backend logs: `docker logs atlaslm-backend-1 | grep -i upload`
4. Database has file: `docker exec atlaslm-db-1 psql -U atlas_user -d atlas_db -c "SELECT count(*) FROM documents;"`

**Fix:**
- Check error message in UI
- Try different PDF
- Check backend ingestion pipeline

### Citation Missing

**Symptom:** Answer streams but no [source_N] tags

**Checks:**
1. Document is marked "ready" (not still processing)
2. Chunks were created: `API_VALIDATION.md → Get Chunks`
3. Vector search working: `docker logs atlaslm-backend-1 | grep -i embed`
4. LLM provider credentials set

**Fix:**
- Wait for ingestion to complete
- Verify embeddings were generated
- Check LLM provider is accessible

### Persistence Issues

**Symptom:** Page refresh loses workspace/session

**Checks:**
1. Browser DevTools → Application → Local Storage
2. Should see `selectedWorkspaceId` and `selectedSessionId`
3. frontend/app/dashboard/page.tsx should have localStorage code

**Fix:**
- Clear localStorage and try again
- Check dashboard component has restoration logic
- Verify API returns workspace/session list on mount

### User Isolation Fails

**Symptom:** User B can see User A data

**Checks:**
1. Both using different browser profiles/incognito
2. Different Supabase tokens
3. Backend middleware enforcing auth: `backend/app/middleware/auth_middleware.py`
4. Database queries filtering by user_id

**Fix:**
- Verify database migrations added user_id to all tables
- Check all API endpoints filter by `current_user.id`
- Verify JWT validation in middleware

---

## Full Workflow Example

### User A Setup

```
1. Open http://localhost:3000/login (Browser 1)
2. Click "Sign Up"
3. Enter: testuser.a@example.com, TestPassword123!
4. Dashboard loads
5. Left sidebar: Click "New Notebook"
6. Type name: "Test Notebook A"
7. Click Create
8. Right panel: Upload PDF
9. Select ~/Documents/example.pdf
10. Wait for status to change to "ready" (takes 10-30s)
11. Chat input: "What is this document about?"
12. Send
13. Watch answer stream with [source_1], [source_2] tags
14. Click [source_1] pill
15. Drawer opens showing filename, page, content
16. Press F5 (refresh)
17. Everything still there!
```

### User B Setup (Same Machine, Different Browser)

```
1. Open http://localhost:3000/login (Incognito Window or Different Browser)
2. Click "Sign Up"
3. Enter: testuser.b@example.com, TestPassword456!
4. Dashboard loads
5. Left sidebar: Should be EMPTY (or show only User B data)
6. User A's "Test Notebook A" is NOT visible
7. DevTools Console:
   fetch('/api/v1/workspaces/{USER_A_WORKSPACE_ID}', {
     headers: {'Authorization': `Bearer ${localStorage.supabase.auth.token}`}
   })
   .then(r => r.json())
   .then(d => console.log(d))
8. Should return 404 or 403 (not User A's data)
```

---

## Success Definition

All of these must be true:

1. ✓ User can log in
2. ✓ User can create workspace
3. ✓ User can upload PDF
4. ✓ PDF ingestion completes (status: ready)
5. ✓ User can ask questions
6. ✓ Answers stream with [source_N] tags
7. ✓ Clicking citations shows file/page/content
8. ✓ Page refresh keeps workspace/session/messages
9. ✓ Logout blocks access
10. ✓ **User B cannot see User A data** ← CRITICAL

If all 10 pass: **AtlasLM core workflow is production-ready.**

---

## Next Phase

Once browser verification passes:

### Phase 3: Product Hardening

1. **Extended PDF Testing**
   - Multi-page PDFs (50+ pages)
   - Different PDF formats
   - Large documents (20MB+)
   - Verify page numbers accurate

2. **Dashboard Polish**
   - Loading states
   - Empty states
   - Error messages
   - Citation drawer UX

3. **Provider Management**
   - Test OpenRouter fallback
   - Test Blackbox fallback
   - Test Ollama local
   - Error handling per provider

4. **Performance**
   - Ingestion speed on large files
   - Search latency
   - Streaming performance
   - Concurrent user load

### Phase 4: Mobile & Scaling

1. iOS app
2. Android app
3. Production deployment
4. Billing integration

---

## Support

If any test fails:

1. **Document the error** (screenshot, console, network tab)
2. **Check backend logs:** `docker logs -f atlaslm-backend-1`
3. **Check database:** Run diagnostic queries in PostgreSQL
4. **Review code:** Check specific component/endpoint that failed
5. **Fix the blocker** before moving to next test

AtlasLM's core value is:
> Upload document → ask questions → receive grounded answers with trustworthy citations.

We're verifying this workflow works end-to-end, reliably, and securely.

Let's go prove it works! 🚀
