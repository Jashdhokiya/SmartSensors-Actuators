#ifndef MPU6050_SENSOR_H
#define MPU6050_SENSOR_H

#include <Arduino.h>
#include <Wire.h>
#include "config.h"
#include "types.h"

// Initialize Hardware I2C and scan bus
void initI2C();
void scanI2CBus();

// Initialize MPU-6050 register settings
bool initMPU(uint8_t addr);

// Read raw registers, compute acceleration magnitude, tilt angle and shock flags
void readMotionSensor(CargoReading &reading);

// Sensor presence status
bool isMPUDetected();

#endif // MPU6050_SENSOR_H
