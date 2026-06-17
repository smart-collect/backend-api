import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import mqtt, { MqttClient } from 'mqtt';

// ─── ANSI colors ─────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
} as const;

function log(level: 'info' | 'ok' | 'warn' | 'error' | 'data', message: string, extra?: string): void {
  const ts = new Date().toISOString().slice(11, 19);
  const prefix = `${c.gray}${ts}${c.reset}`;

  switch (level) {
    case 'ok':
      console.log(`${prefix} ${c.green}✔${c.reset} ${message}${extra ? ` ${c.dim}${extra}${c.reset}` : ''}`);
      break;
    case 'warn':
      console.log(`${prefix} ${c.yellow}⚠${c.reset} ${message}${extra ? ` ${c.yellow}${extra}${c.reset}` : ''}`);
      break;
    case 'error':
      console.error(`${prefix} ${c.red}✖${c.reset} ${c.red}${message}${c.reset}${extra ? ` ${extra}` : ''}`);
      break;
    case 'data':
      console.log(`${prefix} ${c.blue}▸${c.reset} ${message}${extra ? ` ${c.cyan}${extra}${c.reset}` : ''}`);
      break;
    default:
      console.log(`${prefix} ${c.magenta}●${c.reset} ${message}${extra ? ` ${c.dim}${extra}${c.reset}` : ''}`);
  }
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

interface CliOptions {
  interval: number;
  devices: number;
  speed: number;
}

function parseCliArgs(argv: string[]): CliOptions {
  const defaults: CliOptions = { interval: 30_000, devices: 3, speed: 1 };
  const options = { ...defaults };

  for (const arg of argv) {
    const match = /^--(\w+)=(.+)$/.exec(arg);
    if (!match) continue;

    const [, key, raw] = match;
    const value = Number(raw);

    if (!Number.isFinite(value) || value <= 0) {
      log('error', `Valeur invalide pour --${key}=${raw}`);
      process.exit(1);
    }

    if (key === 'interval') options.interval = value;
    else if (key === 'devices') options.devices = Math.floor(value);
    else if (key === 'speed') options.speed = value;
  }

  return options;
}

// ─── Simulator state ─────────────────────────────────────────────────────────

interface SimDevice {
  id: string;
  deviceId: string;
  name: string;
  fillLevel: number;
  batteryPercent: number;
  initialBattery: number;
  measurementCount: number;
  startedAt: number;
  timer: NodeJS.Timeout | null;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10;
}

function batteryVoltageFromPercent(percent: number): number {
  return Math.round((3.0 + (percent / 100) * 1.2) * 100) / 100;
}

function buildMeasurementPayload(sim: SimDevice): Record<string, unknown> {
  const fillDelta = randomInt(0, 2);
  sim.fillLevel = Math.min(100, Math.round((sim.fillLevel + fillDelta) * 10) / 10);
  sim.measurementCount += 1;

  if (sim.measurementCount % 10 === 0 && Math.random() < 0.1) {
    sim.fillLevel = 0;
    log('warn', `[${sim.deviceId}] Collecte simulée`, 'fill_level → 0%');
  }

  const elapsedHours = (Date.now() - sim.startedAt) / 3_600_000;
  sim.batteryPercent = Math.max(0, Math.round(sim.initialBattery - elapsedHours));

  const temperature = randomFloat(28, 35);
  const rssi = randomInt(-80, -50);
  const fillCentral = Math.min(100, Math.max(0, sim.fillLevel + randomInt(-3, 3)));
  const fillLateral = Math.min(100, Math.max(0, sim.fillLevel + randomInt(-3, 3)));

  return {
    device_id: sim.deviceId,
    timestamp: new Date().toISOString(),
    fill_level: sim.fillLevel,
    fill_central: fillCentral,
    fill_lateral: fillLateral,
    temperature,
    battery_voltage: batteryVoltageFromPercent(sim.batteryPercent),
    battery_percent: sim.batteryPercent,
    lid_opens_since_last: randomInt(0, 5),
    rssi_wifi: rssi,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();
let mqttClient: MqttClient | null = null;
const simDevices: SimDevice[] = [];
let shuttingDown = false;

function effectiveIntervalMs(baseInterval: number, speed: number): number {
  return Math.max(100, Math.round(baseInterval / speed));
}

function publish(topic: string, payload: Record<string, unknown>): void {
  if (!mqttClient?.connected) return;
  mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 });
}

function sendMeasurement(sim: SimDevice): void {
  const payload = buildMeasurementPayload(sim);
  const topic = `devices/${sim.deviceId}/data`;
  publish(topic, payload);

  log(
    'data',
    `${c.bold}${sim.name}${c.reset} (${sim.deviceId})`,
  `fill=${payload.fill_level}% temp=${payload.temperature}°C batt=${payload.battery_percent}% rssi=${payload.rssi_wifi}dBm`,
  );
}

function sendStatus(sim: SimDevice): void {
  const topic = `devices/${sim.deviceId}/status`;
  publish(topic, {
    device_id: sim.deviceId,
    timestamp: new Date().toISOString(),
    status: 'ONLINE',
    battery_percent: sim.batteryPercent,
    battery_voltage: batteryVoltageFromPercent(sim.batteryPercent),
    rssi_wifi: randomInt(-80, -50),
  });
}

function startDeviceTimer(sim: SimDevice, intervalMs: number): void {
  sendStatus(sim);
  sendMeasurement(sim);

  sim.timer = setInterval(() => {
    sendMeasurement(sim);
  }, intervalMs);
}

async function connectMqtt(): Promise<MqttClient> {
  const brokerUrl = process.env.MQTT_BROKER_URL ?? 'mqtt://localhost:1883';
  const options: mqtt.IClientOptions = {
    clientId: `iot-simulator-${Date.now()}`,
    clean: true,
    reconnectPeriod: 2_000,
    connectTimeout: 10_000,
  };

  if (process.env.MQTT_USERNAME) options.username = process.env.MQTT_USERNAME;
  if (process.env.MQTT_PASSWORD) options.password = process.env.MQTT_PASSWORD;

  return new Promise((resolve, reject) => {
    const client = mqtt.connect(brokerUrl, options);
    mqttClient = client;

    client.on('connect', () => {
      log('ok', 'Connecté au broker MQTT', brokerUrl);
      resolve(client);
    });

    client.on('error', (err) => {
      if (!client.connected) reject(err);
      else log('error', 'Erreur MQTT', err.message);
    });
  });
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log('');
  log('info', `Arrêt (${signal})…`);

  for (const sim of simDevices) {
    if (sim.timer) {
      clearInterval(sim.timer);
      sim.timer = null;
    }
  }

  if (mqttClient) {
    await new Promise<void>((resolve) => {
      mqttClient!.end(false, {}, () => resolve());
    });
    mqttClient = null;
    log('ok', 'Déconnecté du broker MQTT');
  }

  await prisma.$disconnect();
  log('ok', 'Base de données déconnectée');
  log('info', 'Simulateur arrêté proprement');
  process.exit(0);
}

async function main(): Promise<void> {
  const cli = parseCliArgs(process.argv.slice(2));
  const intervalMs = effectiveIntervalMs(cli.interval, cli.speed);

  console.log('');
  console.log(`${c.bold}${c.cyan}╔══════════════════════════════════════╗${c.reset}`);
  console.log(`${c.bold}${c.cyan}║${c.reset}   ${c.bold}Smart-Collect IoT Simulator${c.reset}        ${c.bold}${c.cyan}║${c.reset}`);
  console.log(`${c.bold}${c.cyan}╚══════════════════════════════════════╝${c.reset}`);
  console.log('');
  log('info', 'Configuration', `devices=${cli.devices} interval=${cli.interval}ms speed=${cli.speed}x → ${intervalMs}ms`);

  const dbDevices = await prisma.device.findMany({
    orderBy: { createdAt: 'asc' },
    take: cli.devices,
    select: {
      id: true,
      deviceId: true,
      name: true,
      batteryPercent: true,
    },
  });

  if (dbDevices.length === 0) {
    log('error', 'Aucun device en base. Créez des devices via l\'API admin avant de lancer le simulateur.');
    await prisma.$disconnect();
    process.exit(1);
  }

  if (dbDevices.length < cli.devices) {
    log('warn', `Seulement ${dbDevices.length} device(s) trouvé(s) (demandé: ${cli.devices})`);
  }

  const now = Date.now();
  for (const device of dbDevices) {
    const initialBattery = device.batteryPercent ?? 100;
    simDevices.push({
      id: device.id,
      deviceId: device.deviceId,
      name: device.name,
      fillLevel: randomInt(10, 40),
      batteryPercent: initialBattery,
      initialBattery,
      measurementCount: 0,
      startedAt: now,
      timer: null,
    });
    log('ok', `Device chargé: ${c.bold}${device.name}${c.reset}`, device.deviceId);
  }

  await connectMqtt();

  for (const sim of simDevices) {
    startDeviceTimer(sim, intervalMs);
  }

  log('info', `Simulation active — Ctrl+C pour arrêter`);
  console.log('');
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

main().catch(async (err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  log('error', 'Échec du simulateur', message);
  await prisma.$disconnect();
  process.exit(1);
});
