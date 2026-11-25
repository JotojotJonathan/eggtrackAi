import urllib.request, urllib.parse, json

def login(username, password):
    data = urllib.parse.urlencode({'username': username, 'password': password}).encode()
    req = urllib.request.Request('http://127.0.0.1:8000/api/auth/login/', data=data, method='POST')
    req.add_header('Content-Type', 'application/x-www-form-urlencoded')
    try:
        r = urllib.request.urlopen(req)
        resp = r.read().decode()
        return json.loads(resp)
    except Exception as e:
        return {'error': str(e)}

tokens = {
    'admin': login('admin', 'admin123'),
    'worker1': login('worker1', 'w123'),
    'buyer1': login('buyer1', 'b123'),
    'delivery1': login('delivery1', 'd123'),
}

for role, tok in tokens.items():
    if 'error' in tok:
        print(role + ': LOGIN FAILED - ' + tok['error'])
    else:
        print(role + ': LOGIN SUCCESS - kind: ' + tok['token_type'])