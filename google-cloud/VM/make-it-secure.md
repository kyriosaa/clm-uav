# Make it Secure

To make it Secure we will use MTLS

# Generate CA private key using elliptic curve
openssl ecparam -name prime256v1 -genkey -noout -out ca.key

# Create CA Root Certificate (valid for 10 years)
openssl req -new -x509 -days 3650 -key ca.key -out ca.crt -subj "/CN=clm-uav"

# Generate Server private key
openssl ecparam -name prime256v1 -genkey -noout -out server.key

# Generate Server Certificate Signing Request (CSR)
openssl req -new -key server.key -out server.csr -subj "/CN=mqtts-bridge.duckdns.org"

# Sign the server certificate using the CA and inject the SAN extension
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days 365 \
  -extfile <(echo "subjectAltName=DNS:mqtts-bridge.duckdns.org")

### Create Certificates Client side

# Generate Pico private key
openssl ecparam -name prime256v1 -genkey -noout -out pi_client.key

# Generate Pico CSR
openssl req -new -key pi_client.key -out pi_client.csr -subj "/CN=PiClient"

# Sign Pico certificate
openssl x509 -req -in pi_client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out pi_client.crt -days 365

# 1. Die Root-CA in DER umwandeln
openssl x509 -in ca.crt -outform DER -out ca.der

# 2. Das Pico-Client-Zertifikat in DER umwandeln
openssl x509 -in pi_client.crt -outform DER -out pi_client.der

# 3. Den privaten Pico-Schlüssel in DER umwandeln
openssl ec -in pi_client.key -outform DER -out pi_client_key.der
# Generate Mac private key
openssl ecparam -name prime256v1 -genkey -noout -out mac_client.key

# Generate Mac CSR (Updated to /CN=MacClient to avoid identity collision)
openssl req -new -key mac_client.key -out mac_client.csr -subj "/CN=MacClient"

# Sign Mac certificate
openssl x509 -req -in mac_client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out mac_client.crt -days 365
### Give the clients and the server the certificates
copy into /etc/mosquitto/certs
Server needs:
ca.crt
server.crt
server.key
Client needs
ca.crt
client.crt
client.key

