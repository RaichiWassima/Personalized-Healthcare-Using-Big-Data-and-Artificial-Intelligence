#!/bin/sh
until nc -z mongodb 27017; do
  echo "Waiting for MongoDB..."
  sleep 1
done
until nc -z kafka 9092; do
  echo "Waiting for Kafka..."
  sleep 1
done
echo "All services are up!"
exec "$@" 