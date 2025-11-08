import pandas as pd
from kafka import KafkaProducer
import json
import time

def create_kafka_producer():
    return KafkaProducer(
        bootstrap_servers=['kafka:9092'],
        value_serializer=lambda x: json.dumps(x).encode('utf-8')
    )

def stream_data():
    # Lire le fichier CSV
    df = pd.read_csv('data/Epileptic_Seizure_Recognition.csv')
    
    # Créer le producteur Kafka
    producer = create_kafka_producer()
    
    # Envoyer chaque ligne vers Kafka
    for index, row in df.iterrows():
        # Convertir la ligne en dictionnaire
        data = row.to_dict()
        
        # Envoyer les données vers le topic 'epilepsy-data'
        producer.send('epilepsy-data', value=data)
        
        # Attendre un peu pour simuler le streaming
        time.sleep(0.1)
        
        if index % 100 == 0:
            print(f"Sent {index} records to Kafka")
    
    # Fermer le producteur
    producer.close()

if __name__ == "__main__":
    print("Starting data streaming to Kafka...")
    stream_data()
    print("Data streaming completed!") 