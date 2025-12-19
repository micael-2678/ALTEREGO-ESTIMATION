#!/usr/bin/env python3
"""
Comprehensive Backend Testing for SMS OTP Verification System
Tests the three OTP endpoints: send-otp, verify-otp, resend-otp
"""

import requests
import json
import time
import sys
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:3000"
API_BASE = f"{BASE_URL}/api"

# Test phone numbers
VALID_FRENCH_PHONE = "06 12 34 56 78"
BYPASS_PHONE = "0698793430"
INVALID_PHONE = "123456789"

# Colors for output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def log(message, color=Colors.ENDC):
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"{color}[{timestamp}] {message}{Colors.ENDC}")

def test_result(test_name, success, details=""):
    status = "✅ PASS" if success else "❌ FAIL"
    color = Colors.GREEN if success else Colors.RED
    log(f"{status} {test_name}", color)
    if details:
        log(f"    {details}", Colors.BLUE)
    return success

def make_request(method, endpoint, data=None, headers=None):
    """Make HTTP request with error handling"""
    url = f"{API_BASE}{endpoint}"
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=10)
        elif method == "POST":
            response = requests.post(url, json=data, headers=headers, timeout=10)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, timeout=10)
        
        return {
            'success': True,
            'status_code': response.status_code,
            'data': response.json() if response.content else {},
            'response': response
        }
    except requests.exceptions.RequestException as e:
        return {
            'success': False,
            'error': str(e),
            'status_code': None,
            'data': {}
        }
    except json.JSONDecodeError as e:
        return {
            'success': False,
            'error': f"JSON decode error: {str(e)}",
            'status_code': response.status_code if 'response' in locals() else None,
            'data': {}
        }

def test_send_otp_endpoint():
    """Test POST /api/verification/send-otp endpoint"""
    log("🧪 Testing SMS OTP Send API", Colors.BOLD)
    results = []
    
    # Test 1: Valid French phone number
    log("Test 1: Valid French phone number")
    result = make_request("POST", "/verification/send-otp", {"phone": VALID_FRENCH_PHONE})
    if result['success'] and result['status_code'] == 200:
        data = result['data']
        success = data.get('success') == True and 'message' in data and 'expiresInSeconds' in data
        results.append(test_result("Valid French phone", success, 
                                 f"Response: {json.dumps(data, indent=2)}"))
    else:
        results.append(test_result("Valid French phone", False, 
                                 f"Request failed: {result.get('error', 'Unknown error')}"))
    
    # Test 2: Bypass phone number
    log("Test 2: Bypass phone number (0698793430)")
    result = make_request("POST", "/verification/send-otp", {"phone": BYPASS_PHONE})
    if result['success'] and result['status_code'] == 200:
        data = result['data']
        success = data.get('success') == True and data.get('bypass') == True
        results.append(test_result("Bypass phone number", success, 
                                 f"Response: {json.dumps(data, indent=2)}"))
    else:
        results.append(test_result("Bypass phone number", False, 
                                 f"Request failed: {result.get('error', 'Unknown error')}"))
    
    # Test 3: Different phone formats
    log("Test 3: Different phone formats")
    formats = [
        "0612345678",
        "+33612345678", 
        "06 12 34 56 78"
    ]
    
    for phone_format in formats:
        result = make_request("POST", "/verification/send-otp", {"phone": phone_format})
        if result['success'] and result['status_code'] == 200:
            data = result['data']
            success = data.get('success') == True
            results.append(test_result(f"Format: {phone_format}", success, 
                                     f"Normalized and accepted"))
        else:
            results.append(test_result(f"Format: {phone_format}", False, 
                                     f"Status: {result['status_code']}, Error: {result.get('error')}"))
    
    # Test 4: Invalid phone format
    log("Test 4: Invalid phone format")
    result = make_request("POST", "/verification/send-otp", {"phone": INVALID_PHONE})
    success = result['success'] and result['status_code'] == 400
    if success:
        data = result['data']
        success = 'error' in data and 'Invalid French phone number' in data['error']
    results.append(test_result("Invalid phone format", success, 
                             f"Status: {result['status_code']}, Response: {result['data']}"))
    
    # Test 5: Missing phone number
    log("Test 5: Missing phone number")
    result = make_request("POST", "/verification/send-otp", {})
    success = result['success'] and result['status_code'] == 400
    if success:
        data = result['data']
        success = 'error' in data and 'required' in data['error'].lower()
    results.append(test_result("Missing phone number", success, 
                             f"Status: {result['status_code']}, Response: {result['data']}"))
    
    # Test 6: Rate limiting (send twice quickly)
    log("Test 6: Rate limiting test")
    # First send
    result1 = make_request("POST", "/verification/send-otp", {"phone": "06 11 22 33 44"})
    time.sleep(1)  # Wait 1 second
    # Second send (should be rate limited)
    result2 = make_request("POST", "/verification/send-otp", {"phone": "06 11 22 33 44"})
    
    if result2['success'] and result2['status_code'] == 429:
        data = result2['data']
        success = 'error' in data and '30 seconds' in data['error']
        results.append(test_result("Rate limiting", success, 
                                 f"Correctly blocked with 429: {data['error']}"))
    else:
        results.append(test_result("Rate limiting", False, 
                                 f"Expected 429, got {result2['status_code']}: {result2['data']}"))
    
    return results

def test_verify_otp_endpoint():
    """Test POST /api/verification/verify-otp endpoint"""
    log("🧪 Testing SMS OTP Verify API", Colors.BOLD)
    results = []
    
    # Test 1: Bypass phone with any code
    log("Test 1: Bypass phone verification")
    result = make_request("POST", "/verification/verify-otp", {
        "phone": BYPASS_PHONE, 
        "code": "123456"
    })
    if result['success'] and result['status_code'] == 200:
        data = result['data']
        success = data.get('success') == True and data.get('verified') == True and data.get('bypass') == True
        results.append(test_result("Bypass phone verification", success, 
                                 f"Response: {json.dumps(data, indent=2)}"))
    else:
        results.append(test_result("Bypass phone verification", False, 
                                 f"Request failed: {result.get('error', 'Unknown error')}"))
    
    # Test 2: Missing parameters
    log("Test 2: Missing phone parameter")
    result = make_request("POST", "/verification/verify-otp", {"code": "123456"})
    success = result['success'] and result['status_code'] == 400
    if success:
        data = result['data']
        success = 'error' in data and 'required' in data['error'].lower()
    results.append(test_result("Missing phone parameter", success, 
                             f"Status: {result['status_code']}, Response: {result['data']}"))
    
    # Test 3: Missing code parameter
    log("Test 3: Missing code parameter")
    result = make_request("POST", "/verification/verify-otp", {"phone": VALID_FRENCH_PHONE})
    success = result['success'] and result['status_code'] == 400
    if success:
        data = result['data']
        success = 'error' in data and 'required' in data['error'].lower()
    results.append(test_result("Missing code parameter", success, 
                             f"Status: {result['status_code']}, Response: {result['data']}"))
    
    # Test 4: Non-existent phone number
    log("Test 4: Non-existent phone number")
    result = make_request("POST", "/verification/verify-otp", {
        "phone": "06 99 88 77 66", 
        "code": "123456"
    })
    success = result['success'] and result['status_code'] == 404
    if success:
        data = result['data']
        success = 'error' in data and 'No pending verification' in data['error']
    results.append(test_result("Non-existent phone number", success, 
                             f"Status: {result['status_code']}, Response: {result['data']}"))
    
    # Test 5: Wrong code (if we have a real OTP)
    log("Test 5: Testing wrong code scenario")
    # First, send an OTP to a test number
    send_result = make_request("POST", "/verification/send-otp", {"phone": "06 55 44 33 22"})
    if send_result['success'] and send_result['status_code'] == 200:
        # Try with wrong code
        verify_result = make_request("POST", "/verification/verify-otp", {
            "phone": "06 55 44 33 22", 
            "code": "000000"
        })
        if verify_result['success'] and verify_result['status_code'] == 400:
            data = verify_result['data']
            success = 'error' in data and 'Invalid verification code' in data['error'] and 'attemptsRemaining' in data
            results.append(test_result("Wrong code with attempts tracking", success, 
                                     f"Response: {json.dumps(data, indent=2)}"))
        else:
            results.append(test_result("Wrong code with attempts tracking", False, 
                                     f"Status: {verify_result['status_code']}, Response: {verify_result['data']}"))
    else:
        results.append(test_result("Wrong code with attempts tracking", False, 
                                 "Could not send initial OTP for testing"))
    
    return results

def test_resend_otp_endpoint():
    """Test POST /api/verification/resend-otp endpoint"""
    log("🧪 Testing SMS OTP Resend API", Colors.BOLD)
    results = []
    
    # Test 1: Bypass phone number
    log("Test 1: Bypass phone resend")
    result = make_request("POST", "/verification/resend-otp", {"phone": BYPASS_PHONE})
    if result['success'] and result['status_code'] == 200:
        data = result['data']
        success = data.get('success') == True and data.get('bypass') == True
        results.append(test_result("Bypass phone resend", success, 
                                 f"Response: {json.dumps(data, indent=2)}"))
    else:
        results.append(test_result("Bypass phone resend", False, 
                                 f"Request failed: {result.get('error', 'Unknown error')}"))
    
    # Test 2: Missing phone number
    log("Test 2: Missing phone number")
    result = make_request("POST", "/verification/resend-otp", {})
    success = result['success'] and result['status_code'] == 400
    if success:
        data = result['data']
        success = 'error' in data and 'required' in data['error'].lower()
    results.append(test_result("Missing phone number", success, 
                             f"Status: {result['status_code']}, Response: {result['data']}"))
    
    # Test 3: Cooldown enforcement
    log("Test 3: Cooldown enforcement")
    # Send initial OTP
    result1 = make_request("POST", "/verification/send-otp", {"phone": "06 77 88 99 00"})
    time.sleep(1)  # Wait 1 second (less than 30s cooldown)
    # Try to resend immediately
    result2 = make_request("POST", "/verification/resend-otp", {"phone": "06 77 88 99 00"})
    
    if result2['success'] and result2['status_code'] == 429:
        data = result2['data']
        success = 'error' in data and '30 seconds' in data['error']
        results.append(test_result("Cooldown enforcement", success, 
                                 f"Correctly blocked with 429: {data['error']}"))
    else:
        results.append(test_result("Cooldown enforcement", False, 
                                 f"Expected 429, got {result2['status_code']}: {result2['data']}"))
    
    # Test 4: Successful resend after cooldown (simulated)
    log("Test 4: Valid resend request")
    result = make_request("POST", "/verification/resend-otp", {"phone": "06 33 22 11 00"})
    if result['success']:
        if result['status_code'] == 200:
            data = result['data']
            success = data.get('success') == True and 'message' in data
            results.append(test_result("Valid resend request", success, 
                                     f"Response: {json.dumps(data, indent=2)}"))
        elif result['status_code'] == 429:
            # This is also acceptable if there's still a cooldown
            results.append(test_result("Valid resend request", True, 
                                     f"Rate limited (expected): {result['data']}"))
        else:
            results.append(test_result("Valid resend request", False, 
                                     f"Unexpected status: {result['status_code']}, Response: {result['data']}"))
    else:
        results.append(test_result("Valid resend request", False, 
                                 f"Request failed: {result.get('error', 'Unknown error')}"))
    
    return results

def test_brevo_integration():
    """Test Brevo SMS integration by checking logs and responses"""
    log("🧪 Testing Brevo SMS Integration", Colors.BOLD)
    results = []
    
    # Test with a real French number to see if Brevo API is working
    log("Test: Brevo SMS API integration")
    result = make_request("POST", "/verification/send-otp", {"phone": "06 12 34 56 78"})
    
    if result['success'] and result['status_code'] == 200:
        data = result['data']
        if data.get('success') == True and not data.get('bypass'):
            # Check if the response indicates successful SMS sending
            success = 'message' in data and 'sent successfully' in data['message']
            results.append(test_result("Brevo SMS API integration", success, 
                                     f"SMS sending response: {json.dumps(data, indent=2)}"))
        else:
            results.append(test_result("Brevo SMS API integration", False, 
                                     f"Unexpected response format: {json.dumps(data, indent=2)}"))
    elif result['success'] and result['status_code'] == 500:
        # Check if it's a configuration error
        data = result['data']
        if 'Configuration error' in data.get('error', ''):
            results.append(test_result("Brevo SMS API integration", False, 
                                     "Brevo API key not configured properly"))
        else:
            results.append(test_result("Brevo SMS API integration", False, 
                                     f"SMS sending failed: {data.get('error', 'Unknown error')}"))
    else:
        results.append(test_result("Brevo SMS API integration", False, 
                                 f"Request failed: {result.get('error', 'Unknown error')}"))
    
    return results

def test_mongodb_storage():
    """Test MongoDB storage and TTL indexes"""
    log("🧪 Testing MongoDB Storage", Colors.BOLD)
    results = []
    
    # Send an OTP and verify it gets stored
    log("Test: OTP storage in MongoDB")
    result = make_request("POST", "/verification/send-otp", {"phone": "06 11 11 11 11"})
    
    if result['success'] and result['status_code'] == 200:
        data = result['data']
        if data.get('success') == True and not data.get('bypass'):
            # Try to verify with wrong code to check if record exists
            verify_result = make_request("POST", "/verification/verify-otp", {
                "phone": "06 11 11 11 11", 
                "code": "000000"
            })
            
            if verify_result['success'] and verify_result['status_code'] == 400:
                verify_data = verify_result['data']
                if 'Invalid verification code' in verify_data.get('error', ''):
                    results.append(test_result("OTP storage in MongoDB", True, 
                                             "OTP record found in database (wrong code rejected)"))
                else:
                    results.append(test_result("OTP storage in MongoDB", False, 
                                             f"Unexpected error: {verify_data.get('error')}"))
            elif verify_result['success'] and verify_result['status_code'] == 404:
                results.append(test_result("OTP storage in MongoDB", False, 
                                         "OTP record not found in database"))
            else:
                results.append(test_result("OTP storage in MongoDB", False, 
                                         f"Verification request failed: {verify_result.get('error')}"))
        else:
            results.append(test_result("OTP storage in MongoDB", True, 
                                     "Bypass number - no storage needed"))
    else:
        results.append(test_result("OTP storage in MongoDB", False, 
                                 f"Could not send OTP: {result.get('error', 'Unknown error')}"))
    
    return results

def run_comprehensive_tests():
    """Run all SMS OTP verification tests"""
    log("🚀 Starting Comprehensive SMS OTP Verification Testing", Colors.BOLD)
    log(f"Base URL: {BASE_URL}", Colors.BLUE)
    log(f"API Base: {API_BASE}", Colors.BLUE)
    
    all_results = []
    
    # Test each endpoint
    all_results.extend(test_send_otp_endpoint())
    print()
    all_results.extend(test_verify_otp_endpoint())
    print()
    all_results.extend(test_resend_otp_endpoint())
    print()
    all_results.extend(test_brevo_integration())
    print()
    all_results.extend(test_mongodb_storage())
    
    # Summary
    print("\n" + "="*80)
    log("📊 TEST SUMMARY", Colors.BOLD)
    print("="*80)
    
    passed = sum(1 for result in all_results if result)
    failed = sum(1 for result in all_results if not result)
    total = len(all_results)
    
    log(f"Total Tests: {total}", Colors.BLUE)
    log(f"Passed: {passed}", Colors.GREEN)
    log(f"Failed: {failed}", Colors.RED)
    log(f"Success Rate: {(passed/total*100):.1f}%", Colors.YELLOW)
    
    if failed == 0:
        log("🎉 ALL TESTS PASSED! SMS OTP system is working correctly.", Colors.GREEN)
        return True
    else:
        log(f"⚠️  {failed} tests failed. Please check the issues above.", Colors.RED)
        return False

if __name__ == "__main__":
    try:
        success = run_comprehensive_tests()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        log("Testing interrupted by user", Colors.YELLOW)
        sys.exit(1)
    except Exception as e:
        log(f"Testing failed with error: {str(e)}", Colors.RED)
        sys.exit(1)