FROM node:18-alpine

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances avec une approche plus robuste
RUN apk add --no-cache python3 make g++ && \
    npm cache clean --force && \
    rm -rf node_modules package-lock.json && \
    npm install --verbose && \
    npm install react-router-dom@6.11.2 --save --verbose

# Copier le reste des fichiers
COPY . .

# Vérifier que react-router-dom est bien installé
RUN npm list react-router-dom

# Exposer le port
EXPOSE 3000

# Démarrer l'application
CMD ["npm", "start"]