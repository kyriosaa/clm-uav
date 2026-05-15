// CLM-UAV | Cloud-Monitored UAV system ESP32-S3 code for grabbing the sensor data
// Cloud and IoT Security
// 114998411 黃子奇
// 114012022 Milan Esser

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_BMP280.h>
#include <Adafruit_INA219.h>
#include <Adafruit_VL53L0X.h>

// things to put in secrets.h:
// --------------------------------
// const char* ssid = "asdf";
// const char* password = "asdf";
// const char* mqtt_server = "afsf.com";
// const int mqtt_port = 8883; // standard port is 8883
// const char* mqtt_topic = "asdf/telemetry";
// const char* root_ca = R"EOF(
// -----BEGIN CERTIFICATE-----
// ROOT CA HERE
// -----END CERTIFICATE-----
// )EOF";
#include "secrets.h"
#include "config.h"

WiFiClientSecure secureClient;
PubSubClient mqtt(secureClient);

Adafruit_MPU6050 mpu;
Adafruit_BMP280 bmp; // hardware I2C
Adafruit_INA219 ina219;
Adafruit_VL53L0X lox = Adafruit_VL53L0X();

// setup
void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22); // SDA, SCL

  // wifi connect
  Serial.print("Connecting to WiFi...");
  WiFi.begin(ssid, password);
  while(WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.println("\nWiFi connected.");

  // config TLS for secure MQTT
  secureClient.setCACert(root_ca);
  // secureClient.setCertificate(device_cert); // uncomment for Mutual TLS (AWS)
  // secureClient.setPrivateKey(private_key);  // uncomment for Mutual TLS (AWS)
  mqtt.setServer(mqtt_server, mqtt_port);

  // init sensors
  Serial.println("Initializing I2C Sensors...");
  if(!mpu.begin()) {
    Serial.println("Couldn't find MPU6050, check hardware connection");
  }
  if(!bmp.begin()) {
    Serial.println("Couldn't find BMP280, check hardware connection");
  }
  if(!ina219.begin()) {
    Serial.println("Couldn't find INA219, check hardware connection");
  }
  if(!lox.begin()) {
    Serial.println("Couldn't find VL53L0X, check hardware connection");
  }

  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,
                  Adafruit_BMP280::SAMPLING_X2,
                  Adafruit_BMP280::SAMPLING_X16,
                  Adafruit_BMP280::FILTER_X16,
                  Adafruit_BMP280::STANDBY_MS_500);
                  
  Serial.println("System Ready.");
}

// reconnect logic
void reconnect() {
  while (!mqtt.connected()) {
    Serial.print("Attempting MQTT connection...");
    // creates a random client ID
    String clientId = "ESP32-Drone-";
    clientId += String(random(0xffff), HEX);
    
    // add username/password params here if broker needs it
    if (mqtt.connect(clientId.c_str())) {
      Serial.println("connected");
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqtt.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void loop() {
  if (!mqtt.connected()) {
    reconnect();
  }
  mqtt.loop();

  // MPU6050 accelerometer for pitch and roll
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  // converting raw acceleration to pitch and roll angles
  float pitch = atan2(-a.acceleration.x, sqrt(a.acceleration.y * a.acceleration.y + a.acceleration.z * a.acceleration.z)) * 180.0 / PI;
  float roll  = atan2(a.acceleration.y, a.acceleration.z) * 180.0 / PI;

  // BMP280 altitude sensor
  float pressure = bmp.readPressure();
  float altitude = bmp.readAltitude(SEA_LVL_PRESSURE); // taiwan avg sea lvl pressure is 1010 | var is in config.h file

  // INA219 power sensor
  float busvoltage = ina219.getBusVoltage_V();
  float current_mA = ina219.getCurrent_mA();
  float power_mW = ina219.getPower_mW();

  // VL53L0X laser time-of-flight sensor
  VL53L0X_RangingMeasurementData_t measure;
  lox.rangingTest(&measure, false);
  int laser_dist = (measure.RangeStatus != 4) ? measure.RangeMilliMeter : -1; // -1 means out of range

  //  build JSON payload
  StaticJsonDocument<256> doc;
  doc["timestamp"] = millis();
  
  JsonObject attitude = doc.createNestedObject("attitude");
  attitude["pitch"] = pitch;
  attitude["roll"] = roll;
  // btw the MPU6050 doesnt have a compass so we can't actually simulate yaw
  
  JsonObject environment = doc.createNestedObject("environment");
  environment["pressure_pa"] = pressure;
  environment["alt_m"] = altitude;
  environment["agl_laser_mm"] = laser_dist;

  JsonObject power = doc.createNestedObject("power");
  power["voltage_v"] = busvoltage;
  power["current_ma"] = current_mA;
  power["power_mw"] = power_mW;

  // serialize to string
  char jsonBuffer[256];
  serializeJson(doc, jsonBuffer);

  // publish
  Serial.print("Publishing: ");
  Serial.println(jsonBuffer);
  mqtt.publish(mqtt_topic, jsonBuffer);

  // transmit at 10Hz (100ms delay) which is plenty fast for a dashboard
  delay(100); 
}