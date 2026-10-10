# Local static server for development. Same as `python3 -m http.server`, but tells the browser
# not to cache: otherwise Chrome keeps serving stale ES modules after an edit.
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
http.server.ThreadingHTTPServer(('', port), NoCacheHandler).serve_forever()
