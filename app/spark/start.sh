#!/bin/sh

# Attendre que Kafka soit prêt
echo "Waiting for Kafka..."
until nc -z kafka 9092; do
    sleep 1
done
echo "Kafka is ready!"

# Attendre que MongoDB soit prêt
echo "Waiting for MongoDB..."
until nc -z mongodb 27017; do
    sleep 1
done
echo "MongoDB is ready!"

# Vérifier si le modèle existe
if [ ! -f "model/xgboost_model.pkl" ]; then
    echo "Modèle XGBoost non trouvé. Démarrage de l'entraînement..."
    # Lancer le streaming des données
    python stream_data.py &
    # Attendre que les données soient streamées
    sleep 10
    # Entraîner le modèle
    python training_and_store.py
    echo "Entraînement terminé !"
else
    echo "Modèle XGBoost trouvé, l'entraînement est ignoré..."
fi

# Démarrer le script de prédiction
echo "Démarrage du script de prédiction..."
exec python predict_and_store.py 