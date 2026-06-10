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

### make it run in the background

sudo nano /etc/systemd/system/mqtt-bridge.service


Paste Service Configuration

1. Reload systemd to recognize your new file
sudo systemctl daemon-reload

2. Enable it to survive reboots
sudo systemctl enable mqtt-bridge.service

3. Start it right now
sudo systemctl start mqtt-bridge.service

4. Check if running smoothly
sudo systemctl status mqtt-bridge.service

5. See live console logs / print statements:

sudo journalctl -u mqtt-bridge.service -f
6. Restart it (after editing your code):

sudo systemctl restart mqtt-bridge.service


VM-IP: 34.80.73.148

!Reminder make the ip static

mosquitto_pub -h mqtts-bridge.duckdns.org -p 8883 \
  --cafile CA/ca.crt \
  --cert mac-client/mac_client.crt \
  --key mac-client/mac_client.key \
  -t "sensor/data" \
  -m '{"environment": {"temp_c": 29.01, "pressure_pa": 100340.42, "agl_laser_mm": 20}, "attitude": {"roll": 2.0421352, "pitch": 0.719337636}, "power": {"voltage_v": 4.704, "current_ma": 0.0, "power_mw": 0.0}, "timestamp": 1278722}' \
  --insecure -d