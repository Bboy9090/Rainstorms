#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Rainstorms Children's Book Creation API
Tests all endpoints including auth, projects, AI generation, characters, pages, and export
"""

import requests
import json
import sys
import os
from datetime import datetime

# Get base URL from frontend .env file
def get_base_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except:
        pass
    return "http://localhost:8001"

BASE_URL = get_base_url()
API_BASE = f"{BASE_URL}/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_success(message):
    print(f"{Colors.GREEN}✅ {message}{Colors.ENDC}")

def print_error(message):
    print(f"{Colors.RED}❌ {message}{Colors.ENDC}")

def print_warning(message):
    print(f"{Colors.YELLOW}⚠️  {message}{Colors.ENDC}")

def print_info(message):
    print(f"{Colors.BLUE}ℹ️  {message}{Colors.ENDC}")

def print_header(message):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE}{message}{Colors.ENDC}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.ENDC}")

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
        
    def add_pass(self, test_name):
        self.passed += 1
        print_success(f"{test_name}")
        
    def add_fail(self, test_name, error):
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        print_error(f"{test_name}: {error}")
        
    def summary(self):
        total = self.passed + self.failed
        print_header("TEST SUMMARY")
        print(f"Total Tests: {total}")
        print_success(f"Passed: {self.passed}")
        if self.failed > 0:
            print_error(f"Failed: {self.failed}")
            print("\nFailed Tests:")
            for error in self.errors:
                print_error(f"  - {error}")
        else:
            print_success("All tests passed!")
        return self.failed == 0

def test_health_check(results):
    """Test health check endpoint"""
    print_header("TESTING HEALTH CHECK")
    
    try:
        response = requests.get(f"{API_BASE}/health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "status" in data and data["status"] == "healthy":
                results.add_pass("Health check endpoint")
                return True
            else:
                results.add_fail("Health check endpoint", f"Invalid response format: {data}")
        else:
            results.add_fail("Health check endpoint", f"Status code: {response.status_code}")
    except Exception as e:
        results.add_fail("Health check endpoint", f"Request failed: {str(e)}")
    
    return False

def test_auth_flow(results):
    """Test complete authentication flow"""
    print_header("TESTING AUTHENTICATION FLOW")
    
    # Test data
    test_email = "testuser@rainstorms.com"
    test_password = "securepassword123"
    
    # Test registration
    try:
        register_data = {
            "email": test_email,
            "password": test_password
        }
        
        response = requests.post(f"{API_BASE}/auth/register", json=register_data, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "token" in data and "user" in data:
                token = data["token"]
                user_id = data["user"]["id"]
                results.add_pass("User registration")
            else:
                results.add_fail("User registration", f"Invalid response format: {data}")
                return None, None
        elif response.status_code == 400 and "already registered" in response.text:
            # User already exists, try login
            print_warning("User already exists, testing login instead")
        else:
            results.add_fail("User registration", f"Status code: {response.status_code}, Response: {response.text}")
            return None, None
            
    except Exception as e:
        results.add_fail("User registration", f"Request failed: {str(e)}")
        return None, None
    
    # Test login
    try:
        login_data = {
            "email": test_email,
            "password": test_password
        }
        
        response = requests.post(f"{API_BASE}/auth/login", json=login_data, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "token" in data and "user" in data:
                token = data["token"]
                user_id = data["user"]["id"]
                results.add_pass("User login")
            else:
                results.add_fail("User login", f"Invalid response format: {data}")
                return None, None
        else:
            results.add_fail("User login", f"Status code: {response.status_code}, Response: {response.text}")
            return None, None
            
    except Exception as e:
        results.add_fail("User login", f"Request failed: {str(e)}")
        return None, None
    
    # Test get current user
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{API_BASE}/auth/me", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "id" in data and "email" in data:
                results.add_pass("Get current user")
            else:
                results.add_fail("Get current user", f"Invalid response format: {data}")
        else:
            results.add_fail("Get current user", f"Status code: {response.status_code}")
            
    except Exception as e:
        results.add_fail("Get current user", f"Request failed: {str(e)}")
    
    return token, user_id

def test_demo_project(results):
    """Test demo project endpoint"""
    print_header("TESTING DEMO PROJECT")
    
    try:
        response = requests.get(f"{API_BASE}/demo", timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            if "project" in data and "characters" in data and "pages" in data:
                project = data["project"]
                if project["title"] == "Captain Blanket and the Midnight Brother":
                    results.add_pass("Demo project retrieval")
                    return project["id"]
                else:
                    results.add_fail("Demo project retrieval", f"Unexpected project title: {project['title']}")
            else:
                results.add_fail("Demo project retrieval", f"Invalid response format: {data}")
        else:
            results.add_fail("Demo project retrieval", f"Status code: {response.status_code}")
            
    except Exception as e:
        results.add_fail("Demo project retrieval", f"Request failed: {str(e)}")
    
    return None

def test_project_crud(results, token):
    """Test project CRUD operations"""
    print_header("TESTING PROJECT CRUD")
    
    if not token:
        results.add_fail("Project CRUD", "No auth token available")
        return None
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test create project
    try:
        project_data = {
            "title": "Test Adventure Story",
            "original_idea": "A brave little mouse goes on an adventure to find the magical cheese of courage",
            "tone": "adventurous, inspiring",
            "age_range": "4-7",
            "page_count": 8
        }
        
        response = requests.post(f"{API_BASE}/projects", json=project_data, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "id" in data and "title" in data:
                project_id = data["id"]
                results.add_pass("Create project")
            else:
                results.add_fail("Create project", f"Invalid response format: {data}")
                return None
        else:
            results.add_fail("Create project", f"Status code: {response.status_code}, Response: {response.text}")
            return None
            
    except Exception as e:
        results.add_fail("Create project", f"Request failed: {str(e)}")
        return None
    
    # Test get project by ID
    try:
        response = requests.get(f"{API_BASE}/projects/{project_id}", headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "id" in data and data["id"] == project_id:
                results.add_pass("Get project by ID")
            else:
                results.add_fail("Get project by ID", f"Invalid response or ID mismatch: {data}")
        else:
            results.add_fail("Get project by ID", f"Status code: {response.status_code}")
            
    except Exception as e:
        results.add_fail("Get project by ID", f"Request failed: {str(e)}")
    
    return project_id

def test_ai_generation(results):
    """Test AI blueprint generation"""
    print_header("TESTING AI GENERATION")
    
    try:
        blueprint_data = {
            "original_idea": "A little robot learns about friendship in a garden",
            "tone": "heartwarming, gentle",
            "age_range": "3-6",
            "page_count": 6
        }
        
        response = requests.post(f"{API_BASE}/generate/blueprint", json=blueprint_data, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["title", "hook", "summary", "theme", "characters", "outline"]
            if all(field in data for field in required_fields):
                if len(data["outline"]) == 6:  # Should match page_count
                    results.add_pass("AI blueprint generation")
                else:
                    results.add_fail("AI blueprint generation", f"Outline length {len(data['outline'])} doesn't match page_count 6")
            else:
                missing = [f for f in required_fields if f not in data]
                results.add_fail("AI blueprint generation", f"Missing fields: {missing}")
        else:
            results.add_fail("AI blueprint generation", f"Status code: {response.status_code}, Response: {response.text}")
            
    except Exception as e:
        results.add_fail("AI blueprint generation", f"Request failed: {str(e)}")

def test_characters(results, project_id):
    """Test character endpoints"""
    print_header("TESTING CHARACTERS")
    
    if not project_id:
        results.add_fail("Characters test", "No project ID available")
        return
    
    try:
        response = requests.get(f"{API_BASE}/projects/{project_id}/characters", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                results.add_pass("Get project characters")
            else:
                results.add_fail("Get project characters", f"Expected list, got: {type(data)}")
        else:
            results.add_fail("Get project characters", f"Status code: {response.status_code}")
            
    except Exception as e:
        results.add_fail("Get project characters", f"Request failed: {str(e)}")

def test_pages(results, project_id):
    """Test page endpoints"""
    print_header("TESTING PAGES")
    
    if not project_id:
        results.add_fail("Pages test", "No project ID available")
        return
    
    try:
        response = requests.get(f"{API_BASE}/projects/{project_id}/pages", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                results.add_pass("Get project pages")
            else:
                results.add_fail("Get project pages", f"Expected list, got: {type(data)}")
        else:
            results.add_fail("Get project pages", f"Status code: {response.status_code}")
            
    except Exception as e:
        results.add_fail("Get project pages", f"Request failed: {str(e)}")

def test_export(results, project_id):
    """Test export endpoints"""
    print_header("TESTING EXPORT")
    
    if not project_id:
        results.add_fail("Export test", "No project ID available")
        return
    
    # Test text export
    try:
        response = requests.get(f"{API_BASE}/projects/{project_id}/export/text", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "text" in data and isinstance(data["text"], str):
                results.add_pass("Text export")
            else:
                results.add_fail("Text export", f"Invalid response format: {data}")
        else:
            results.add_fail("Text export", f"Status code: {response.status_code}")
            
    except Exception as e:
        results.add_fail("Text export", f"Request failed: {str(e)}")
    
    # Test JSON export
    try:
        response = requests.get(f"{API_BASE}/projects/{project_id}/export/json", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["project", "characters", "pages"]
            if all(field in data for field in required_fields):
                results.add_pass("JSON export")
            else:
                missing = [f for f in required_fields if f not in data]
                results.add_fail("JSON export", f"Missing fields: {missing}")
        else:
            results.add_fail("JSON export", f"Status code: {response.status_code}")
            
    except Exception as e:
        results.add_fail("JSON export", f"Request failed: {str(e)}")

def main():
    """Run all tests"""
    print_header("RAINSTORMS API TESTING")
    print_info(f"Base URL: {BASE_URL}")
    print_info(f"API Base: {API_BASE}")
    print_info(f"Timestamp: {datetime.now().isoformat()}")
    
    results = TestResults()
    
    # Test 1: Health Check
    health_ok = test_health_check(results)
    if not health_ok:
        print_error("Health check failed - API may not be running")
        results.summary()
        return False
    
    # Test 2: Authentication Flow
    token, user_id = test_auth_flow(results)
    
    # Test 3: Demo Project
    demo_project_id = test_demo_project(results)
    
    # Test 4: Project CRUD
    test_project_id = test_project_crud(results, token)
    
    # Test 5: AI Generation
    test_ai_generation(results)
    
    # Use demo project ID for remaining tests if available
    project_id_for_tests = demo_project_id or test_project_id
    
    # Test 6: Characters
    test_characters(results, project_id_for_tests)
    
    # Test 7: Pages
    test_pages(results, project_id_for_tests)
    
    # Test 8: Export
    test_export(results, project_id_for_tests)
    
    # Final summary
    success = results.summary()
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)