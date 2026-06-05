for reference and stuff

what a data packet looks like:
```
Publishing: {"environment": {"temp_c": 29.01, "pressure_pa": 100340.42, "agl_laser_mm": 20}, "attitude": {"roll": 2.0421352, "pitch": 0.719337636}, "power": {"voltage_v": 4.704, "current_ma": 0.0, "power_mw": 0.0}, "timestamp": 1278722}
```

# MPU6050 Accelerometer (Pitch, Roll)
Roll goes negative when drone tilts FORWARD, positive when drone tilts BACKWARD
Pitch goes negative when drone tilts LEFT, positive when drone tilts RIGHT

**Sensor is noisy, make the dead zone around -2 to 2**

# AGL Laser
Inits at around 15-25. Make dead zone around +-5
