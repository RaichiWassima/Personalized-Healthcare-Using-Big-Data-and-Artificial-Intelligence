FROM bitnami/spark:3.2.0

USER root

# Installer les dépendances système
RUN apt-get update && \
    apt-get install -y build-essential gcc netcat-openbsd procps libsnappy1v5 liblz4-1 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier requirements.txt et installer les dépendances Python avec un timeout plus long
COPY requirements.txt .
RUN pip install --no-cache-dir --timeout 1000 -r requirements.txt

# Créer les répertoires nécessaires
RUN mkdir -p data model

# Copier les fichiers de l'application
COPY . .

# Rendre le script start.sh exécutable
RUN chmod +x start.sh && \
    sed -i 's/\r$//' start.sh

# Exposer le port pour l'interface Spark
EXPOSE 4040

# Utiliser ENTRYPOINT pour s'assurer que le script est toujours exécuté
ENTRYPOINT ["./start.sh"] 