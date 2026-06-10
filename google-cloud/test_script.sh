#!/bin/zsh

# Config paths for certificates (Updated folder structure)
CA_FILE="Certificates/CA/ca.crt"
CERT_FILE="Certificates/mac-client/mac_client.crt"
KEY_FILE="Certificates/mac-client/mac_client.key"
HOST="mqtts-bridge.duckdns.org"
PORT="8883"
TOPIC="sensor/data"

TOTAL_PACKETS=100
TIMESTAMP=1279722
BATTERY=4.794

echo "Starting macOS native telemetry loop ($TOTAL_PACKETS packets)..."

for ((i=1; i<=TOTAL_PACKETS; i++))
do
  # Increment flight metrics
  TIMESTAMP=$((TIMESTAMP + 500))
  BATTERY=$(echo "$BATTERY - 0.001" | bc)

  # Math multipliers using 'bc' to generate clean floating point oscillations
  PI_FRACTION=$(echo "scale=4; $i * 0.15" | bc)
  
  # Calculate moving sensor angles using command line trigonometry
  PITCH_RAW=$(echo "scale=2; s($PI_FRACTION) * 15" | bc -l)
  ROLL_RAW=$(echo "scale=2; c($PI_FRACTION * 0.8) * 12" | bc -l)
  YAW_RAW=$(echo "scale=2; ($i * 2.5) % 360" | bc)
  
  # Robust native Zsh wave simulation for the Laser (moves smoothly between 500 and 2500 mm)
  # Uses basic floating-point to integer calculation to ensure no trailing dots break the parser
  LASER_FACTOR=$(echo "scale=2; (1 + s($i * 0.1)) * 1000" | bc -l)
  LASER_MM=$(echo "scale=0; ($LASER_FACTOR + 500) / 1" | bc)

  # Fix macOS bc output formatting (converts "-.5" to "-0.5" or ".5" to "0.5")
  PITCH=$(echo $PITCH_RAW | sed 's/-\./-0./' | sed 's/^\./0./')
  ROLL=$(echo $ROLL_RAW | sed 's/-\./-0./' | sed 's/^\./0./')
  YAW=$(echo $YAW_RAW | sed 's/-\./-0./' | sed 's/^\./0./')

  # Fallbacks for empty variables if math boundaries clip zero
  [ -z "$PITCH" ] && PITCH="0.0"
  [ -z "$ROLL" ] && ROLL="0.0"
  [ -z "$YAW" ] && YAW="0.0"
  [ -z "$LASER_MM" ] && LASER_MM="1000"

  echo "[$i/$TOTAL_PACKETS] Transmitting -> Pitch: ${PITCH}° | Roll: ${ROLL}° | Laser: ${LASER_MM}mm"

  # Construct the single-line payload mapping perfectly to your live app JSON
  PAYLOAD="{\"environment\": {\"temp_c\": 29.01, \"pressure_pa\": 100340.42, \"agl_laser_mm\": $LASER_MM}, \"attitude\": {\"roll\": $ROLL, \"pitch\": $PITCH, \"yaw\": $YAW}, \"power\": {\"voltage_v\": $BATTERY, \"current_ma\": 0.0, \"power_mw\": 0.0}, \"timestamp\": $TIMESTAMP}"

  # Fire the mosquitto client natively
  mosquitto_pub -h "$HOST" -p "$PORT" \
    --cafile "$CA_FILE" \
    --cert "$CERT_FILE" \
    --key "$KEY_FILE" \
    -t "$TOPIC" \
    -m "$PAYLOAD" \
    --insecure

  # Wait 0.5 seconds between ticks to create smooth animations
  sleep 0.5
done

echo "Telemetry test stream completed."