import urllib.request, urllib.parse, json

def test_login(username, password):
    data = urllib.parse.urlencode({'username': username, 'password': password}).encode()
    req = urllib.request.Request('http://127.0.0.1:8000/api/auth/login/', data=data, method='POST')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    try:
        r = urllib.request.urlopen(req)
        resp = r.read().decode()
        tokens = json.loads(resp)
        return tokens
    except Exception as e:
        return {'error': str(e)}

def get_me(access_token):
    req = urllib.request.Request('http://127.0.0.1:8000/api/auth/me/')
    req.add_header('Authorization', 'Bearer ' + access_token)
    try:
        r = urllib.request.urlopen(req)
        return r.read().decode()
    except Exception as e:
        return str(e)

tokens = {
    'admin': test_login('admin', 'admin123'),
    'worker': test_login('worker1', 'w123'),
    'buyer': test_login('buyer1', 'b123'),
    'delivery': test_login('delivery1', 'd123'),
}

print('=== Testing Authenticated API Calls ===')
for role, tok in tokens.items():
    if 'error' not in tok:
        user_info = get_me(tok['access'])
        print(role + ': ' + user_info)
    else:
        print(role + ': Login failed - ' + tok['error'])