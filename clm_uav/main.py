import machine
import time
import ujson

# Ensure these driver files are uploaded to your Pico's root directory
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
        
        # 10Hz
        time.sleep(0.1) 
        
    except Exception as e:
        print("Read error:", e)
        time.sleep(1)