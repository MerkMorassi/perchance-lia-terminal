up:
	./start.sh

down:
	@echo "stop the server with Ctrl-C in its window."

cert:
	@echo "self-signed cert for HTTPS/WSS (trust cert.pem in Windows once):"
	openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 825 -nodes -subj "/CN=127.0.0.1" -addext "subjectAltName=IP:127.0.0.1,DNS:localhost"

tls:
	./start.sh --cert cert.pem --key key.pem
