import machine
import time
import ujson
import network
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

# connect to Wi-Fi
print("Connecting to Wi-Fi...")
wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect(private.WIFI_SSID, private.WIFI_PASS)
while not wlan.isconnected():
    time.sleep(1)
print("Wi-Fi connected! IP:", wlan.ifconfig()[0])

# connect to MQTT broker
print("Connecting to MQTT broker...")
try:
    # load client certs for mTLS
    with open(private.MQTT_KEY, 'rb') as f:
        key_data = f.read()
    with open(private.MQTT_CERT, 'rb') as f:
        cert_data = f.read()
        
    ssl_params = {
        "key": key_data,
        "cert": cert_data,
        "server_hostname": private.MQTT_BROKER
    }
    mqtt_client = MQTTClient(private.MQTT_CLIENT_ID, private.MQTT_BROKER, port=private.MQTT_PORT, keepalive=60, ssl=True, ssl_params=ssl_params)
    mqtt_client.connect()
    print("MQTT connected successfully!")
except Exception as e:
    print("MQTT connection failed:", e)

# main loop
while True:
    try:
        # the OneMadGypsy driver returns a tuple of (roll, pitch) directly
        roll_pitch = mpu.angles
        pitch = roll_pitch[1]
        roll = roll_pitch[0]
        
        temp = bmp.temperature
        pressure = bmp.pressure
        
        laser_dist = lox.range
        
        # rn the battery isnt connected so these should output something near zero
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
        
        # print to serial
        json_data = ujson.dumps(payload)
        print(json_data)
        
        # publish to MQTT
        try:
            mqtt_client.publish(private.MQTT_TOPIC, json_data)
        except Exception as e:
            print("MQTT publish failed:", e)
        
        # 10Hz
        time.sleep(0.1) 
        
    except Exception as e:
        print("Read error:", e)
        time.sleep(1)