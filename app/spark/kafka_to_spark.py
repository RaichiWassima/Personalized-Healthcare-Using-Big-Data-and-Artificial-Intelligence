from pyspark.sql import SparkSession
from pyspark.sql.functions import from_json, col
from pyspark.sql.types import DoubleType, IntegerType, StructType, StructField
from pyspark.ml.feature import VectorAssembler
from pyspark.ml.classification import RandomForestClassifier
import joblib
import pandas as pd

# 1. Créer la session Spark
spark = SparkSession.builder \
    .appName("KafkaTraining") \
    .config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.2.0") \
    .getOrCreate()

# 2. Définir le schéma selon tes données
schema = StructType([
    StructField("X1", DoubleType(), True),
    StructField("X2", DoubleType(), True),
    # ... ajoute toutes les colonnes nécessaires ...
    StructField("Y", IntegerType(), True)
])

# 3. Lire les données de Kafka (en batch, pas en streaming)
kafka_df = spark \
    .read \
    .format("kafka") \
    .option("kafka.bootstrap.servers", "kafka:9092") \
    .option("subscribe", "epilepsy-data") \
    .option("startingOffsets", "earliest") \
    .option("endingOffsets", "latest") \
    .load()

# 4. Parser le JSON
json_df = kafka_df.selectExpr("CAST(value AS STRING) as json")
parsed_df = json_df.select(from_json(col("json"), schema).alias("data")).select("data.*")

# 5. Nettoyage (exemple : enlever les lignes vides)
cleaned_df = parsed_df.dropna()

# 6. Préparer les features
feature_cols = [c for c in cleaned_df.columns if c != "Y"]
assembler = VectorAssembler(inputCols=feature_cols, outputCol="features")
final_data = assembler.transform(cleaned_df)

# 7. Entraîner le modèle
rf = RandomForestClassifier(labelCol="Y", featuresCol="features", numTrees=10)
model = rf.fit(final_data)

# 8. Sauvegarder le modèle Spark MLlib
model.save("model/random_forest_model")

# 9. (Optionnel) Exporter en scikit-learn pour usage Python classique
pandas_df = cleaned_df.toPandas()
from sklearn.ensemble import RandomForestClassifier as SKRandomForestClassifier
sk_model = SKRandomForestClassifier(n_estimators=10)
X = pandas_df[feature_cols]
y = pandas_df["Y"]
sk_model.fit(X, y)
joblib.dump(sk_model, "model/model.pkl")

print("Modèle entraîné et sauvegardé dans model/ !")