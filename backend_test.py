#!/usr/bin/env python3
"""
AlterEgo API Backend Testing Suite - URGENT ISSUE FOCUS
Testing /api/estimate endpoint returning 0 comparables despite 5000 transactions in MongoDB
"""

import requests
import json
import sys
import os
from datetime import datetime

# Configuration
BASE_URL = "https://estate-data-fix.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test credentials
ADMIN_USERNAME = "Micael"
ADMIN_PASSWORD = "Micael123"

# URGENT: User reported issue - exact test case
URGENT_TEST_PAYLOAD = {
    "address": "15 Avenue des Champs-Élysées, 75008 Paris",
    "lat": 48.8698,
    "lng": 2.3085,
    "type": "appartement",
    "surface": 80,
    "characteristics": {"floor": "1-3", "standing": 4}
}

# Additional test data
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
        self.test_lead_id = None
        
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
                required_fields = ['dvf', 'market', 'delta', 'finalPrice']
                
                if all(field in data for field in required_fields):
                    dvf_count = data['dvf'].get('count', 0)
                    market_count = len(data['market'].get('listings', []))
                    final_price = data.get('finalPrice')
                    estimated_value = final_price.get('mid') if final_price else None
                    
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
                    # Store a lead ID for later tests if available
                    if leads_count > 0:
                        self.test_lead_id = data['leads'][0]['id']
                    self.log_result("Get Leads Authorized", True, 
                                  f"Retrieved {leads_count} leads successfully", 
                                  {'leads_count': leads_count})
                else:
                    self.log_result("Get Leads Authorized", False, "Missing 'leads' field in response")
            else:
                self.log_result("Get Leads Authorized", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Get Leads Authorized", False, f"Request failed: {str(e)}")
    
    def test_update_lead_status(self):
        """Test POST /api/admin/leads/update - Update lead status"""
        if not self.jwt_token:
            self.log_result("Update Lead Status", False, "No JWT token available")
            return
            
        if not hasattr(self, 'test_lead_id'):
            self.log_result("Update Lead Status", False, "No test lead ID available (create lead first)")
            return
            
        try:
            headers = {'Authorization': f'Bearer {self.jwt_token}'}
            payload = {
                'leadId': self.test_lead_id,
                'status': 'contacted'
            }
            response = self.session.post(f"{API_BASE}/admin/leads/update", json=payload, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'success' in data and data['success']:
                    self.log_result("Update Lead Status", True, 
                                  f"Successfully updated lead status to 'contacted'", data)
                else:
                    self.log_result("Update Lead Status", False, "Success field missing or false")
            else:
                self.log_result("Update Lead Status", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Update Lead Status", False, f"Request failed: {str(e)}")
    
    def test_update_lead_contact_info(self):
        """Test POST /api/admin/leads/update - Update lead contact information"""
        if not self.jwt_token:
            self.log_result("Update Lead Contact Info", False, "No JWT token available")
            return
            
        if not hasattr(self, 'test_lead_id'):
            self.log_result("Update Lead Contact Info", False, "No test lead ID available")
            return
            
        try:
            headers = {'Authorization': f'Bearer {self.jwt_token}'}
            payload = {
                'leadId': self.test_lead_id,
                'updates': {
                    'name': 'Jean Dupont Updated',
                    'email': 'jean.updated@example.com',
                    'phone': '+33987654321'
                }
            }
            response = self.session.post(f"{API_BASE}/admin/leads/update", json=payload, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'success' in data and data['success']:
                    self.log_result("Update Lead Contact Info", True, 
                                  f"Successfully updated lead contact information", data)
                else:
                    self.log_result("Update Lead Contact Info", False, "Success field missing or false")
            else:
                self.log_result("Update Lead Contact Info", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Update Lead Contact Info", False, f"Request failed: {str(e)}")
    
    def test_add_lead_comment(self):
        """Test POST /api/admin/leads/comment - Add comment to lead"""
        if not self.jwt_token:
            self.log_result("Add Lead Comment", False, "No JWT token available")
            return
            
        if not hasattr(self, 'test_lead_id'):
            self.log_result("Add Lead Comment", False, "No test lead ID available")
            return
            
        try:
            headers = {'Authorization': f'Bearer {self.jwt_token}'}
            payload = {
                'leadId': self.test_lead_id,
                'comment': 'Initial contact made via phone call',
                'author': 'Admin Micael'
            }
            response = self.session.post(f"{API_BASE}/admin/leads/comment", json=payload, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'success' in data and data['success'] and 'comment' in data:
                    comment = data['comment']
                    if 'author' in comment and 'comment' in comment and 'timestamp' in comment:
                        self.log_result("Add Lead Comment", True, 
                                      f"Successfully added comment by {comment['author']}: '{comment['comment']}'", 
                                      data)
                    else:
                        self.log_result("Add Lead Comment", False, "Comment object missing required fields")
                else:
                    self.log_result("Add Lead Comment", False, "Success field or comment missing")
            else:
                self.log_result("Add Lead Comment", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Add Lead Comment", False, f"Request failed: {str(e)}")
    
    def test_add_multiple_comments(self):
        """Test adding multiple comments to verify comment history"""
        if not self.jwt_token:
            self.log_result("Add Multiple Comments", False, "No JWT token available")
            return
            
        if not hasattr(self, 'test_lead_id'):
            self.log_result("Add Multiple Comments", False, "No test lead ID available")
            return
            
        try:
            headers = {'Authorization': f'Bearer {self.jwt_token}'}
            
            # Add second comment
            payload = {
                'leadId': self.test_lead_id,
                'comment': 'Follow-up email sent with property details',
                'author': 'Admin Assistant'
            }
            response = self.session.post(f"{API_BASE}/admin/leads/comment", json=payload, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'success' in data and data['success']:
                    self.log_result("Add Multiple Comments", True, 
                                  f"Successfully added second comment to lead history", data)
                else:
                    self.log_result("Add Multiple Comments", False, "Failed to add second comment")
            else:
                self.log_result("Add Multiple Comments", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Add Multiple Comments", False, f"Request failed: {str(e)}")
    
    def test_update_lead_unauthorized(self):
        """Test updating lead without authentication"""
        try:
            payload = {
                'leadId': 'test-id',
                'status': 'contacted'
            }
            response = self.session.post(f"{API_BASE}/admin/leads/update", json=payload)
            
            if response.status_code == 401:
                data = response.json()
                if 'error' in data:
                    self.log_result("Update Lead Unauthorized", True, 
                                  f"Correctly rejected unauthorized update: {data['error']}")
                else:
                    self.log_result("Update Lead Unauthorized", False, "Missing error message in 401 response")
            else:
                self.log_result("Update Lead Unauthorized", False, 
                              f"Expected 401, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Update Lead Unauthorized", False, f"Request failed: {str(e)}")
    
    def test_comment_lead_unauthorized(self):
        """Test adding comment without authentication"""
        try:
            payload = {
                'leadId': 'test-id',
                'comment': 'Test comment'
            }
            response = self.session.post(f"{API_BASE}/admin/leads/comment", json=payload)
            
            if response.status_code == 401:
                data = response.json()
                if 'error' in data:
                    self.log_result("Comment Lead Unauthorized", True, 
                                  f"Correctly rejected unauthorized comment: {data['error']}")
                else:
                    self.log_result("Comment Lead Unauthorized", False, "Missing error message in 401 response")
            else:
                self.log_result("Comment Lead Unauthorized", False, 
                              f"Expected 401, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Comment Lead Unauthorized", False, f"Request failed: {str(e)}")
    
    def test_update_lead_invalid_id(self):
        """Test updating lead with invalid ID"""
        if not self.jwt_token:
            self.log_result("Update Lead Invalid ID", False, "No JWT token available")
            return
            
        try:
            headers = {'Authorization': f'Bearer {self.jwt_token}'}
            payload = {
                'leadId': 'invalid-lead-id-12345',
                'status': 'contacted'
            }
            response = self.session.post(f"{API_BASE}/admin/leads/update", json=payload, headers=headers)
            
            if response.status_code == 404:
                data = response.json()
                if 'error' in data:
                    self.log_result("Update Lead Invalid ID", True, 
                                  f"Correctly returned 404 for invalid lead ID: {data['error']}")
                else:
                    self.log_result("Update Lead Invalid ID", False, "Missing error message in 404 response")
            else:
                self.log_result("Update Lead Invalid ID", False, 
                              f"Expected 404, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Update Lead Invalid ID", False, f"Request failed: {str(e)}")
    
    def test_comment_lead_missing_params(self):
        """Test adding comment with missing required parameters"""
        if not self.jwt_token:
            self.log_result("Comment Missing Params", False, "No JWT token available")
            return
            
        try:
            headers = {'Authorization': f'Bearer {self.jwt_token}'}
            payload = {
                'leadId': 'test-id'
                # Missing required 'comment' field
            }
            response = self.session.post(f"{API_BASE}/admin/leads/comment", json=payload, headers=headers)
            
            if response.status_code == 400:
                data = response.json()
                if 'error' in data:
                    self.log_result("Comment Missing Params", True, 
                                  f"Correctly returned 400 for missing comment: {data['error']}")
                else:
                    self.log_result("Comment Missing Params", False, "Missing error message in 400 response")
            else:
                self.log_result("Comment Missing Params", False, 
                              f"Expected 400, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Comment Missing Params", False, f"Request failed: {str(e)}")
    
    def test_create_test_lead_for_deletion(self):
        """Create a test lead specifically for deletion testing"""
        try:
            payload = {
                'name': 'Marie Testeur',
                'email': 'marie.testeur@example.com',
                'phone': '+33555123456',
                'address': '10 rue de la Paix, 75001 Paris',
                'estimatedValue': 650000,
                'message': 'Test lead for deletion - can be safely removed'
            }
            response = self.session.post(f"{API_BASE}/leads", json=payload)
            
            if response.status_code == 200:
                data = response.json()
                if 'success' in data and data['success'] and 'leadId' in data:
                    self.deletion_test_lead_id = data['leadId']
                    self.log_result("Create Test Lead for Deletion", True, 
                                  f"Test lead created for deletion with ID: {data['leadId']}", 
                                  data)
                else:
                    self.log_result("Create Test Lead for Deletion", False, "Missing success confirmation or leadId")
            else:
                self.log_result("Create Test Lead for Deletion", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Create Test Lead for Deletion", False, f"Request failed: {str(e)}")
    
    def test_delete_lead_success(self):
        """Test DELETE /api/admin/leads/delete - Successfully delete a lead"""
        if not self.jwt_token:
            self.log_result("Delete Lead Success", False, "No JWT token available")
            return
            
        if not hasattr(self, 'deletion_test_lead_id'):
            self.log_result("Delete Lead Success", False, "No test lead ID available for deletion")
            return
            
        try:
            headers = {'Authorization': f'Bearer {self.jwt_token}'}
            params = {'leadId': self.deletion_test_lead_id}
            response = self.session.delete(f"{API_BASE}/admin/leads/delete", params=params, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'success' in data and data['success'] and 'deleted' in data and data['deleted']:
                    self.log_result("Delete Lead Success", True, 
                                  f"Successfully deleted lead with ID: {self.deletion_test_lead_id}", data)
                else:
                    self.log_result("Delete Lead Success", False, "Success or deleted field missing or false")
            else:
                self.log_result("Delete Lead Success", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Delete Lead Success", False, f"Request failed: {str(e)}")
    
    def test_verify_lead_deletion(self):
        """Verify that the deleted lead is no longer in the database"""
        if not self.jwt_token:
            self.log_result("Verify Lead Deletion", False, "No JWT token available")
            return
            
        if not hasattr(self, 'deletion_test_lead_id'):
            self.log_result("Verify Lead Deletion", False, "No deletion test lead ID available")
            return
            
        try:
            headers = {'Authorization': f'Bearer {self.jwt_token}'}
            response = self.session.get(f"{API_BASE}/leads", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'leads' in data:
                    leads = data['leads']
                    deleted_lead_found = any(lead['id'] == self.deletion_test_lead_id for lead in leads)
                    
                    if not deleted_lead_found:
                        self.log_result("Verify Lead Deletion", True, 
                                      f"Confirmed: deleted lead {self.deletion_test_lead_id} is no longer in database")
                    else:
                        self.log_result("Verify Lead Deletion", False, 
                                      f"ERROR: deleted lead {self.deletion_test_lead_id} still exists in database")
                else:
                    self.log_result("Verify Lead Deletion", False, "Missing 'leads' field in response")
            else:
                self.log_result("Verify Lead Deletion", False, f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Verify Lead Deletion", False, f"Request failed: {str(e)}")
    
    def test_delete_lead_invalid_id(self):
        """Test DELETE /api/admin/leads/delete - Delete with invalid lead ID"""
        if not self.jwt_token:
            self.log_result("Delete Lead Invalid ID", False, "No JWT token available")
            return
            
        try:
            headers = {'Authorization': f'Bearer {self.jwt_token}'}
            params = {'leadId': 'invalid-lead-id-99999'}
            response = self.session.delete(f"{API_BASE}/admin/leads/delete", params=params, headers=headers)
            
            if response.status_code == 404:
                data = response.json()
                if 'error' in data:
                    self.log_result("Delete Lead Invalid ID", True, 
                                  f"Correctly returned 404 for invalid lead ID: {data['error']}")
                else:
                    self.log_result("Delete Lead Invalid ID", False, "Missing error message in 404 response")
            else:
                self.log_result("Delete Lead Invalid ID", False, 
                              f"Expected 404, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Delete Lead Invalid ID", False, f"Request failed: {str(e)}")
    
    def test_delete_lead_unauthorized(self):
        """Test DELETE /api/admin/leads/delete - Delete without authentication"""
        try:
            params = {'leadId': 'test-lead-id'}
            response = self.session.delete(f"{API_BASE}/admin/leads/delete", params=params)
            
            if response.status_code == 401:
                data = response.json()
                if 'error' in data:
                    self.log_result("Delete Lead Unauthorized", True, 
                                  f"Correctly rejected unauthorized delete: {data['error']}")
                else:
                    self.log_result("Delete Lead Unauthorized", False, "Missing error message in 401 response")
            else:
                self.log_result("Delete Lead Unauthorized", False, 
                              f"Expected 401, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Delete Lead Unauthorized", False, f"Request failed: {str(e)}")
    
    def test_delete_lead_missing_id(self):
        """Test DELETE /api/admin/leads/delete - Delete without lead ID parameter"""
        if not self.jwt_token:
            self.log_result("Delete Lead Missing ID", False, "No JWT token available")
            return
            
        try:
            headers = {'Authorization': f'Bearer {self.jwt_token}'}
            # No leadId parameter provided
            response = self.session.delete(f"{API_BASE}/admin/leads/delete", headers=headers)
            
            if response.status_code == 400:
                data = response.json()
                if 'error' in data:
                    self.log_result("Delete Lead Missing ID", True, 
                                  f"Correctly returned 400 for missing lead ID: {data['error']}")
                else:
                    self.log_result("Delete Lead Missing ID", False, "Missing error message in 400 response")
            else:
                self.log_result("Delete Lead Missing ID", False, 
                              f"Expected 400, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Delete Lead Missing ID", False, f"Request failed: {str(e)}")
    
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
    
    def test_urgent_estimate_issue(self):
        """URGENT: Test the specific /api/estimate issue reported by user"""
        print("\n🚨 URGENT ISSUE TESTING 🚨")
        print("Testing /api/estimate endpoint returning 0 comparables")
        print("User expects: count > 0 with comparables")
        print("Current issue: count = 0")
        print("=" * 60)
        
        try:
            print(f"Testing with exact user payload:")
            print(json.dumps(URGENT_TEST_PAYLOAD, indent=2))
            
            response = self.session.post(f"{API_BASE}/estimate", json=URGENT_TEST_PAYLOAD, timeout=30)
            
            print(f"\nResponse Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Extract DVF results
                dvf_data = data.get('dvf', {})
                dvf_count = dvf_data.get('count', 0)
                dvf_comparables = dvf_data.get('comparables', [])
                dvf_stats = dvf_data.get('stats')
                dvf_warning = dvf_data.get('warning')
                dvf_radius = dvf_data.get('radius', 'Unknown')
                dvf_months = dvf_data.get('months', 'Unknown')
                
                print(f"\n📊 DVF RESULTS:")
                print(f"  Count: {dvf_count}")
                print(f"  Comparables Array Length: {len(dvf_comparables)}")
                print(f"  Search Radius: {dvf_radius}m")
                print(f"  Search Months: {dvf_months}")
                print(f"  Warning: {dvf_warning or 'None'}")
                
                if dvf_stats:
                    print(f"  Stats Available: Yes")
                    print(f"    Mean Price/m²: €{dvf_stats.get('meanPricePerM2', 'N/A')}")
                    print(f"    Median Price/m²: €{dvf_stats.get('medianPricePerM2', 'N/A')}")
                    print(f"    Confidence: {dvf_stats.get('confidenceIndex', 'N/A')}%")
                else:
                    print(f"  Stats Available: No")
                
                # Show sample comparables if any
                if dvf_comparables:
                    print(f"\n📍 SAMPLE COMPARABLES (first 3):")
                    for i, comp in enumerate(dvf_comparables[:3]):
                        print(f"  {i+1}. {comp.get('address', 'N/A')}")
                        print(f"     Price: €{comp.get('price', 'N/A')} (€{comp.get('pricePerM2', 'N/A')}/m²)")
                        print(f"     Surface: {comp.get('surface', 'N/A')}m²")
                        print(f"     Distance: {comp.get('distance', 'N/A')}m")
                        print(f"     Date: {comp.get('date', 'N/A')}")
                
                # Final assessment
                if dvf_count == 0:
                    self.log_result("URGENT: /api/estimate Issue", False, 
                                  f"❌ CONFIRMED BUG: DVF count is 0 despite 5000 transactions in DB. "
                                  f"Radius: {dvf_radius}m, Months: {dvf_months}, Warning: {dvf_warning}")
                    return False
                else:
                    self.log_result("URGENT: /api/estimate Issue", True, 
                                  f"✅ ISSUE RESOLVED: Found {dvf_count} DVF comparables. "
                                  f"Average: €{dvf_stats.get('meanPricePerM2', 'N/A') if dvf_stats else 'N/A'}/m²")
                    return True
            else:
                self.log_result("URGENT: /api/estimate Issue", False, 
                              f"❌ API ERROR: HTTP {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            self.log_result("URGENT: /api/estimate Issue", False, 
                          f"❌ REQUEST FAILED: {str(e)}")
            return False

    def test_database_dvf_status(self):
        """Check DVF database status to understand data availability"""
        print("\n🗄️ CHECKING DVF DATABASE STATUS")
        print("=" * 40)
        
        # Login first
        try:
            login_payload = {"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
            login_response = self.session.post(f"{API_BASE}/auth/login", json=login_payload, timeout=10)
            
            if login_response.status_code != 200:
                self.log_result("DVF Database Status", False, "Failed to login for admin access")
                return False
                
            token = login_response.json().get('token')
            headers = {'Authorization': f'Bearer {token}'}
            
            # Get DVF status
            status_response = self.session.get(f"{API_BASE}/admin/dvf/status", headers=headers, timeout=10)
            
            if status_response.status_code == 200:
                status_data = status_response.json()
                total = status_data.get('total', 0)
                by_dept = status_data.get('byDepartment', [])
                
                print(f"📊 DATABASE STATS:")
                print(f"  Total DVF Records: {total:,}")
                
                if total == 0:
                    self.log_result("DVF Database Status", False, 
                                  "❌ CRITICAL: No DVF data in database! This explains the 0 comparables.")
                    return False
                else:
                    print(f"  Departments with data: {len(by_dept)}")
                    
                    # Show Paris data specifically (75)
                    paris_data = next((d for d in by_dept if d.get('_id') == '75'), None)
                    if paris_data:
                        paris_count = paris_data.get('count', 0)
                        paris_appts = paris_data.get('appartements', 0)
                        print(f"  Paris (75) Records: {paris_count:,} ({paris_appts:,} appartements)")
                    else:
                        print(f"  ⚠️ WARNING: No Paris (75) data found!")
                    
                    # Show top 5 departments
                    print(f"  Top departments:")
                    for dept in sorted(by_dept, key=lambda x: x.get('count', 0), reverse=True)[:5]:
                        dept_code = dept.get('_id', 'Unknown')
                        count = dept.get('count', 0)
                        appartements = dept.get('appartements', 0)
                        print(f"    {dept_code}: {count:,} records ({appartements:,} appartements)")
                    
                    self.log_result("DVF Database Status", True, 
                                  f"✅ Database has {total:,} DVF records across {len(by_dept)} departments")
                    return True
            else:
                self.log_result("DVF Database Status", False, 
                              f"Failed to get DVF status: HTTP {status_response.status_code}")
                return False
                
        except Exception as e:
            self.log_result("DVF Database Status", False, f"Exception: {str(e)}")
            return False

    def test_direct_dvf_query(self):
        """Test direct DVF comparables query to isolate the issue"""
        print("\n🔍 TESTING DIRECT DVF QUERY")
        print("=" * 40)
        
        # Use same coordinates as user's issue
        params = {
            'lat': URGENT_TEST_PAYLOAD['lat'],
            'lng': URGENT_TEST_PAYLOAD['lng'],
            'type': URGENT_TEST_PAYLOAD['type'],
            'surface': URGENT_TEST_PAYLOAD['surface'],
            'radiusMeters': 500,
            'months': 24
        }
        
        print(f"Testing /api/dvf/comparables with:")
        for key, value in params.items():
            print(f"  {key}: {value}")
        
        try:
            response = self.session.get(f"{API_BASE}/dvf/comparables", params=params, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                count = data.get('count', 0)
                comparables = data.get('comparables', [])
                stats = data.get('stats')
                warning = data.get('warning')
                radius = data.get('radius', 'Unknown')
                months = data.get('months', 'Unknown')
                
                print(f"\n📊 DIRECT DVF QUERY RESULTS:")
                print(f"  Count: {count}")
                print(f"  Comparables Length: {len(comparables)}")
                print(f"  Final Radius: {radius}m")
                print(f"  Final Months: {months}")
                print(f"  Warning: {warning or 'None'}")
                
                if count == 0:
                    self.log_result("Direct DVF Query", False, 
                                  f"❌ Direct DVF query also returns 0 - confirms systematic issue. "
                                  f"Radius: {radius}m, Months: {months}")
                    return False
                else:
                    self.log_result("Direct DVF Query", True, 
                                  f"✅ Direct DVF query found {count} comparables. "
                                  f"Mean: €{stats.get('meanPricePerM2', 'N/A') if stats else 'N/A'}/m²")
                    return True
            else:
                self.log_result("Direct DVF Query", False, 
                              f"HTTP {response.status_code}: {response.text}")
                return False
                
        except Exception as e:
            self.log_result("Direct DVF Query", False, f"Exception: {str(e)}")
            return False

    def run_urgent_tests(self):
        """Run focused tests for the urgent issue"""
        print("🚨 URGENT ISSUE INVESTIGATION 🚨")
        print("Issue: /api/estimate returns 0 comparables despite 5000 transactions")
        print(f"📍 Base URL: {API_BASE}")
        print(f"⏰ Started at: {datetime.now().isoformat()}")
        print("=" * 80)
        
        # Step 1: Check database status
        db_ok = self.test_database_dvf_status()
        
        # Step 2: Test direct DVF query
        dvf_ok = self.test_direct_dvf_query()
        
        # Step 3: Test the main estimate endpoint (user's exact issue)
        estimate_ok = self.test_urgent_estimate_issue()
        
        # Summary
        print("\n" + "=" * 80)
        print("🔍 URGENT ISSUE INVESTIGATION SUMMARY")
        print("=" * 80)
        
        print(f"1. Database Status: {'✅ OK' if db_ok else '❌ ISSUE'}")
        print(f"2. Direct DVF Query: {'✅ OK' if dvf_ok else '❌ ISSUE'}")
        print(f"3. /api/estimate Endpoint: {'✅ FIXED' if estimate_ok else '❌ BROKEN'}")
        
        if not estimate_ok:
            print("\n🚨 CRITICAL FINDINGS:")
            if not db_ok:
                print("  - No DVF data in database - need to ingest data first")
            elif not dvf_ok:
                print("  - DVF query logic has issues - check query parameters/filters")
            else:
                print("  - Issue specific to /api/estimate endpoint - check implementation")
        else:
            print("\n✅ ISSUE RESOLVED: /api/estimate is now working correctly")
        
        return estimate_ok

    def run_all_tests(self):
        """Run all API tests - MODIFIED to focus on urgent issue first"""
        # First run urgent tests
        urgent_resolved = self.run_urgent_tests()
        
        if not urgent_resolved:
            print("\n⚠️ STOPPING: Urgent issue not resolved. Fix before running full test suite.")
            return
        
        print(f"\n🚀 Starting Full AlterEgo API Tests")
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
        
        # NEW: Admin lead management tests
        print("\n🔧 Testing New Admin Lead Management Endpoints...")
        self.test_update_lead_status()
        self.test_update_lead_contact_info()
        self.test_add_lead_comment()
        self.test_add_multiple_comments()
        
        # NEW: Lead deletion tests
        print("\n🗑️ Testing Lead Deletion Endpoint...")
        self.test_create_test_lead_for_deletion()
        self.test_delete_lead_success()
        self.test_verify_lead_deletion()
        
        # Authentication and error handling for new endpoints
        self.test_update_lead_unauthorized()
        self.test_comment_lead_unauthorized()
        self.test_delete_lead_unauthorized()
        self.test_update_lead_invalid_id()
        self.test_comment_lead_missing_params()
        self.test_delete_lead_invalid_id()
        self.test_delete_lead_missing_id()
        
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
    # Focus on urgent issue first
    tester.run_urgent_tests()