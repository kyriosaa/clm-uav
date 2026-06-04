import machine
import time
import ujson
import network
import ntptime  
import gc       
from simple import MQTTClient
import private

from mpu6050 import MPU6050
from bmp280 import BMP280
from ina219 import INA219
from vl53l0x import VL53L0X

# init I2C0 on GP8 (SDA) and GP9 (SCL)
i2c = machine.I2C(0, sda=machine.Pin(8), scl=machine.Pin(9), freq=400000)

print("Scanning I2C bus...")
devices = i2c.scan()
if not devices:
    print("Error: No I2C devices found! Check your wiring.")
else:
    print("Found devices at hex addresses:", [hex(d) for d in devices])

# init sensors
try:
    mpu = MPU6050(0, 8, 9)
    bmp = BMP280(i2c)
    ina = INA219(i2c)
    ina.set_calibration_16V_400mA()
    lox = VL53L0X(i2c)
    print("All sensors initialized successfully.")
except Exception as e:
    print("Sensor initialization failed:", e)

# connect to wifi
print("Connecting to Wi-Fi...")
wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect(private.WIFI_SSID, private.WIFI_PASS)
while not wlan.isconnected():
    time.sleep(1)
print("Wi-Fi connected! IP:", wlan.ifconfig()[0])

# sync RTC via NTP before attempting TLS connection
print("Syncing time via NTP...")
try:
    ntptime.settime()
    print("Time set successfully.")
except Exception as e:
    print("Failed to sync time:", e)

def connect_mqtt():
    print("Connecting to MQTT broker...")
    try:
        # load client certs for mTLS
        with open(private.MQTT_KEY, 'rb') as f:
            key_data = f.read()
        with open(private.MQTT_CERT, 'rb') as f:
            cert_data = f.read()
        with open('ca.crt', 'rb') as f:
            ca_data = f.read()
            
        ssl_params = {
            "key": key_data,
            "cert": cert_data,
            "server_hostname": private.MQTT_BROKER,
            "cadata": ca_data,
            "cert_reqs": 2
        }
        client = MQTTClient(
            private.MQTT_CLIENT_ID, 
            private.MQTT_BROKER, 
            port=private.MQTT_PORT, 
            keepalive=60, 
            ssl=True, 
            ssl_params=ssl_params
        )
        
        # force garbage collection to free up contiguous RAM for the SSL handshake
        gc.collect() 
        client.connect()
        print("MQTT connected successfully!")
        return client
    except Exception as e:
        print("MQTT connection failed:", e)
        raise e

mqtt_client = None
try:
    mqtt_client = connect_mqtt()
except Exception as e:
    pass

# main loop
while True:
    try:
        if not wlan.isconnected():
            print("Wi-Fi connection lost! Reconnecting...")
            wlan.connect(private.WIFI_SSID, private.WIFI_PASS)
            while not wlan.isconnected():
                time.sleep(1)
            print("Wi-Fi reconnected! IP:", wlan.ifconfig()[0])

        roll_pitch = mpu.angles
        pitch = roll_pitch[1]
        roll = roll_pitch[0]
        
        temp = bmp.temperature
        pressure = bmp.pressure
        
        laser_dist = lox.range
        
        voltage = ina.bus_voltage
        current = ina.current
        power = voltage * current
        
        # build JSON payload
        payload = {
            "timestamp": time.ticks_ms(),
            "attitude": {
                "pitch": pitch,
                "roll": roll
            },
            "environment": {
                "temp_c": temp,
                "pressure_pa": pressure,
                "agl_laser_mm": laser_dist
            },
            "power": {
                "voltage_v": voltage,
                "current_ma": current,
                "power_mw": power
            }
        }
        
        json_data = ujson.dumps(payload)
        print("Publishing:", json_data)
        
        # publish to MQTT
        try:
            if mqtt_client is None:
                raise Exception("Client not initialized")
            mqtt_client.publish(private.MQTT_TOPIC, json_data)
        except Exception as e:
            print("MQTT publish failed:", e)
            print("Attempting to reconnect to MQTT...")
            try:
                try:
                    if mqtt_client is not None:
                        mqtt_client.disconnect()
                except:
                    pass 
                
                gc.collect() 
                mqtt_client = connect_mqtt()
            except Exception as rc_err:
                print("MQTT reconnect failed:", rc_err)
                time.sleep(2) 
        
        # 0.5Hz
        time.sleep(2.0) 
        
    except Exception as e:
        print("Read error:", e)
        time.sleep(2)