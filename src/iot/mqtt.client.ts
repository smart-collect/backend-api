import mqtt, { IClientOptions, MqttClient } from 'mqtt';

import { env } from '@config/env';
import { logger } from '@utils/logger';
import { handleMqttMessage } from './mqtt.handlers';

const BASE_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

let client: MqttClient | null = null;
let reconnectAttempt = 0;
let reconnectTimer: NodeJS.Timeout | null = null;
let stopped = false;

function getSubscribeTopics(): string[] {
  return env.MQTT_TOPICS_SUBSCRIBE.split(',')
    .map((topic) => topic.trim())
    .filter((topic) => topic.length > 0);
}

function getClientOptions(): IClientOptions {
  const options: IClientOptions = {
    reconnectPeriod: 0,
    clean: true,
    connectTimeout: 10_000,
  };

  if (env.MQTT_USERNAME) {
    options.username = env.MQTT_USERNAME;
  }

  if (env.MQTT_PASSWORD) {
    options.password = env.MQTT_PASSWORD;
  }

  if (env.NODE_ENV === 'production') {
    options.protocol = 'mqtts';
    options.port = 8883;
  }

  return options;
}

function scheduleReconnect(): void {
  if (stopped || reconnectTimer) return;

  reconnectAttempt += 1;
  const delay = Math.min(BASE_RECONNECT_DELAY_MS * 2 ** (reconnectAttempt - 1), MAX_RECONNECT_DELAY_MS);

  logger.warn('Scheduling MQTT reconnect', {
    attempt: reconnectAttempt,
    delay_ms: delay,
  });

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectMqttClient();
  }, delay);
}

export function connectMqttClient(): MqttClient {
  if (client?.connected) return client;

  stopped = false;
  const topics = getSubscribeTopics();
  const mqttClient = mqtt.connect(env.MQTT_BROKER_URL, getClientOptions());
  client = mqttClient;

  mqttClient.on('connect', () => {
    reconnectAttempt = 0;
    logger.info('MQTT connected', {
      broker: env.MQTT_BROKER_URL,
      topics,
    });

    mqttClient.subscribe(topics, { qos: 1 }, (error) => {
      if (error) {
        logger.error('MQTT subscribe failed', error);
        return;
      }

      logger.info('MQTT topics subscribed', { topics });
    });
  });

  mqttClient.on('message', (topic, payload) => {
    void handleMqttMessage(topic, payload).catch((error: unknown) => {
      logger.error('Unhandled MQTT handler error', error);
    });
  });

  mqttClient.on('close', () => {
    logger.warn('MQTT connection closed');
    if (!stopped) scheduleReconnect();
  });

  mqttClient.on('error', (error) => {
    logger.error('MQTT connection error', error);
    mqttClient.end(true);
  });

  mqttClient.on('offline', () => {
    logger.warn('MQTT client offline');
  });

  return mqttClient;
}

export function stopMqttClient(): void {
  stopped = true;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (client) {
    client.end(true);
    client = null;
  }
}
