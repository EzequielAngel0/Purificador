/*
 * Sistema de Purificación de Aire con Lazo Cerrado (Wi-Fi HTTP, modo AP+STA)
 * ESP32 + MQ135 + TIP120 + Supabase
 *
 * El ESP32 crea su propia red Wi-Fi (AP):
 *   SSID: ESP32_AIR
 *   PASS: 12345678
 *
 * Además puede conectarse como STA a una red con Internet (casa/escuela).
 *
 * API HTTP:
 *   GET  /api/ping          -> info básica del dispositivo
 *   GET  /api/status        -> estado aire + fan + red (AP/STA)
 *   POST /api/control       -> control fanMode / PWM / setpoint
 *   GET  /api/wifi-scan     -> redes Wi-Fi cercanas (para configurar STA)
 *   POST /api/wifi-config   -> configurar STA (ssid + password)
 *   GET  /api/events        -> historial de eventos desde Supabase (MALA / MUY MALA)
 *
 * Supabase:
 *   - El ESP32 inserta eventos cuando la calidad pasa a MALA / MUY MALA
 *   - El ESP32 puede consultar los eventos (para la pantalla History de la app)
 */

#if !defined(ESP32)
  #error "Este sketch está diseñado únicamente para ESP32."
#endif

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>

// ======================= CONFIGURACIÓN Wi-Fi AP+STA =====================

// AP del ESP32 (para conectar el celular)
const char* AP_SSID = "ESP32_AIR";
const char* AP_PASS = "12345678";  // mínimo 8 caracteres

// STA (se configurará desde la app, pero puedes poner defaults aquí si quieres)
String sta_ssid = "";
String sta_pass = "";

// Tiempo máximo para intentar conectar STA
const unsigned long STA_CONNECT_TIMEOUT_MS = 15000;

// Puerto del servidor HTTP
const uint16_t HTTP_PORT = 80;

// Servidor HTTP síncrono
WebServer server(HTTP_PORT);

// Preferencias (NVS) para guardar SSID/PASS STA
Preferences prefs;
const char* PREF_NS_WIFI  = "wifi_cfg";
const char* PREF_KEY_SSID = "sta_ssid";
const char* PREF_KEY_PASS = "sta_pass";

// Estado de STA
bool sta_connected = false;
IPAddress sta_ip;

// ======================= CONFIGURACIÓN SUPABASE ==========================

// Rellena con los datos de tu proyecto Supabase
const char* SUPABASE_URL      = "https://ztjtczlwjbxtxdgbpoub.supabase.co";   // sin slash final
const char* SUPABASE_API_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0anRjemx3amJ4dHhkZ2Jwb3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MzY3ODAsImV4cCI6MjA3OTExMjc4MH0.hh8QPr0mZT5MMSToj6Dbf-u81M3i28ciEde4Ok4WChk";    // clave (para demos, anon; para producción, service key con cuidado)
const char* SUPABASE_DEVICE_ID = "70a62728-70f5-4aa0-a9a6-b5aa6d7b624f"; // UUID de tu dispositivo en la tabla devices

// Ruta REST de la tabla events
const char* SUPABASE_EVENTS_PATH = "/rest/v1/events";

// Tiempo de calentamiento del MQ135
const unsigned long SENSOR_WARMUP_MS = 30000; // 30 s

bool isSensorReady() {
  return millis() >= SENSOR_WARMUP_MS;
}


// Para simplificar TLS (NO es seguro en producción, pero sirve para demo)
WiFiClientSecure secureClient;

// ========================== DEFINICIÓN DE PINES ==========================

#define MQ135_PIN   34    // GPIO34 - Entrada analógica del MQ135
#define FAN_PWM_PIN 25    // GPIO25 - Salida PWM para TIP120
#define LED_PIN     2     // GPIO2 - LED indicador (interno ESP32)

// ========================== CONFIGURACIÓN PWM ==========================

#define PWM_FREQ       25000   // 25 kHz
#define PWM_RESOLUTION 8       // 8 bits = 0-255

// ========================== UMBRALES CALIDAD AIRE =======================

#define THRESHOLD_GOOD     300
#define THRESHOLD_MODERATE 500
#define THRESHOLD_BAD      700
#define HYSTERESIS         20   // Histéresis para evitar oscilaciones

// ========================== VELOCIDADES VENTILADOR ======================
//
// Para evitar reinicios por caídas de tensión, definimos una zona segura
// de trabajo del ventilador: 60%–100% del PWM real.
//
// 60%  de 255 ≈ 153
// 70%  de 255 ≈ 179
// 85%  de 255 ≈ 217
// 100% de 255 = 255
//

#define FAN_OFF        0
#define FAN_SAFE_MIN   153  // 60% real, mínimo seguro
#define FAN_MODERATE   179  // 70% real (aire MODERADA)
#define FAN_BAD        217  // 85% real (aire MALA)
#define FAN_VERY_BAD   255  // 100% real (aire MUY MALA)

// ========================== FILTRADO DE SEÑAL ===========================

const int NUM_SAMPLES = 10;
int  samples[NUM_SAMPLES] = {0};
int  sample_index          = 0;
bool samples_initialized   = false;

// ========================== ESTADO DEL SISTEMA ==========================

int    air_quality_value   = 0;        // 0-1000 (mapeado desde ADC)
String air_quality_state   = "BUENA";

int    setpoint            = THRESHOLD_MODERATE;
int    current_fan_speed   = FAN_OFF;

// Modo ventilador tal como lo usará la app React Native
String fan_mode = "AUTO";  // "AUTO" | "MANUAL"

// Control de tiempo de lectura
unsigned long last_reading_time      = 0;
const unsigned long READING_INTERVAL = 500; // 500 ms

// Para saber cuándo se actualizó el estado por última vez
unsigned long last_status_update_ms = 0;

// Para control de eventos hacia Supabase (evitar spam)
String last_event_state = "BUENA";  // guarda el último estado que se envió como evento

// ========================== FUNCIONES AUXILIARES ========================

int get_filtered_air_quality() {
  int raw_value = analogRead(MQ135_PIN);

  samples[sample_index] = raw_value;
  sample_index = (sample_index + 1) % NUM_SAMPLES;

  if (!samples_initialized) {
    for (int i = 0; i < NUM_SAMPLES; i++) {
      samples[i] = raw_value;
    }
    samples_initialized = true;
  }

  long sum = 0;
  for (int i = 0; i < NUM_SAMPLES; i++) {
    sum += samples[i];
  }

  return sum / NUM_SAMPLES;
}

int map_air_quality(int raw_value) {
  return map(raw_value, 0, 4095, 0, 1000);
}

/**
 * En modo AUTO, calculamos la velocidad del ventilador según el valor de
 * calidad de aire, usando la zona segura:
 *
 *  - BUENA      -> ventilador apagado (FAN_OFF)
 *  - MODERADA   -> FAN_MODERATE (70%)
 *  - MALA       -> FAN_BAD      (85%)
 *  - MUY MALA   -> FAN_VERY_BAD (100%)
 */
// ================= ESTADO vs SETPOINT (relativo) =================

// Rango relativo al setpoint. Ajusta estos valores si quieres que cambie antes/después.
const int DELTA_GOOD_MAX      = -50;  // <= setpoint - 50  -> BUENA
const int DELTA_MODERATE_MAX  =  50;  // (-50,  +50]      -> MODERADA
const int DELTA_BAD_MAX       = 150;  // ( 50, 150]       -> MALA
// > 150                                 -> MUY MALA

void updateAirQualityStateFromSetpoint() {
  // diferencia entre lectura y setpoint
  int diff = air_quality_value - setpoint;
  String newState;

  if (diff <= DELTA_GOOD_MAX) {
    newState = "BUENA";
  } else if (diff <= DELTA_MODERATE_MAX) {
    newState = "MODERADA";
  } else if (diff <= DELTA_BAD_MAX) {
    newState = "MALA";
  } else {
    newState = "MUY MALA";
  }

  if (newState != air_quality_state) {
    Serial.print("CAMBIO DE ESTADO (setpoint): ");
    Serial.print(air_quality_state);
    Serial.print(" -> ");
    Serial.println(newState);
    air_quality_state = newState;
  }
}

/**
 * En modo AUTO, la velocidad depende del estado ya calculado
 * por updateAirQualityStateFromSetpoint().
 *
 *  BUENA      -> FAN_OFF
 *  MODERADA   -> FAN_MODERATE
 *  MALA       -> FAN_BAD
 *  MUY MALA   -> FAN_VERY_BAD
 */
int calculate_fan_speed_auto() {
  if (air_quality_state == "MUY MALA") return FAN_VERY_BAD;
  if (air_quality_state == "MALA")     return FAN_BAD;
  if (air_quality_state == "MODERADA") return FAN_MODERATE;
  return FAN_OFF; // BUENA u otros
}


void set_fan_speed(int speed) {
  speed = constrain(speed, 0, 255);
  ledcWrite(FAN_PWM_PIN, speed);
  current_fan_speed = speed;

  Serial.print("Ventilador: ");
  Serial.print(speed);
  Serial.print(" (");
  Serial.print((speed * 100) / 255);
  Serial.println("%)");
}

// ========================== SUPABASE: helpers ===========================

bool isStaConnectedAndHasNet() {
  return (WiFi.status() == WL_CONNECTED);
}

/**
 * Envía un evento a Supabase cuando el estado es MALA / MUY MALA.
 * Para no saturar, sólo se envía cuando cambia de un estado anterior a MALA/MUY MALA.
 */
void sendEventToSupabase(const String& state, int aqi, int fanSpeed, int sp) {
  if (!isStaConnectedAndHasNet()) {
    Serial.println("[Supabase] STA no conectado, no se envía evento.");
    return;
  }

  if (state != "MALA" && state != "MUY MALA") {
    return; // sólo nos interesan MALA y MUY MALA
  }

  if (state == last_event_state) {
    // ya se envió un evento para este estado, evitar spam
    return;
  }

  // Construir URL
  String url = String(SUPABASE_URL) + SUPABASE_EVENTS_PATH;

  HTTPClient http;
  secureClient.setInsecure(); // demo: sin validación de cert
  if (!http.begin(secureClient, url)) {
    Serial.println("[Supabase] http.begin() falló");
    return;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_API_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_API_KEY);

  StaticJsonDocument<512> doc;
  doc["device_id"]         = SUPABASE_DEVICE_ID;
  doc["event_type"]        = "ALARM";
  doc["event_code"]        = (state == "MUY MALA") ? "AIR_VERY_BAD" : "AIR_BAD";
  doc["description"]       = (state == "MUY MALA") ?
                              "Calidad de aire muy mala" :
                              "Calidad de aire mala";
  doc["air_quality_value"] = aqi;
  doc["air_quality_state"] = state;
  doc["severity"]          = (state == "MUY MALA") ? 5 : 3;
  doc["fan_speed"]         = fanSpeed;
  doc["setpoint"]          = sp;

  String payload;
  serializeJson(doc, payload);

  int code = http.POST(payload);
  if (code > 0) {
    Serial.print("[Supabase] Evento enviado, HTTP ");
    Serial.println(code);
  } else {
    Serial.print("[Supabase] Error POST: ");
    Serial.println(http.errorToString(code));
  }
  http.end();

  last_event_state = state; // recordar último estado enviado
}

/**
 * Proxy de eventos: la app llama al ESP32 y éste consulta Supabase.
 * GET /api/events
 * Respuesta: { "ok": true, "data": [...] } o error.
 */
void handleEvents() {
  Serial.println("HTTP GET /api/events");

  if (!isStaConnectedAndHasNet()) {
    StaticJsonDocument<256> doc;
    doc["ok"] = false;
    JsonObject err = doc.createNestedObject("error");
    err["code"]    = "NO_STA_NET";
    err["message"] = "STA not connected or no internet";

    String json;
    serializeJson(doc, json);
    addCommonHeaders();
    server.send(503, "application/json", json);
    return;
  }

  // Construir URL REST (filtrar por device_id, estados MALA/MUY MALA, orden desc, limit 50)
  String url = String(SUPABASE_URL) +
    "/rest/v1/events?device_id=eq." + SUPABASE_DEVICE_ID +
    "&air_quality_state=in.(MALA,MUY%20MALA)"
    "&order=timestamp.desc&limit=50";

  HTTPClient http;
  secureClient.setInsecure();
  if (!http.begin(secureClient, url)) {
    StaticJsonDocument<256> doc;
    doc["ok"] = false;
    JsonObject err = doc.createNestedObject("error");
    err["code"]    = "HTTP_INIT_FAIL";
    err["message"] = "Failed to init HTTPClient";

    String json;
    serializeJson(doc, json);
    addCommonHeaders();
    server.send(500, "application/json", json);
    return;
  }

  http.addHeader("apikey", SUPABASE_API_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_API_KEY);

  int code = http.GET();
  String body = http.getString();
  http.end();

  StaticJsonDocument<256> resp;
  resp["ok"] = (code >= 200 && code < 300);

  if (resp["ok"].as<bool>()) {
    String jsonOut = "{\"ok\":true,\"data\":" + body + "}";
    addCommonHeaders();
    server.send(200, "application/json", jsonOut);
    return;
  } else {
    JsonObject err = resp.createNestedObject("error");
    err["code"]    = "SUPABASE_HTTP_ERROR";
    err["message"] = code;

    String json;
    serializeJson(resp, json);
    addCommonHeaders();
    server.send(500, "application/json", json);
    return;
  }
}

// ========================== HTTP: helpers ===============================

void addCommonHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ========================== HTTP: handlers ==============================

void handlePing() {
  Serial.println("HTTP GET /api/ping");
  StaticJsonDocument<256> doc;
  doc["ok"] = true;
  JsonObject data = doc.createNestedObject("data");
  data["device"]    = "ESP32_AirPurifier";
  data["fwVersion"] = "1.1.0";
  data["uptimeMs"]  = millis();

  // NUEVO: estado del sensor
  data["sensorReady"] = isSensorReady();

  JsonObject net = data.createNestedObject("net");
  net["apIp"]         = WiFi.softAPIP().toString();
  net["staConnected"] = sta_connected;
  net["staIp"]        = sta_connected ? sta_ip.toString() : "";
  net["staSsid"]      = sta_ssid;

  String json;
  serializeJson(doc, json);

  addCommonHeaders();
  server.send(200, "application/json", json);
}


void handleStatus() {
  Serial.println("HTTP GET /api/status");

  StaticJsonDocument<768> doc;
  doc["ok"] = true;
  JsonObject data = doc.createNestedObject("data");

  data["deviceState"] = "READY";

  JsonObject air = data.createNestedObject("air");
  air["pm25"]            = nullptr;
  air["pm10"]            = nullptr;
  air["tvoc"]            = nullptr;
  air["co2"]             = nullptr;
  air["airQualityValue"] = air_quality_value;
  air["airQualityState"] = air_quality_state;
  // NUEVO:
  air["sensorReady"]     = isSensorReady();

  JsonObject fan = data.createNestedObject("fan");
  fan["mode"]     = fan_mode;
  fan["pwm"]      = current_fan_speed;
  fan["setpoint"] = setpoint;

  JsonObject time = data.createNestedObject("time");
  time["millis"]     = millis();
  time["lastUpdate"] = last_status_update_ms;

  JsonObject net = data.createNestedObject("net");
  net["apIp"]         = WiFi.softAPIP().toString();
  net["staConnected"] = sta_connected;
  net["staIp"]        = sta_connected ? sta_ip.toString() : "";
  net["staSsid"]      = sta_ssid;

  String json;
  serializeJson(doc, json);

  addCommonHeaders();
  server.send(200, "application/json", json);
}


void handleRoot() {
  addCommonHeaders();
  server.send(200, "text/plain", "ESP32 AirPurifier API. Prueba /api/ping");
}

void handleControl() {
  String body = server.arg("plain");
  if (body.length() == 0) {
    StaticJsonDocument<256> resp;
    resp["ok"] = false;
    JsonObject err = resp.createNestedObject("error");
    err["code"]    = "EMPTY_BODY";
    err["message"] = "Empty request body";

    String json;
    serializeJson(resp, json);
    addCommonHeaders();
    server.send(400, "application/json", json);
    return;
  }

  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, body);

  if (error) {
    StaticJsonDocument<256> resp;
    resp["ok"] = false;
    JsonObject err = resp.createNestedObject("error");
    err["code"]    = "INVALID_JSON";
    err["message"] = error.f_str();

    String json;
    serializeJson(resp, json);
    addCommonHeaders();
    server.send(400, "application/json", json);
    return;
  }

  if (doc.containsKey("fanMode")) {
    String newMode = doc["fanMode"].as<String>();
    newMode.toUpperCase();
    if (newMode == "AUTO" || newMode == "MANUAL") {
      fan_mode = newMode;
    } else {
      StaticJsonDocument<256> resp;
      resp["ok"] = false;
      JsonObject err = resp.createNestedObject("error");
      err["code"]    = "INVALID_PARAM";
      err["message"] = "fanMode must be AUTO or MANUAL";

      String json;
      serializeJson(resp, json);
      addCommonHeaders();
      server.send(400, "application/json", json);
      return;
    }
  }

  if (doc.containsKey("fanPwm")) {
    int pwm = doc["fanPwm"].as<int>();
    if (pwm < 0 || pwm > 255) {
      StaticJsonDocument<256> resp;
      resp["ok"] = false;
      JsonObject err = resp.createNestedObject("error");
      err["code"]    = "INVALID_PARAM";
      err["message"] = "fanPwm must be between 0 and 255";

      String json;
      serializeJson(resp, json);
      addCommonHeaders();
      server.send(400, "application/json", json);
      return;
    }

    if (fan_mode == "MANUAL") {
      set_fan_speed(pwm);
    }
  }

  if (doc.containsKey("setpoint")) {
    int sp = doc["setpoint"].as<int>();
    setpoint = sp;
    Serial.print("Nuevo setpoint via HTTP: ");
    Serial.println(setpoint);
  }

  StaticJsonDocument<256> resp;
  resp["ok"] = true;
  JsonObject dataResp = resp.createNestedObject("data");
  dataResp["fanMode"]  = fan_mode;
  dataResp["fanPwm"]   = current_fan_speed;
  dataResp["setpoint"] = setpoint;

  String json;
  serializeJson(resp, json);
  addCommonHeaders();
  server.send(200, "application/json", json);
}

// ======================= Wi-Fi scan & config ============================

void handleWifiScan() {
  Serial.println("HTTP GET /api/wifi-scan");

  int n = WiFi.scanNetworks();
  StaticJsonDocument<1024> doc;
  doc["ok"] = true;
  JsonArray arr = doc.createNestedArray("data");

  for (int i = 0; i < n; i++) {
    JsonObject obj = arr.createNestedObject();
    obj["ssid"]   = WiFi.SSID(i);
    obj["rssi"]   = WiFi.RSSI(i);
    obj["secure"] = (WiFi.encryptionType(i) != WIFI_AUTH_OPEN);
  }

  String json;
  serializeJson(doc, json);
  addCommonHeaders();
  server.send(200, "application/json", json);
  WiFi.scanDelete();
}

void handleWifiConfig() {
  Serial.println("HTTP POST /api/wifi-config");

  String body = server.arg("plain");
  if (body.length() == 0) {
    StaticJsonDocument<256> resp;
    resp["ok"] = false;
    JsonObject err = resp.createNestedObject("error");
    err["code"]    = "EMPTY_BODY";
    err["message"] = "Empty request body";

    String json;
    serializeJson(resp, json);
    addCommonHeaders();
    server.send(400, "application/json", json);
    return;
  }

  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, body);
  if (error) {
    StaticJsonDocument<256> resp;
    resp["ok"] = false;
    JsonObject err = resp.createNestedObject("error");
    err["code"]    = "INVALID_JSON";
    err["message"] = error.f_str();

    String json;
    serializeJson(resp, json);
    addCommonHeaders();
    server.send(400, "application/json", json);
    return;
  }

  if (!doc.containsKey("ssid") || !doc.containsKey("password")) {
    StaticJsonDocument<256> resp;
    resp["ok"] = false;
    JsonObject err = resp.createNestedObject("error");
    err["code"]    = "MISSING_FIELDS";
    err["message"] = "ssid and password are required";

    String json;
    serializeJson(resp, json);
    addCommonHeaders();
    server.send(400, "application/json", json);
    return;
  }

  sta_ssid = doc["ssid"].as<String>();
  sta_pass = doc["password"].as<String>();

  prefs.putString(PREF_KEY_SSID, sta_ssid);
  prefs.putString(PREF_KEY_PASS, sta_pass);

  WiFi.mode(WIFI_AP_STA);
  WiFi.begin(sta_ssid.c_str(), sta_pass.c_str());

  unsigned long startAttempt = millis();
  sta_connected = false;

  while (WiFi.status() != WL_CONNECTED &&
         millis() - startAttempt < STA_CONNECT_TIMEOUT_MS) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    sta_connected = true;
    sta_ip = WiFi.localIP();
    Serial.println("STA conectado después de /api/wifi-config");
    Serial.print("IP STA: ");
    Serial.println(sta_ip.toString());
  } else {
    sta_connected = false;
    Serial.println("No se pudo conectar STA después de /api/wifi-config");
  }

  StaticJsonDocument<256> resp;
  resp["ok"] = true;
  JsonObject data = resp.createNestedObject("data");
  data["staConnected"] = sta_connected;
  data["staIp"]        = sta_connected ? sta_ip.toString() : "";
  data["staSsid"]      = sta_ssid;

  String json;
  serializeJson(resp, json);
  addCommonHeaders();
  server.send(200, "application/json", json);
}

void handleOptions() {
  addCommonHeaders();
  server.send(204);
}

void handleNotFound() {
  StaticJsonDocument<256> doc;
  doc["ok"] = false;
  JsonObject err = doc.createNestedObject("error");
  err["code"]    = "NOT_FOUND";
  err["message"] = "Endpoint not found";

  String json;
  serializeJson(doc, json);

  addCommonHeaders();
  server.send(404, "application/json", json);
}

// ========================== SETUP ==========================

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println();
  Serial.println("=== Sistema de Purificación de Aire (Wi-Fi HTTP, AP+STA) ===");
  Serial.println("Iniciando...");

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  ledcAttach(FAN_PWM_PIN, PWM_FREQ, PWM_RESOLUTION);
  ledcWrite(FAN_PWM_PIN, 0);

  prefs.begin(PREF_NS_WIFI, false);
  sta_ssid = prefs.getString(PREF_KEY_SSID, "");
  sta_pass = prefs.getString(PREF_KEY_PASS, "");

  Serial.println("Iniciando modo AP+STA...");
  WiFi.mode(WIFI_AP_STA);

  bool apOk = WiFi.softAP(AP_SSID, AP_PASS);
  if (apOk) {
    IPAddress apIP = WiFi.softAPIP();
    Serial.println("AP creado exitosamente!");
    Serial.print("SSID: ");
    Serial.println(AP_SSID);
    Serial.print("Password: ");
    Serial.println(AP_PASS);
    Serial.print("IP AP: ");
    Serial.println(apIP);
    digitalWrite(LED_PIN, HIGH);
  } else {
    Serial.println("ERROR al crear AP.");
  }

  if (sta_ssid.length() > 0) {
    Serial.print("Intentando conectar STA a SSID guardado: ");
    Serial.println(sta_ssid);

    WiFi.begin(sta_ssid.c_str(), sta_pass.c_str());

    unsigned long startAttemptTime = millis();
    while (WiFi.status() != WL_CONNECTED &&
           millis() - startAttemptTime < STA_CONNECT_TIMEOUT_MS) {
      delay(500);
      Serial.print(".");
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
      sta_connected = true;
      sta_ip = WiFi.localIP();
      Serial.println("STA conectado en setup.");
      Serial.print("IP STA: ");
      Serial.println(sta_ip.toString());
    } else {
      sta_connected = false;
      Serial.println("No se pudo conectar STA en setup.");
    }
  } else {
    Serial.println("No hay SSID STA guardado. Sólo AP activo.");
  }

  server.on("/",               HTTP_GET,     handleRoot);
  server.on("/api/ping",       HTTP_GET,     handlePing);
  server.on("/api/status",     HTTP_GET,     handleStatus);
  server.on("/api/control",    HTTP_POST,    handleControl);
  server.on("/api/wifi-scan",  HTTP_GET,     handleWifiScan);
  server.on("/api/wifi-config",HTTP_POST,    handleWifiConfig);
  server.on("/api/events",     HTTP_GET,     handleEvents);

  server.on("/api/ping",        HTTP_OPTIONS, handleOptions);
  server.on("/api/status",      HTTP_OPTIONS, handleOptions);
  server.on("/api/control",     HTTP_OPTIONS, handleOptions);
  server.on("/api/wifi-scan",   HTTP_OPTIONS, handleOptions);
  server.on("/api/wifi-config", HTTP_OPTIONS, handleOptions);
  server.on("/api/events",      HTTP_OPTIONS, handleOptions);

  server.onNotFound(handleNotFound);

  server.begin();
  Serial.print("Servidor HTTP escuchando en puerto ");
  Serial.println(HTTP_PORT);

  Serial.println("\nCALENTANDO SENSOR MQ135...");
  Serial.println("Espere 30 segundos para estabilización inicial");
  for (int i = 30; i > 0; i--) {
    Serial.print(i);
    Serial.print("... ");
    delay(1000);
  }
  Serial.println("\n¡Sensor listo!");
  Serial.println("\n=== Sistema Iniciado ===\n");
}

// ========================== LOOP ==========================

void loop() {
  server.handleClient();

  unsigned long current_time = millis();

    if (current_time - last_reading_time >= READING_INTERVAL) {
    last_reading_time = current_time;

    int raw_value = get_filtered_air_quality();
    air_quality_value = map_air_quality(raw_value);

    // 1) Actualizar SIEMPRE el estado en función de lectura y setpoint
    updateAirQualityStateFromSetpoint();

    // 2) En AUTO, ajustar velocidad usando ese estado
    if (fan_mode == "AUTO") {
      int target_speed = calculate_fan_speed_auto();
      if (target_speed != current_fan_speed) {
        set_fan_speed(target_speed);
      }
    }
    // En MANUAL, la velocidad se fija desde /api/control, pero
    // el estado sigue cambiando gracias a updateAirQualityStateFromSetpoint().

    last_status_update_ms = millis();

    // 3) Enviar evento si estamos en MALA / MUY MALA (en cualquiera de los modos)
    if (air_quality_state == "MALA" || air_quality_state == "MUY MALA") {
      sendEventToSupabase(
        air_quality_state,
        air_quality_value,
        current_fan_speed,
        setpoint
      );
    }

    Serial.print("Calidad Aire: ");
    Serial.print(air_quality_value);
    Serial.print(" | Estado: ");
    Serial.print(air_quality_state);
    Serial.print(" | Ventilador: ");
    Serial.print(current_fan_speed);
    Serial.print(" | Modo: ");
    Serial.print(fan_mode);
    Serial.print(" | Setpoint: ");
    Serial.println(setpoint);
  }


  delay(10);
}
