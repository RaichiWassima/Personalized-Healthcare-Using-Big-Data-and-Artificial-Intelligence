# Personalized-Healthcare-Using-Big-Data-and-Artificial-Intelligence
This project, entitled, implements a complete Big Data architecture for monitoring and predicting epileptic seizures. It combines two data sources: an epilepsy dataset containing clinical patient records, and smartwatch data generated in real time using a kafka Producer, simulating physiological parameters such as heart rate, body temperature, and physical activity. The pipeline relies on Apache Kafka for data streaming, Apache Spark for processing and predictive analysis, MongoDB for data storage, and a Flask–ReactJS interface for interactive visualization and monitoring. The entire system is containerized with Docker, providing a scalable and intelligent solution for connected healthcare and personalized crisis prevention.


Epilepsy Dataset , smartwatch data (kafka producer) ----> kafka streaming (real-time streaming) ----> spark (data processing) ----> mongoDB ( Data Storage) ----> flask (backend) , reactJS(frontend) 

