from pyspark.sql import SparkSession
from pyspark.sql.functions import from_json, col, when
from pyspark.sql.types import DoubleType, IntegerType, StructType, StructField, StringType
import joblib
import pandas as pd
from pymongo import MongoClient
import os
import time
from datetime import datetime

def wait_for_mongodb(max_retries=30, retry_interval=2):
    for i in range(max_retries):
        try:
            client = MongoClient(
                host=os.getenv('MONGODB_HOST', 'mongodb'),
                port=int(os.getenv('MONGODB_PORT', 27017)),
                serverSelectionTimeoutMS=5000
            )
            client.server_info()
            return client
        except Exception as e:
            print(f"Attempt {i+1}/{max_retries}: Waiting for MongoDB... Error: {e}")
            if i < max_retries - 1:
                time.sleep(retry_interval)
            else:
                raise Exception(f"Could not connect to MongoDB after {max_retries} attempts")

# 1. Créer la session Spark
spark = SparkSession.builder \
    .appName("KafkaPrediction") \
    .config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.2.0") \
    .getOrCreate()

# 2. Définir le schéma selon les données
schema = StructType(
    [StructField("Unnamed", StringType(), True)] +
    [StructField(f"X{i}", DoubleType(), True) for i in range(1, 179)] +
    [StructField("y", IntegerType(), True)]
)

# 3. Charger le modèle XGBoost et ses métadonnées
try:
    model = joblib.load("model/xgboost_model.pkl")
    model_metadata = joblib.load("model/model_metadata.pkl")
    print("Modèle XGBoost chargé avec succès")
except Exception as e:
    print(f"Erreur lors du chargement du modèle : {e}")
    spark.stop()
    exit(1)

# 4. Se connecter à MongoDB
try:
    mongo_client = wait_for_mongodb()
    db = mongo_client['epilepsy_predictions']
    predictions_collection = db['predictions']
    print("Connexion à MongoDB réussie")
except Exception as e:
    print(f"Erreur fatale de connexion à MongoDB : {e}")
    spark.stop()
    exit(1)

# 5. Lire les données de Kafka en streaming
kafka_df = spark \
    .readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers", "kafka:9092") \
    .option("subscribe", "epilepsy-data") \
    .option("startingOffsets", "latest") \
    .load()

# 6. Parser le JSON et préparer les données
parsed_df = kafka_df.selectExpr("CAST(value AS STRING) as json") \
    .select(from_json(col("json"), schema).alias("data")) \
    .select("data.*")

# 7. Définir la fonction pour faire les prédictions et sauvegarder dans MongoDB
def process_batch(batch_df, batch_id):
    # Convertir le batch en pandas
    pandas_df = batch_df.toPandas()
    
    if len(pandas_df) == 0:
        return
    
    # Préparer les features
    feature_cols = model_metadata['feature_names']
    X = pandas_df[feature_cols]
    
    # Faire les prédictions
    predictions = model.predict(X)
    probabilities = model.predict_proba(X)
    
    # Pour chaque ligne dans le batch
    for idx, row in pandas_df.iterrows():
        try:
            # 1. Récupérer l'identifiant patient (en string)
            # Si tu as une colonne 'patient_id' dans tes données, utilise-la.
            # Sinon, tu peux utiliser row.name ou un autre identifiant unique.
            patient_id = str(row['patient_id']) if 'patient_id' in row else str(row.name)

            # 2. Récupérer les valeurs EEG (X1 à X178)
            eeg_values = [float(row[f"X{i}"]) for i in range(1, 179)]

            # 3. Créer le document MongoDB
            prediction_doc = {
                'patient_id': patient_id,
                'timestamp': datetime.utcnow(),
                'features': {col: float(row[col]) for col in feature_cols},
                'true_label': int(row['y']),
                'prediction': int(predictions[idx]),
                'prediction_probability': float(probabilities[idx][1]),
                'prediction_class': model_metadata['class_mapping'][int(predictions[idx])],
                'eeg_values': eeg_values
            }

            # 4. Sauvegarder dans MongoDB
            predictions_collection.insert_one(prediction_doc)
            print(f"Prédiction sauvegardée pour {patient_id} : {prediction_doc['prediction_class']} "
                  f"(probabilité: {prediction_doc['prediction_probability']:.2f})")
        except Exception as e:
            print(f"Erreur lors de la sauvegarde de la prédiction : {e}")

# 8. Écrire les prédictions dans MongoDB
query = parsed_df \
    .writeStream \
    .foreachBatch(process_batch) \
    .outputMode("append") \
    .start()

print("Démarrage du streaming des prédictions...")

# 9. Attendre la fin du streaming
query.awaitTermination()

# 10. Nettoyage
mongo_client.close()
spark.stop() 