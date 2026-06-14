#!/usr/bin/env python3
"""
AtlasLM End-to-End Test Suite

Usage:
    python3 test_atlaslm.py --base-url http://localhost:8000 --token YOUR_JWT_TOKEN

Prerequisites:
    - Backend running at specified URL
    - Valid Supabase JWT token
    - Test PDF file available
"""

import sys
import json
import time
import argparse
import subprocess
from pathlib import Path
from datetime import datetime
import requests
from requests.exceptions import RequestException

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

class TestResult:
    def __init__(self):
        self.results = {}
        self.passed = 0
        self.failed = 0
        self.skipped = 0
    
    def add(self, name, passed, message=""):
        status = "✓ PASS" if passed else "✗ FAIL"
        color = Colors.GREEN if passed else Colors.RED
        print(f"{color}{status}{Colors.END} {name}")
        if message:
            print(f"  → {message}")
        
        self.results[name] = {
            "passed": passed,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        
        if passed:
            self.passed += 1
        else:
            self.failed += 1
    
    def skip(self, name, reason=""):
        print(f"{Colors.YELLOW}⊘ SKIP{Colors.END} {name}")
        if reason:
            print(f"  → {reason}")
        self.skipped += 1
    
    def summary(self):
        total = self.passed + self.failed + self.skipped
        print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
        print(f"{Colors.BLUE}TEST SUMMARY{Colors.END}")
        print(f"{Colors.BLUE}{'='*60}{Colors.END}")
        print(f"{Colors.GREEN}Passed: {self.passed}{Colors.END}")
        print(f"{Colors.RED}Failed: {self.failed}{Colors.END}")
        print(f"{Colors.YELLOW}Skipped: {self.skipped}{Colors.END}")
        print(f"Total: {total}")
        print(f"Success Rate: {(self.passed/total*100):.1f}%" if total > 0 else "N/A")
        
        if self.failed > 0:
            print(f"\n{Colors.RED}FAILED TESTS:{Colors.END}")
            for name, result in self.results.items():
                if not result["passed"]:
                    print(f"  - {name}: {result['message']}")
        
        return self.failed == 0


class AtlasLMTester:
    def __init__(self, base_url, token):
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.results = TestResult()
        self.session = requests.Session()
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
        self.test_data = {}
    
    def request(self, method, path, data=None, files=None):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}{path}"
        headers = self.headers.copy()
        
        try:
            if files:
                # multipart/form-data for file uploads
                headers.pop('Content-Type')  # Let requests set it
                response = self.session.request(
                    method, url, 
                    headers=headers, 
                    files=files,
                    timeout=30
                )
            else:
                response = self.session.request(
                    method, url,
                    headers=headers,
                    json=data,
                    timeout=30
                )
            return response
        except RequestException as e:
            raise Exception(f"Request failed: {e}")
    
    # ========== HEALTH & AUTH TESTS ==========
    
    def test_health(self):
        """Test: Health endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/health", timeout=5)
            passed = response.status_code == 200
            data = response.json() if response.text else {}
            message = f"Status: {response.status_code}"
            self.results.add("Health Check", passed, message)
            return passed
        except Exception as e:
            self.results.add("Health Check", False, str(e))
            return False
    
    def test_get_user(self):
        """Test: Get current user"""
        try:
            response = self.request('GET', '/api/v1/users/me')
            passed = response.status_code == 200
            if passed:
                data = response.json()
                self.test_data['user_id'] = data.get('id')
                self.test_data['user_email'] = data.get('email')
                message = f"User: {data.get('email')}"
            else:
                message = f"Status: {response.status_code}"
            self.results.add("Get Current User", passed, message)
            return passed
        except Exception as e:
            self.results.add("Get Current User", False, str(e))
            return False
    
    # ========== WORKSPACE TESTS ==========
    
    def test_list_workspaces(self):
        """Test: List workspaces"""
        try:
            response = self.request('GET', '/api/v1/workspaces')
            passed = response.status_code == 200
            if passed:
                data = response.json()
                count = len(data)
                message = f"Found {count} workspace(s)"
            else:
                message = f"Status: {response.status_code}"
            self.results.add("List Workspaces", passed, message)
            return passed
        except Exception as e:
            self.results.add("List Workspaces", False, str(e))
            return False
    
    def test_create_workspace(self):
        """Test: Create workspace"""
        try:
            workspace_name = f"Test Workspace {int(time.time())}"
            response = self.request(
                'POST',
                '/api/v1/workspaces',
                data={'name': workspace_name}
            )
            passed = response.status_code == 201
            if passed:
                data = response.json()
                self.test_data['workspace_id'] = data.get('id')
                message = f"Workspace ID: {data.get('id')[:8]}..."
            else:
                message = f"Status: {response.status_code}, {response.text}"
            self.results.add("Create Workspace", passed, message)
            return passed
        except Exception as e:
            self.results.add("Create Workspace", False, str(e))
            return False
    
    def test_get_workspace(self):
        """Test: Get specific workspace"""
        if 'workspace_id' not in self.test_data:
            self.results.skip("Get Workspace", "No workspace ID from creation")
            return False
        
        try:
            ws_id = self.test_data['workspace_id']
            response = self.request('GET', f'/api/v1/workspaces/{ws_id}')
            passed = response.status_code == 200
            if passed:
                data = response.json()
                message = f"Workspace: {data.get('name')}"
            else:
                message = f"Status: {response.status_code}"
            self.results.add("Get Workspace", passed, message)
            return passed
        except Exception as e:
            self.results.add("Get Workspace", False, str(e))
            return False
    
    # ========== DOCUMENT TESTS ==========
    
    def test_list_documents(self):
        """Test: List documents in workspace"""
        if 'workspace_id' not in self.test_data:
            self.results.skip("List Documents", "No workspace ID")
            return False
        
        try:
            ws_id = self.test_data['workspace_id']
            response = self.request('GET', f'/api/v1/workspaces/{ws_id}/documents')
            passed = response.status_code == 200
            if passed:
                data = response.json()
                count = len(data)
                message = f"Found {count} document(s)"
            else:
                message = f"Status: {response.status_code}"
            self.results.add("List Documents", passed, message)
            return passed
        except Exception as e:
            self.results.add("List Documents", False, str(e))
            return False
    
    def test_upload_document(self, pdf_path=None):
        """Test: Upload document"""
        if 'workspace_id' not in self.test_data:
            self.results.skip("Upload Document", "No workspace ID")
            return False
        
        if pdf_path is None:
            pdf_path = self._find_test_pdf()
        
        if not pdf_path:
            self.results.skip("Upload Document", "No test PDF found")
            return False
        
        try:
            ws_id = self.test_data['workspace_id']
            with open(pdf_path, 'rb') as f:
                files = {'file': f}
                response = self.request(
                    'POST',
                    f'/api/v1/workspaces/{ws_id}/documents/upload',
                    files=files
                )
            
            passed = response.status_code == 201
            if passed:
                data = response.json()
                self.test_data['document_id'] = data.get('id')
                self.test_data['document_name'] = data.get('name')
                message = f"Doc ID: {data.get('id')[:8]}..., Status: {data.get('status')}"
            else:
                message = f"Status: {response.status_code}, {response.text[:100]}"
            self.results.add("Upload Document", passed, message)
            return passed
        except Exception as e:
            self.results.add("Upload Document", False, str(e))
            return False
    
    def test_document_status_ready(self, wait_seconds=30):
        """Test: Document becomes ready after ingestion"""
        if 'document_id' not in self.test_data or 'workspace_id' not in self.test_data:
            self.results.skip("Document Status Ready", "No document from upload")
            return False
        
        try:
            ws_id = self.test_data['workspace_id']
            doc_id = self.test_data['document_id']
            
            start_time = time.time()
            while time.time() - start_time < wait_seconds:
                response = self.request(
                    'GET',
                    f'/api/v1/workspaces/{ws_id}/documents/{doc_id}'
                )
                
                if response.status_code == 200:
                    data = response.json()
                    status = data.get('status')
                    
                    if status == 'ready':
                        message = f"Document ready after {int(time.time() - start_time)}s"
                        self.results.add("Document Status Ready", True, message)
                        return True
                    elif status == 'failed':
                        self.results.add("Document Status Ready", False, "Ingestion failed")
                        return False
                
                time.sleep(2)
            
            self.results.add("Document Status Ready", False, f"Timeout after {wait_seconds}s")
            return False
        except Exception as e:
            self.results.add("Document Status Ready", False, str(e))
            return False
    
    def test_get_chunks(self):
        """Test: Get document chunks"""
        if 'document_id' not in self.test_data:
            self.results.skip("Get Chunks", "No document")
            return False
        
        try:
            doc_id = self.test_data['document_id']
            response = self.request('GET', f'/api/v1/documents/{doc_id}/chunks')
            passed = response.status_code == 200
            if passed:
                data = response.json()
                count = len(data)
                if count > 0:
                    self.test_data['chunk_id'] = data[0].get('id')
                message = f"Found {count} chunk(s)"
            else:
                message = f"Status: {response.status_code}"
            self.results.add("Get Chunks", passed, message)
            return passed
        except Exception as e:
            self.results.add("Get Chunks", False, str(e))
            return False
    
    # ========== SESSION TESTS ==========
    
    def test_create_session(self):
        """Test: Create chat session"""
        if 'workspace_id' not in self.test_data:
            self.results.skip("Create Session", "No workspace")
            return False
        
        try:
            ws_id = self.test_data['workspace_id']
            response = self.request(
                'POST',
                f'/api/v1/workspaces/{ws_id}/sessions',
                data={}
            )
            passed = response.status_code == 201
            if passed:
                data = response.json()
                self.test_data['session_id'] = data.get('id')
                message = f"Session ID: {data.get('id')[:8]}..."
            else:
                message = f"Status: {response.status_code}"
            self.results.add("Create Session", passed, message)
            return passed
        except Exception as e:
            self.results.add("Create Session", False, str(e))
            return False
    
    def test_list_sessions(self):
        """Test: List sessions in workspace"""
        if 'workspace_id' not in self.test_data:
            self.results.skip("List Sessions", "No workspace")
            return False
        
        try:
            ws_id = self.test_data['workspace_id']
            response = self.request('GET', f'/api/v1/workspaces/{ws_id}/sessions')
            passed = response.status_code == 200
            if passed:
                data = response.json()
                count = len(data)
                message = f"Found {count} session(s)"
            else:
                message = f"Status: {response.status_code}"
            self.results.add("List Sessions", passed, message)
            return passed
        except Exception as e:
            self.results.add("List Sessions", False, str(e))
            return False
    
    # ========== CHAT TESTS ==========
    
    def test_chat_stream(self):
        """Test: Chat streaming with citations"""
        if 'session_id' not in self.test_data or 'document_id' not in self.test_data:
            self.results.skip("Chat Stream", "No session or document")
            return False
        
        try:
            session_id = self.test_data['session_id']
            doc_id = self.test_data['document_id']
            
            response = self.request(
                'POST',
                f'/api/v1/sessions/{session_id}/chat',
                data={
                    'message': 'Summarize this document',
                    'document_ids': [doc_id]
                }
            )
            
            passed = response.status_code == 200
            if passed:
                # Check for streaming events
                content = response.text
                has_chunks = 'text_chunk' in content
                has_citations = 'citations' in content or 'source' in content
                message = f"Streaming OK, chunks: {has_chunks}, citations: {has_citations}"
            else:
                message = f"Status: {response.status_code}"
            
            self.results.add("Chat Stream", passed, message)
            return passed
        except Exception as e:
            self.results.add("Chat Stream", False, str(e))
            return False
    
    def test_get_messages(self):
        """Test: Get session messages"""
        if 'session_id' not in self.test_data:
            self.results.skip("Get Messages", "No session")
            return False
        
        try:
            session_id = self.test_data['session_id']
            response = self.request('GET', f'/api/v1/sessions/{session_id}/messages')
            passed = response.status_code == 200
            if passed:
                data = response.json()
                count = len(data)
                message = f"Found {count} message(s)"
            else:
                message = f"Status: {response.status_code}"
            self.results.add("Get Messages", passed, message)
            return passed
        except Exception as e:
            self.results.add("Get Messages", False, str(e))
            return False
    
    # ========== UTILITY ==========
    
    def _find_test_pdf(self):
        """Find a test PDF file"""
        search_paths = [
            Path.cwd() / "test.pdf",
            Path.cwd() / "sample.pdf",
            Path.home() / "Downloads" / "test.pdf",
            Path("/tmp/test.pdf"),
        ]
        
        for path in search_paths:
            if path.exists():
                return str(path)
        
        return None
    
    def run_all_tests(self, pdf_path=None):
        """Run complete test suite"""
        print(f"{Colors.BLUE}Starting AtlasLM Test Suite{Colors.END}")
        print(f"Backend: {self.base_url}")
        print(f"Started: {datetime.now().isoformat()}\n")
        
        # Phase 1: Health & Auth
        print(f"{Colors.BLUE}[Phase 1] Health & Authentication{Colors.END}")
        self.test_health()
        self.test_get_user()
        
        # Phase 2: Workspaces
        print(f"\n{Colors.BLUE}[Phase 2] Workspace Management{Colors.END}")
        self.test_create_workspace()
        self.test_list_workspaces()
        self.test_get_workspace()
        
        # Phase 3: Documents
        print(f"\n{Colors.BLUE}[Phase 3] Document Management{Colors.END}")
        self.test_list_documents()
        self.test_upload_document(pdf_path)
        self.test_document_status_ready()
        self.test_get_chunks()
        
        # Phase 4: Sessions
        print(f"\n{Colors.BLUE}[Phase 4] Session Management{Colors.END}")
        self.test_create_session()
        self.test_list_sessions()
        
        # Phase 5: Chat
        print(f"\n{Colors.BLUE}[Phase 5] Chat & Citations{Colors.END}")
        self.test_chat_stream()
        self.test_get_messages()
        
        # Summary
        print()
        all_passed = self.results.summary()
        
        return all_passed


def main():
    parser = argparse.ArgumentParser(
        description='AtlasLM End-to-End Test Suite'
    )
    parser.add_argument(
        '--base-url',
        default='http://localhost:8000',
        help='Backend base URL'
    )
    parser.add_argument(
        '--token',
        help='Supabase JWT token (get from localStorage when logged in)'
    )
    parser.add_argument(
        '--pdf',
        help='Path to test PDF file'
    )
    
    args = parser.parse_args()
    
    if not args.token:
        print(f"{Colors.RED}Error: --token is required{Colors.END}")
        print("\nTo get your token:")
        print("  1. Open http://localhost:3000/dashboard in browser")
        print("  2. Open DevTools (F12)")
        print("  3. Go to Application tab")
        print("  4. Local Storage")
        print("  5. Find 'supabase.auth.token'")
        print("  6. Copy the value")
        print("\nUsage:")
        print("  python3 test_atlaslm.py --token <YOUR_TOKEN> [--pdf /path/to/test.pdf]")
        sys.exit(1)
    
    tester = AtlasLMTester(args.base_url, args.token)
    all_passed = tester.run_all_tests(args.pdf)
    
    sys.exit(0 if all_passed else 1)


if __name__ == '__main__':
    main()
