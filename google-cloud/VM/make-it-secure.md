# Make it Secure

To make it Secure we will use MTLS

## Create CA
openssl genrsa -out ca.key 2048

openssl req -new -x509 -days 3650 -key ca.key -out ca.crt -subj "/CN=clm-uav"

### Create Certificate Server site
openssl genrsa -out server.key 2048

openssl req -new -key server.key -out server.csr -subj "/CN=YOUR_GCP_VM_IP"

openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 365

### Create Certificates Client side

openssl genrsa -out pi_client.key 2048
openssl req -new -key pi_client.key -out pi_client.csr -subj "/CN=PiClient"
openssl x509 -req -in pi_client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out pi_client.crt -days 365

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

