# Install packages for vm and create mqtt bridge

## Firewall Rule

Name: allow-mqtt
Targets: All instances in the network (or specify target tags if you want to limit it to just this VM).
Source IPv4 ranges: 0.0.0.0/0 (Allows connection from any IP. For better security, restrict this to your specific device IPs if they are static).
Protocols and ports: Check Specified protocols and ports, check TCP, and enter 8883.

Only MQTTs is allowed

1. sudo apt install mosquitto mosquitto-clients -y

Check if the service started 
2. sudo systemctl status mosquitto

### without encryption

Edit Configuration file 
1. sudo nano /etc/mosquitto/conf.d/default.conf

restart
2. sudo systemctl restart mosquitto


## install node js

1. sudo apt install -y nodejs npm

2. create project folder
mkdir -p ~/mqtt-to-firestore && cd ~/mqtt-to-firestore

3. initiliaze project and install dependencies
npm init -y
npm install mqtt firebase-admin

4. Bridge file create

nano bridge.py

5. add code from firestore bridge

6. make it run in the background

VM-IP: 34.80.108.11

mosquitto_pub -h 34.80.108.11 -p 8883 \
  --cafile CA/ca.crt \
  --cert mac-client/mac_client.crt \
  --key mac-client/mac_client.key \
  -t "sensor/data" \
  -m '{"battery": 88, "altitude": 120.5, "speed": 45.2, "status": "flying"}' \
  --insecure -d