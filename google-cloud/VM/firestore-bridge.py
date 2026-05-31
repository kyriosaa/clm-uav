import json
import ssl
from datetime import datetime, timezone
import paho.mqtt.client as mqtt
import firebase_admin
from firebase_admin import credentials, firestore
import random
import string

# 1. FIREBASE INITIALIZATION
cred = credentials.ApplicationDefault()
firebase_admin.initialize_app(cred, {
    'project_id': 'clm-uav'
})

db = firestore.client(database_id='state')

# 2. MQTT CALLBACKS
def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        print("Successfully connected to the MQTT Broker!")
        # Subscribing to the new sensor data topic
        client.subscribe("sensor/data")
        print('Topic "sensor/data" successfully subscribed.')
    else:
        print(f"Connection failed with result code {rc}")

def on_message(client, userdata, msg):
    payload_str = msg.payload.decode('utf-8')
    print(f"Sensor message received on topic [{msg.topic}]: {payload_str}")
    
    # Global safety block to prevent the script from crashing due to Firestore issues
    try:
        # Inner safety block for JSON parsing
        def make_doc_id():
            # ISO-like timestamp without characters that can cause path issues, plus short random suffix
            now = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
            suffix = ''.join(random.choices('0123456789abcdef', k=6))
            return f"{now}-{suffix}"

        try:
            data = json.loads(payload_str)
            data['timestamp'] = firestore.SERVER_TIMESTAMP
            
            doc_id = make_doc_id()
            db.collection('sensor').document(doc_id).set(data)
            print(f"Sensor data successfully saved to Firestore with id={doc_id}!")
            
        except json.JSONDecodeError:
            # Fallback: If payload is not valid JSON, save it as raw text
            print("Payload is not valid JSON. Saving as raw sensor text instead...")
            fallback_data = {
                'raw_payload': payload_str,
                'topic': msg.topic,
                'timestamp': firestore.SERVER_TIMESTAMP
            }
            # Use same collection and timestamp-based id 
            doc_id = make_doc_id()
            db.collection('sensor').document(doc_id).set(fallback_data)
            print(f"Raw sensor text data successfully saved to Firestore with id={doc_id}!")
            
    except Exception as firestore_error:
        # Catch-all for database connection/permission errors so the script keeps running
        print("CRITICAL FIRESTORE ERROR DETECTED:")
        print(str(firestore_error))
        print("Please verify that your Firestore database actually exists and is active within your GCP project.")

# 3. MQTT CLIENT SETUP & START
client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2)
client.on_connect = on_connect
client.on_message = on_message

# Secure mTLS Configuration
client.tls_set(
    ca_certs="/etc/mosquitto/certs/ca.crt",
    certfile="/etc/mosquitto/certs/server.crt",
    keyfile="/etc/mosquitto/certs/server.key",
    cert_reqs=ssl.CERT_NONE
)

# Connect to the local broker on secure port 8883
client.connect("localhost", 8883, 60)

# Start the permanent background loop
print("Starting MQTT-Firebase Bridge (Sensor Data)...")
client.loop_forever()