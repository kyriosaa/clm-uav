import machine
sda_pin = machine.Pin(8, machine.Pin.IN, machine.Pin.PULL_UP)
scl_pin = machine.Pin(9, machine.Pin.IN, machine.Pin.PULL_UP)
i2c = machine.I2C(0, sda=sda_pin, scl=scl_pin, freq=50000)
print("Devices found:", [hex(d) for d in i2c.scan()])