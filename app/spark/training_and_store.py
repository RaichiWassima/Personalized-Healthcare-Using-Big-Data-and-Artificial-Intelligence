from pyspark.sql import SparkSession
from pyspark.sql.functions import from_json, col, when
from pyspark.sql.types import DoubleType, IntegerType, StructType, StructField, StringType
from pyspark.ml.feature import VectorAssembler
import xgboost as xgb
import joblib
import pandas as pd
import numpy as np
from sklearn.metrics import accuracy_score, classification_report


# 1. Créer la session Spark
spark = SparkSession.builder \
    .appName("KafkaTraining") \
    .config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.2.0") \
    .getOrCreate()

# 2. Définir le schéma selon les données
schema = StructType(
    [StructField("Unnamed", StringType(), True)] +
    [StructField(f"X{i}", DoubleType(), True) for i in range(1, 179)] +
    [StructField("y", IntegerType(), True)]
)

# 3. Lire les données de Kafka (en batch)
kafka_df = spark \
    .read \
    .format("kafka") \
    .option("kafka.bootstrap.servers", "kafka:9092") \
    .option("subscribe", "epilepsy-data") \
    .option("startingOffsets", "earliest") \
    .load()

print("Nombre de lignes kafka_df :", kafka_df.count())

# 4. Parser le JSON
json_df = kafka_df.selectExpr("CAST(value AS STRING) as json")
parsed_df = json_df.select(from_json(col("json"), schema).alias("data")).select("data.*")

# 5. Nettoyage et conversion en classification binaire
# Convertir y en binaire : 1 (crise) vs 0 (non-crise)
cleaned_df = parsed_df.dropna() \
    .withColumn("binary_y", when(col("y") == 1, 1).otherwise(0))

print("Nombre de lignes après nettoyage :", cleaned_df.count())

# 6. Convertir en pandas pour XGBoost
pandas_df = cleaned_df.toPandas()

# 7. Préparer les features et la target
feature_cols = [f"X{i}" for i in range(1, 179)]
X = pandas_df[feature_cols]
y = pandas_df["binary_y"]

# 8. Entraîner le modèle XGBoost
xgb_model = xgb.XGBClassifier(
    objective='binary:logistic',
    n_estimators=100,
    learning_rate=0.1,
    max_depth=5,
    random_state=42
)

print("Début de l'entraînement du modèle XGBoost...")
xgb_model.fit(X, y)

# 9. Évaluer le modèle
y_pred = xgb_model.predict(X)
print("\nRapport de classification :")
print(classification_report(y, y_pred))

# 10. Sauvegarder le modèle
print("\nSauvegarde du modèle...")
joblib.dump(xgb_model, "model/xgboost_model.pkl")

# 11. Sauvegarder les métadonnées du modèle
model_metadata = {
    'feature_names': feature_cols,
    'model_type': 'xgboost',
    'binary_classification': True,
    'class_mapping': {
        1: 'Crise épileptique',
        0: 'Non-crise'
    }
}
joblib.dump(model_metadata, "model/model_metadata.pkl")

print("Modèle XGBoost entraîné et sauvegardé dans model/ !")
print("Le modèle fait une classification binaire :")
print("- 1 : Crise épileptique")
print("- 0 : Non-crise (yeux ouverts, yeux fermés, activité cérébrale saine, activité au niveau de la tumeur)")