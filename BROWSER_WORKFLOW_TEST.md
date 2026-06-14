# AtlasLM Browser Workflow Verification

**Goal:** End-to-end verification of the complete workflow:
- Login → Notebook → PDF Upload → Ingestion → Question → Answer → Citation → Refresh → Logout

**Prerequisite:** Backend and frontend running locally.

---

## Setup

### 1. Start Backend + Database

```bash
cd C:\Users\hartm\atlaslm
docker-compose down
docker-compose up -d --build

# Wait 30-60 seconds for database to initialize
docker ps  # Verify all services started
```

### 2. Start Frontend

```bash
cd C:\Users\hartm\atlaslm\frontend
npm install  # if needed
npm run dev
```

Frontend will be at: **http://localhost:3000**

Backend API will be at: **http://localhost:8000**

---

## Test Workflow

### Phase 1: Authentication

#### ✓ Step 1.1: Navigate to Login
- Open **http://localhost:3000/login**
- Expected: Login form with email/password fields
- Document: Screenshot of login page

#### ✓ Step 1.2: Create First Test Account (User A)
- Email: `testuser.a@example.com`
- Password: `TestPassword123!`
- Sign up with button
- Expected: Account created, redirected to dashboard
- Document: Screenshot of dashboard after login

#### Evidence Checklist:
- [ ] Login form displays
- [ ] Sign-up successful
- [ ] Redirected to `/dashboard`
- [ ] User name/email visible in header

**If any step fails:**
- Check browser console for errors
- Check backend logs: `docker logs atlaslm-backend-1`
- Verify Supabase credentials in `.env.local`

---

### Phase 2: Workspace & Document Management

#### ✓ Step 2.1: Create New Notebook
- Left sidebar: Look for "New Notebook" or "Create Workspace" button
- Click and type name: `Test Notebook A`
- Press Create
- Expected: New workspace appears in list, is selected

**Evidence Checklist:**
- [ ] Workspace appears in sidebar
- [ ] Workspace is highlighted/selected
- [ ] Workspace ID shown in URL or console

#### ✓ Step 2.2: Upload a Real PDF
- Right panel should have "Upload" button
- Select a real PDF from your computer (e.g., README.md converted to PDF, or any actual PDF)
- Expected: File appears in document list with status "Processing" → "Ready"

**Evidence Checklist:**
- [ ] File appears in UI
- [ ] Status shows "Processing"
- [ ] After 5-30 seconds, status changes to "Ready"
- [ ] Backend logs show ingestion progress

**To monitor ingestion in backend logs:**
```bash
docker logs -f atlaslm-backend-1 | grep -i "ingest\|embed\|chunk"
```

---

### Phase 3: Semantic Search & Streaming

#### ✓ Step 3.1: Ask a Question
- Chat input at bottom of dashboard
- Type a question about the PDF content
  - Example: "What is the main topic of this document?"
  - Or: "Summarize the key points"
  - Or: Anything specific to your test PDF
- Press Send
- Expected: Answer streams in real-time with [source_N] tags

**Evidence Checklist:**
- [ ] Message appears in chat
- [ ] Answer starts streaming (words appear gradually)
- [ ] Answer contains [source_1], [source_2], etc. tags
- [ ] Answer relates to PDF content (not hallucination)

**Console monitoring:**
```javascript
// Open DevTools → Console
// You should see streaming chunks being logged
console.log("Message received:", event.data);
```

---

### Phase 4: Citation System

#### ✓ Step 4.1: Verify Citation Pills
- In the streamed response, look for `[source_1]` tags
- They should be rendered as clickable badges/pills
- Example: response shows: "According to the document [source_1], the answer is..."

**Evidence Checklist:**
- [ ] Citation tags visible
- [ ] Citation tags are styled as clickable pills (hover shows cursor change)
- [ ] Multiple citations in single response [source_1], [source_2], etc.

#### ✓ Step 4.2: Click Citation Pill
- Click on `[source_1]` badge
- Expected: Drawer/modal opens showing:
  - **Filename:** name of uploaded PDF
  - **Page Number:** e.g., "Page 2 of 10"
  - **Content:** The actual text chunk from the PDF

**Evidence Checklist:**
- [ ] Citation drawer opens
- [ ] Filename displayed correctly
- [ ] Page number displayed
- [ ] Chunk text visible and readable
- [ ] Text matches what was in the PDF

**Example expected output:**
```
Citation Details
Filename: example-document.pdf
Page: 2 of 5
---
Chunk:
"This is the relevant text from the PDF that was used to ground
the AI's answer. It provides evidence that the answer came from
your actual document, not an AI hallucination."
```

#### ✓ Step 4.3: Try Multiple Citations
- Click other citation pills ([source_2], [source_3], etc.)
- Verify each shows different content from different pages/chunks

**Evidence Checklist:**
- [ ] Different citations show different content
- [ ] Page numbers vary
- [ ] All citations are from same document

---

### Phase 5: Session Persistence

#### ✓ Step 5.1: Refresh Page
- With chat visible and citations working, press **F5** to refresh
- Expected: Everything restores
  - Workspace still selected
  - Chat session still selected
  - Messages still visible
  - Citations still work

**Evidence Checklist:**
- [ ] After refresh, workspace name still shows in sidebar
- [ ] After refresh, chat messages are visible
- [ ] After refresh, you can click citations again
- [ ] Citation drawer still works

**Browser DevTools check:**
```javascript
// Open DevTools → Application → Local Storage
// You should see:
// - selectedWorkspaceId: {workspace-uuid}
// - selectedSessionId: {session-uuid}
localStorage.getItem('selectedWorkspaceId')
localStorage.getItem('selectedSessionId')
```

#### ✓ Step 5.2: Ask Another Question
- Type a new question in chat
- Expected: New answer streams with citations

**Evidence Checklist:**
- [ ] New message added below previous ones
- [ ] Streaming works again
- [ ] Citations appear and work

---

### Phase 6: Logout & Access Control

#### ✓ Step 6.1: Logout
- Click user menu (top right, usually shows email or avatar)
- Click "Logout"
- Expected: Redirected to login page

**Evidence Checklist:**
- [ ] Redirected to `/login`
- [ ] Dashboard no longer accessible

#### ✓ Step 6.2: Verify Protected Routes
- Try to access **http://localhost:3000/dashboard** directly
- Expected: Redirected to login
- Try to access API directly (DevTools → Network):
  - Without logging back in, fetch `http://localhost:8000/api/v1/workspaces`
  - Expected: **401 Unauthorized** (not 200)

**Evidence Checklist:**
- [ ] Cannot access dashboard without auth
- [ ] API returns 401 for requests without valid JWT
- [ ] localStorage is cleared

---

## Phase 7: User Isolation (Critical Security Test)

**This is the most important test.** User A's data must be completely hidden from User B.

### Setup

You'll need two separate browser windows or profiles:
- **Browser 1 (Incognito/Private):** User A
- **Browser 2 (Incognito/Private):** User B

Or use separate browsers entirely.

### User A Setup

#### ✓ Step 7.1: User A Login & Create Content
- **Browser 1:** http://localhost:3000/login
- Email: `testuser.a@example.com`
- Password: `TestPassword123!`
- Create workspace: `User A Private Workspace`
- Upload a document: `user-a-private-doc.pdf`
- Ask a question and get a response

**Evidence Checklist:**
- [ ] User A can create workspace
- [ ] User A can upload document
- [ ] User A can ask question
- [ ] Document shows in User A's workspace list

**Important:** Note the workspace ID and document ID:
```javascript
// In Browser 1 console, find the workspace/session/document IDs
// Or check Network tab for API responses
```

### User B Isolation Test

#### ✓ Step 7.2: User B Login
- **Browser 2:** http://localhost:3000/login
- Create new account:
  - Email: `testuser.b@example.com`
  - Password: `TestPassword456!`
- After login, you're on User B's dashboard

#### ✓ Step 7.3: Verify User B Cannot See User A's Data

**Check 1: Workspaces**
- Left sidebar should be **empty** (no "User A Private Workspace")
- Expected: Only User B's workspaces (none, if just created)

**Evidence Checklist:**
- [ ] User B sidebar is empty or shows only User B's content
- [ ] User A's workspace name is NOT visible

**Check 2: Direct API Call (Forbidden Access)**
- Browser 2 console:
```javascript
// Try to access User A's workspace directly
fetch('http://localhost:8000/api/v1/workspaces/{USER_A_WORKSPACE_ID}', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
  }
})
.then(r => r.json())
.then(d => console.log('Status:', d))
```
- Expected: **403 Forbidden** or **404 Not Found** (not 200)

**Evidence Checklist:**
- [ ] API returns error, not data
- [ ] Cannot fetch User A's workspace via direct ID

**Check 3: Document List**
- User B's workspace list should be empty or show only User B's documents
- Expected: User A's `user-a-private-doc.pdf` is NOT visible

**Evidence Checklist:**
- [ ] Document list empty or shows only User B's docs
- [ ] User A's PDF name not visible

#### ✓ Step 7.4: User B Can Create Own Content
- User B creates their own workspace: `User B Private Workspace`
- User B uploads their own document: `user-b-private-doc.pdf`
- Expected: Works fine

**Evidence Checklist:**
- [ ] User B workspace created
- [ ] User B document uploaded
- [ ] User B can ask questions

#### ✓ Step 7.5: Switch Back to User A
- **Browser 1:** User A should still see their workspace
- User A should NOT see User B's workspace
- User A's documents should still be there

**Evidence Checklist:**
- [ ] User A workspace still visible
- [ ] User A document still visible
- [ ] User B workspace NOT visible

---

## Optional: Multi-Page PDF Testing

#### ✓ Step 8.1: Upload Multi-Page PDF
- Use a real PDF with multiple pages (10+)
- Upload to workspace
- Wait for ingestion to complete

#### ✓ Step 8.2: Ask Question, Get Citations from Different Pages
- Ask a question that should require information from multiple pages
- Expected: Citations show different page numbers
  - E.g., [source_1] from Page 3, [source_2] from Page 7

**Evidence Checklist:**
- [ ] Citations show different page numbers
- [ ] All page numbers are correct
- [ ] Chunk content actually matches stated page

---

## Test Results Summary

Create a test report:

```
BROWSER WORKFLOW VERIFICATION - TEST REPORT
Date: [DATE]
Tester: [YOUR_NAME]

PHASE 1: AUTHENTICATION
✓ Login successful
✓ Account created
✓ Dashboard accessible

PHASE 2: WORKSPACE & DOCUMENTS
✓ Workspace created
✓ PDF uploaded
✓ Ingestion completed

PHASE 3: SEMANTIC SEARCH & STREAMING
✓ Question submitted
✓ Answer streamed
✓ Citations tagged [source_N]

PHASE 4: CITATION SYSTEM
✓ Citation pills visible
✓ Citation drawer opens
✓ Filename displayed
✓ Page number displayed
✓ Chunk content displayed

PHASE 5: SESSION PERSISTENCE
✓ Refresh - workspace retained
✓ Refresh - session retained
✓ Refresh - messages retained
✓ Refresh - citations work

PHASE 6: LOGOUT & ACCESS CONTROL
✓ Logout works
✓ Dashboard blocked after logout
✓ API returns 401 without auth

PHASE 7: USER ISOLATION (CRITICAL)
✓ User A content created
✓ User B cannot see User A workspace
✓ User B cannot access User A data via API
✓ User B cannot see User A documents
✓ User B can create own content
✓ User A cannot see User B content

CRITICAL FINDINGS:
[List any blockers, bugs, or issues]

READY FOR NEXT PHASE:
- [x] Browser workflow verified
- [x] User isolation verified
- [ ] Performance acceptable
- [ ] Error handling robust
```

---

## Troubleshooting

### Issue: Backend not responding
```bash
docker ps  # Check if container is running
docker logs atlaslm-backend-1  # Check for startup errors
docker-compose logs  # Check docker-compose output
```

### Issue: Login fails
- Check Supabase credentials in `frontend/.env.local`
- Verify Supabase project is accessible
- Check browser console for error details

### Issue: PDF upload fails
- Check file size (max 50MB)
- Check file format (PDF, TXT, MD)
- Check backend logs for ingestion errors

### Issue: Streaming doesn't work
- Check LLM provider credentials (OpenRouter, Blackbox, etc.)
- Check backend console for provider errors
- Try switching providers in backend config

### Issue: Citations don't appear
- Check SSE connection in Network tab (should be 200)
- Check that embeddings were generated (backend logs)
- Verify pgvector is working: `docker exec atlaslm-db-1 psql -U atlas_user -d atlas_db -c "SELECT count(*) FROM embeddings;"`

### Issue: User isolation fails
- Check middleware: `backend/app/middleware/auth_middleware.py`
- Verify JWT validation: `backend/app/core/auth_service.py`
- Check database queries have `WHERE user_id = current_user.id`

---

## Success Criteria

All must be true:

1. ✓ User can authenticate securely
2. ✓ User can create multiple notebooks
3. ✓ User can upload real PDFs
4. ✓ Ingestion completes and documents are ready
5. ✓ Questions are answered with streamed responses
6. ✓ Answers include citations ([source_N] tags)
7. ✓ Clicking citations shows file, page, and content
8. ✓ Page refresh maintains workspace, session, and messages
9. ✓ Citations still work after refresh
10. ✓ Logout blocks access to protected routes
11. ✓ **User A cannot see User B's data** (CRITICAL)
12. ✓ Multi-page PDFs show correct page numbers in citations

If all pass: **AtlasLM core workflow is production-ready.**

---

## Next Steps After Verification

Once all tests pass:

1. **Phase 3: Product Hardening**
   - Real PDF multi-page testing (extended)
   - Citation persistence under load
   - Dashboard UI polish
   - Error message improvements

2. **Phase 4: Provider Management**
   - Test OpenRouter fallback
   - Test Blackbox fallback
   - Test Ollama local inference

3. **Phase 5: Performance**
   - Large document ingestion (100MB+)
   - Concurrent user testing
   - Query latency optimization

4. **Phase 6: Mobile & Deployment**
   - iOS app
   - Android app
   - Production deployment

---

## Recording Evidence

For each ✓ step, take:
- **Screenshot** (whole screen or relevant section)
- **Console output** (if applicable)
- **Network tab** (if applicable)
- **Notes** (any observations)

Store in: `BROWSER_WORKFLOW_TEST_EVIDENCE/`

Example structure:
```
BROWSER_WORKFLOW_TEST_EVIDENCE/
├── 1-1-login-page.png
├── 1-2-dashboard-loaded.png
├── 2-1-workspace-created.png
├── 2-2-pdf-uploading.png
├── 2-2-pdf-ready.png
├── 3-1-question-asked.png
├── 3-1-answer-streaming.png
├── 4-1-citation-pills.png
├── 4-2-citation-drawer.png
├── 5-1-after-refresh.png
├── 6-1-logout.png
├── 6-2-blocked-after-logout.png
├── 7-1-user-a-workspace.png
├── 7-2-user-b-empty-workspace.png
├── 7-3-user-b-cannot-access-user-a-data.png
└── TEST_REPORT.md
```

This provides clear evidence of each phase working correctly.
