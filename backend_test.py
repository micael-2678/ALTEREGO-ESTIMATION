#!/usr/bin/env python3
"""
AlterEgo API Backend Testing Suite
Tests all API endpoints for the real estate estimation app
"""

import requests
import json
import sys
import os
from datetime import datetime

# Configuration
BASE_URL = "https://alterego-immo.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
ADMIN_USERNAME = "Micael"
ADMIN_PASSWORD = "Micael123"

# Test data
TEST_ADDRESS = "2 rue des italiens, 75009 Paris"
TEST_LAT = 48.8712
TEST_LNG = 2.3378
TEST_TYPE = "appartement"
TEST_SURFACE = 85
TEST_RADIUS = 1000
TEST_MONTHS = 24

class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.jwt_token = None
        self.results = []
        
    def log_result(self, test_name, success, message, response_data=None):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        
        self.results.append({
            'test': test_name,
            'success': success,
            'message': message,
            'response_data': response_data,
            'timestamp': datetime.now().isoformat()
        })
        
    def test_health_check(self):
        """Test GET /api/ - Health check"""
        try:
            response = self.session.get(f"{API_BASE}/")
            
            if response.status_code == 200:
                data = response.json()
                if 'message' in data and 'AlterEgo API' in data['message']:
                    self.log_result("Health Check", True, f"API is running - {data['message']}", data)
                else:
                    self.log_result("Health Check", False, f"Unexpected response format: {data}")
            else:
                self.log_result("Health Check", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Health Check", False, f"Request failed: {str(e)}")
    
    def test_geocoding(self):
        """Test GET /api/geo/resolve - Address geocoding"""
        try:
            params = {'address': TEST_ADDRESS}
            response = self.session.get(f"{API_BASE}/geo/resolve", params=params)
            
            if response.status_code == 200:
                data = response.json()
                if 'suggestions' in data and len(data['suggestions']) > 0:
                    suggestion = data['suggestions'][0]
                    if 'lat' in suggestion and 'lng' in suggestion:
                        self.log_result("Geocoding", True, 
                                      f"Found {len(data['suggestions'])} suggestions, first: {suggestion['address']}", 
                                      data)
                    else:
                        self.log_result("Geocoding", False, "Missing lat/lng in suggestions")
                else:
                    self.log_result("Geocoding", False, "No suggestions returned")
            else:
                self.log_result("Geocoding", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Geocoding", False, f"Request failed: {str(e)}")
    
    def test_geocoding_missing_address(self):
        """Test geocoding with missing address parameter"""
        try:
            response = self.session.get(f"{API_BASE}/geo/resolve")
            
            if response.status_code == 400:
                data = response.json()
                if 'error' in data:
                    self.log_result("Geocoding Error Handling", True, 
                                  f"Correctly returned 400 for missing address: {data['error']}")
                else:
                    self.log_result("Geocoding Error Handling", False, "Missing error message in 400 response")
            else:
                self.log_result("Geocoding Error Handling", False, 
                              f"Expected 400, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Geocoding Error Handling", False, f"Request failed: {str(e)}")
    
    def test_dvf_comparables(self):
        """Test GET /api/dvf/comparables - DVF comparables query"""
        try:
            params = {
                'lat': TEST_LAT,
                'lng': TEST_LNG,
                'type': TEST_TYPE,
                'surface': TEST_SURFACE,
                'radiusMeters': TEST_RADIUS,
                'months': TEST_MONTHS
            }
            response = self.session.get(f"{API_BASE}/dvf/comparables", params=params)
            
            if response.status_code == 200:
                data = response.json()
                if 'count' in data and 'comparables' in data:
                    count = data['count']
                    stats = data.get('stats')
                    if count > 0 and stats:
                        self.log_result("DVF Comparables", True, 
                                      f"Found {count} comparables with stats: avg €{stats.get('meanPricePerM2', 0)}/m²", 
                                      data)
                    elif count == 0:
                        self.log_result("DVF Comparables", True, 
                                      "No comparables found (expected for test data)", data)
                    else:
                        self.log_result("DVF Comparables", False, 
                                      f"Found {count} comparables but missing stats")
                else:
                    self.log_result("DVF Comparables", False, "Missing required fields in response")
            else:
                self.log_result("DVF Comparables", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("DVF Comparables", False, f"Request failed: {str(e)}")
    
    def test_dvf_missing_params(self):
        """Test DVF comparables with missing parameters"""
        try:
            params = {'lat': TEST_LAT}  # Missing required params
            response = self.session.get(f"{API_BASE}/dvf/comparables", params=params)
            
            if response.status_code == 400:
                data = response.json()
                if 'error' in data:
                    self.log_result("DVF Error Handling", True, 
                                  f"Correctly returned 400 for missing params: {data['error']}")
                else:
                    self.log_result("DVF Error Handling", False, "Missing error message in 400 response")
            else:
                self.log_result("DVF Error Handling", False, 
                              f"Expected 400, got {response.status_code}")
                
        except Exception as e:
            self.log_result("DVF Error Handling", False, f"Request failed: {str(e)}")
    
    def test_admin_login_success(self):
        """Test POST /api/auth/login - Admin login with correct credentials"""
        try:
            payload = {
                'username': ADMIN_USERNAME,
                'password': ADMIN_PASSWORD
            }
            response = self.session.post(f"{API_BASE}/auth/login", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if 'token' in data and 'user' in data:
                    self.jwt_token = data['token']
                    self.log_result("Admin Login Success", True, 
                                  f"Login successful for user: {data['user']['username']}", 
                                  {'token_received': True, 'user': data['user']})
                else:
                    self.log_result("Admin Login Success", False, "Missing token or user in response")
            else:
                self.log_result("Admin Login Success", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Admin Login Success", False, f"Request failed: {str(e)}")
    
    def test_admin_login_failure(self):
        """Test POST /api/auth/login - Admin login with wrong credentials"""
        try:
            payload = {
                'username': 'wrong_user',
                'password': 'wrong_password'
            }
            response = self.session.post(f"{API_BASE}/auth/login", json=payload)
            
            if response.status_code == 401:
                data = response.json()
                if 'error' in data:
                    self.log_result("Admin Login Failure", True, 
                                  f"Correctly rejected invalid credentials: {data['error']}")
                else:
                    self.log_result("Admin Login Failure", False, "Missing error message in 401 response")
            else:
                self.log_result("Admin Login Failure", False, 
                              f"Expected 401, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Admin Login Failure", False, f"Request failed: {str(e)}")
    
    def test_full_estimation(self):
        """Test POST /api/estimate - Full estimation (DVF + Market)"""
        try:
            payload = {
                'address': TEST_ADDRESS,
                'lat': TEST_LAT,
                'lng': TEST_LNG,
                'type': TEST_TYPE,
                'surface': TEST_SURFACE
            }
            response = self.session.post(f"{API_BASE}/estimate", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['dvf', 'market', 'delta', 'estimatedValue']
                
                if all(field in data for field in required_fields):
                    dvf_count = data['dvf'].get('count', 0)
                    market_count = len(data['market'].get('listings', []))
                    estimated_value = data.get('estimatedValue')
                    
                    self.log_result("Full Estimation", True, 
                                  f"DVF: {dvf_count} comparables, Market: {market_count} listings, "
                                  f"Estimated: €{estimated_value or 'N/A'}", 
                                  data)
                else:
                    missing = [f for f in required_fields if f not in data]
                    self.log_result("Full Estimation", False, f"Missing fields: {missing}")
            else:
                self.log_result("Full Estimation", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Full Estimation", False, f"Request failed: {str(e)}")
    
    def test_estimation_missing_params(self):
        """Test estimation with missing parameters"""
        try:
            payload = {'address': TEST_ADDRESS}  # Missing required params
            response = self.session.post(f"{API_BASE}/estimate", json=payload)
            
            if response.status_code == 400:
                data = response.json()
                if 'error' in data:
                    self.log_result("Estimation Error Handling", True, 
                                  f"Correctly returned 400 for missing params: {data['error']}")
                else:
                    self.log_result("Estimation Error Handling", False, "Missing error message in 400 response")
            else:
                self.log_result("Estimation Error Handling", False, 
                              f"Expected 400, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Estimation Error Handling", False, f"Request failed: {str(e)}")
    
    def test_submit_lead(self):
        """Test POST /api/leads - Submit a lead"""
        try:
            payload = {
                'name': 'Jean Dupont',
                'email': 'jean.dupont@example.com',
                'phone': '+33123456789',
                'address': TEST_ADDRESS,
                'estimatedValue': 450000,
                'message': 'Interested in property estimation'
            }
            response = self.session.post(f"{API_BASE}/leads", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if 'success' in data and data['success'] and 'leadId' in data:
                    self.log_result("Submit Lead", True, 
                                  f"Lead submitted successfully with ID: {data['leadId']}", 
                                  data)
                else:
                    self.log_result("Submit Lead", False, "Missing success confirmation or leadId")
            else:
                self.log_result("Submit Lead", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Submit Lead", False, f"Request failed: {str(e)}")
    
    def test_get_leads_unauthorized(self):
        """Test GET /api/leads - Get leads without auth"""
        try:
            response = self.session.get(f"{API_BASE}/leads")
            
            if response.status_code == 401:
                data = response.json()
                if 'error' in data:
                    self.log_result("Get Leads Unauthorized", True, 
                                  f"Correctly rejected unauthorized request: {data['error']}")
                else:
                    self.log_result("Get Leads Unauthorized", False, "Missing error message in 401 response")
            else:
                self.log_result("Get Leads Unauthorized", False, 
                              f"Expected 401, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Get Leads Unauthorized", False, f"Request failed: {str(e)}")
    
    def test_get_leads_authorized(self):
        """Test GET /api/leads - Get leads with valid JWT token"""
        if not self.jwt_token:
            self.log_result("Get Leads Authorized", False, "No JWT token available (login test may have failed)")
            return
            
        try:
            headers = {'Authorization': f'Bearer {self.jwt_token}'}
            response = self.session.get(f"{API_BASE}/leads", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'leads' in data:
                    leads_count = len(data['leads'])
                    self.log_result("Get Leads Authorized", True, 
                                  f"Retrieved {leads_count} leads successfully", 
                                  {'leads_count': leads_count})
                else:
                    self.log_result("Get Leads Authorized", False, "Missing 'leads' field in response")
            else:
                self.log_result("Get Leads Authorized", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Get Leads Authorized", False, f"Request failed: {str(e)}")
    
    def test_invalid_endpoint(self):
        """Test invalid endpoint"""
        try:
            response = self.session.get(f"{API_BASE}/invalid-endpoint")
            
            if response.status_code == 404:
                data = response.json()
                if 'error' in data:
                    self.log_result("Invalid Endpoint", True, 
                                  f"Correctly returned 404 for invalid endpoint: {data['error']}")
                else:
                    self.log_result("Invalid Endpoint", False, "Missing error message in 404 response")
            else:
                self.log_result("Invalid Endpoint", False, 
                              f"Expected 404, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Invalid Endpoint", False, f"Request failed: {str(e)}")
    
    def run_all_tests(self):
        """Run all API tests"""
        print(f"🚀 Starting AlterEgo API Tests")
        print(f"📍 Base URL: {API_BASE}")
        print(f"⏰ Started at: {datetime.now().isoformat()}")
        print("=" * 60)
        
        # Core API tests
        self.test_health_check()
        self.test_geocoding()
        self.test_geocoding_missing_address()
        self.test_dvf_comparables()
        self.test_dvf_missing_params()
        
        # Authentication tests
        self.test_admin_login_success()
        self.test_admin_login_failure()
        
        # Estimation tests
        self.test_full_estimation()
        self.test_estimation_missing_params()
        
        # Lead management tests
        self.test_submit_lead()
        self.test_get_leads_unauthorized()
        self.test_get_leads_authorized()
        
        # Error handling tests
        self.test_invalid_endpoint()
        
        # Summary
        print("=" * 60)
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        total_tests = len(self.results)
        passed_tests = sum(1 for r in self.results if r['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"📊 TEST SUMMARY")
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print(f"\n🔍 FAILED TESTS:")
            for result in self.results:
                if not result['success']:
                    print(f"  • {result['test']}: {result['message']}")
        
        print(f"\n⏰ Completed at: {datetime.now().isoformat()}")

if __name__ == "__main__":
    tester = APITester()
    tester.run_all_tests()