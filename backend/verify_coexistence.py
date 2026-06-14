# verify_coexistence.py
import os
import sys
import time
import random
import requests
from docx import Document

# Load env variables from .env
if os.path.exists(".env"):
    with open(".env") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                parts = line.split("=", 1)
                if len(parts) == 2:
                    os.environ[parts[0].strip()] = parts[1].strip()

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8080")
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

def login_temp_user():
    # Sign up/in a temp user
    rand = random.randint(100000, 999999)
    email = f"coexist_{rand}@example.com"
    pwd = "TestPassword123!"
    
    # Sign up via Supabase Admin REST API if service role key exists
    if SUPABASE_SERVICE_ROLE_KEY:
        admin_url = f"{SUPABASE_URL}/auth/v1/admin/users"
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json"
        }
        requests.post(admin_url, json={"email": email, "password": pwd, "email_confirm": True}, headers=headers)
    else:
        # Standard signup fallback
        headers = {
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json"
        }
        signup_url = f"{SUPABASE_URL}/auth/v1/signup"
        requests.post(signup_url, json={"email": email, "password": pwd}, headers=headers)
    
    # Sign in
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
    }
    login_url = f"{SUPABASE_URL}/auth/v1/token?grant_type=password"
    resp = requests.post(login_url, json={"email": email, "password": pwd}, headers=headers)
    if resp.status_code == 200:
        return resp.json()["access_token"]
    raise RuntimeError(f"Failed to login: {resp.text}")

def main():
    print("Logging in...")
    token = login_temp_user()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # 1. Create Workspace
    print("Creating workspace...")
    resp = requests.post(f"{BASE_URL}/api/v1/workspaces", json={"name": "Coexist Workspace"}, headers=headers)
    ws_id = resp.json()["id"]
    print(f"Workspace created: {ws_id}")
    
    # 2. Upload DOCX
    print("Uploading DOCX file...")
    doc = Document()
    doc.add_paragraph("AtlasLM is a powerful open-source RAG platform supporting multiple file types.")
    doc.save("test_coexist.docx")
    
    upload_headers = {"Authorization": f"Bearer {token}"}
    with open("test_coexist.docx", "rb") as f:
        files = {"file": ("test_coexist.docx", f)}
        resp = requests.post(f"{BASE_URL}/api/sources/upload", data={"notebook_id": ws_id}, files=files, headers=upload_headers)
    os.unlink("test_coexist.docx")
    
    if resp.status_code != 200:
        print(f"FAILED to upload DOCX: {resp.status_code} {resp.text}")
        sys.exit(1)
        
    doc_id = resp.json()["source_id"]
    print(f"DOCX uploaded. Source ID: {doc_id}")
    
    # Wait for document to be ready
    print("Waiting for document status...")
    ready = False
    for _ in range(15):
        resp = requests.get(f"{BASE_URL}/api/v1/workspaces/{ws_id}/documents", headers=headers)
        docs = resp.json()
        doc_status = next((d["status"] for d in docs if str(d["id"]) == doc_id), None)
        if doc_status == "ready":
            ready = True
            break
        time.sleep(1)
        
    if not ready:
        print("DOCX failed to become ready in time.")
        sys.exit(1)
    print("DOCX is ready.")
    
    # 3. Chat and citation badge check
    print("Creating session and asking question...")
    resp = requests.post(f"{BASE_URL}/api/v1/workspaces/{ws_id}/sessions", json={}, headers=headers)
    session_id = resp.json()["id"]
    
    # Ask question
    requests.post(f"{BASE_URL}/api/v1/sessions/{session_id}/chat/stream", json={"content": "What is AtlasLM?"}, headers=headers)
    
    # Fetch messages
    resp = requests.get(f"{BASE_URL}/api/v1/sessions/{session_id}", headers=headers)
    msgs = resp.json()["messages"]
    assistant_msg = next((m for m in msgs if m["role"] == "assistant"), None)
    
    if not assistant_msg:
        print("Failed to get assistant response.")
        sys.exit(1)
        
    print(f"Response: {assistant_msg['content']}")
    print(f"Citations: {assistant_msg.get('citations')}")
    assert assistant_msg.get("citations"), "No citations found in chat response!"
    print("Chat citation badge test PASS.")
    
    # 4. Studio outputs check
    print("Testing Studio report generation enqueuing...")
    # POST to /api/v1/workspaces/{workspace_id}/studio
    resp = requests.post(
        f"{BASE_URL}/api/v1/workspaces/{ws_id}/studio",
        json={"output_type": "report", "document_ids": [doc_id]},
        headers=headers
    )
    if resp.status_code not in (200, 201, 202):
        print(f"FAILED to trigger Studio generation: {resp.status_code} {resp.text}")
        sys.exit(1)
        
    studio_job = resp.json()
    print(f"Studio job: {studio_job}")
    assert studio_job["status"] in ("pending", "processing", "ready"), f"Unexpected studio status: {studio_job['status']}"
    print("Studio output generation coexistence PASS.")
    
    print("ALL COEXISTENCE TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    main()
