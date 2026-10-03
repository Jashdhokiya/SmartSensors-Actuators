#ifndef ENV_SENSORS_H
#define ENV_SENSORS_H

#include "types.h"
#include "config.h"

// Initialize DHT11 and LDR analog ADC pin
void initEnvSensors();

// Read temperature (°C), relative humidity (%), and ambient light level
void readEnvSensors(CargoReading &reading);

#endif // ENV_SENSORS_H
