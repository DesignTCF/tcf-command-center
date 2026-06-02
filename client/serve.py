import os, sys
os.chdir(os.path.dirname(os.path.abspath(__file__)))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 4001
import http.server, socketserver
handler = http.server.SimpleHTTPRequestHandler
with socketserver.TCPServer(("", port), handler) as httpd:
    print(f"Serving at http://localhost:{port}")
    httpd.serve_forever()
