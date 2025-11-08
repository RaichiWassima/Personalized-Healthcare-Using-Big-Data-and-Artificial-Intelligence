from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
import sys
import time
import os
import logging
import jwt
import bcrypt
from functools import wraps
from datetime import datetime, timedelta

# Configuration des logs
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'votre_cle_secrete_ici')  # À changer en production

def wait_for_mongodb(max_retries=30, retry_interval=2):
    for i in range(max_retries):
        try:
            logger.info(f"Tentative de connexion à MongoDB (tentative {i+1}/{max_retries})")
            client = MongoClient(
                host=os.getenv('MONGODB_HOST', 'mongodb'),
                port=int(os.getenv('MONGODB_PORT', 27017)),
                serverSelectionTimeoutMS=5000
            )
            # Test the connection
            client.server_info()
            logger.info("Connexion à MongoDB réussie")
            return client
        except Exception as e:
            logger.error(f"Erreur de connexion à MongoDB: {e}")
            if i < max_retries - 1:
                time.sleep(retry_interval)
            else:
                raise Exception(f"Impossible de se connecter à MongoDB après {max_retries} tentatives")

try:
    logger.info("Initialisation de la connexion MongoDB...")
    mongo_client = wait_for_mongodb()
    db = mongo_client['epilepsy_predictions']
    predictions_collection = db['predictions']
    users_collection = db['users']
    logger.info("Connexion à MongoDB établie avec succès")
except Exception as e:
    logger.error(f"Erreur fatale de connexion à MongoDB: {e}", file=sys.stderr)
    sys.exit(1)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(" ")[1]
            except IndexError:
                return jsonify({'error': 'Token invalide'}), 401

        if not token:
            return jsonify({'error': 'Token manquant'}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = users_collection.find_one({'username': data['username']})
            if not current_user:
                return jsonify({'error': 'Utilisateur non trouvé'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expiré'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token invalide'}), 401

        return f(current_user, *args, **kwargs)
    return decorated

@app.route("/register", methods=["POST"])
def register():
    try:
        data = request.get_json()
        if not all(k in data for k in ['username', 'password', 'role']):
            return jsonify({"error": "Données manquantes"}), 400

        # Vérifier si l'utilisateur existe déjà
        if users_collection.find_one({'username': data['username']}):
            return jsonify({"error": "Nom d'utilisateur déjà pris"}), 400

        # Hasher le mot de passe
        hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt())

        # Créer le nouvel utilisateur
        user = {
            'username': data['username'],
            'password': hashed_password,
            'role': data['role'],
            'created_at': datetime.utcnow()
        }
        users_collection.insert_one(user)

        return jsonify({"message": "Inscription réussie"}), 201
    except Exception as e:
        logger.error(f"Erreur lors de l'inscription: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        if not all(k in data for k in ['username', 'password']):
            return jsonify({"error": "Données manquantes"}), 400

        user = users_collection.find_one({'username': data['username']})
        if not user or not bcrypt.checkpw(data['password'].encode('utf-8'), user['password']):
            return jsonify({"error": "Identifiants invalides"}), 401

        # Créer le token JWT
        token = jwt.encode({
            'username': user['username'],
            'role': user['role'],
            'exp': datetime.utcnow() + timedelta(days=1)
        }, app.config['SECRET_KEY'])

        return jsonify({
            'token': token,
            'user': {
                'username': user['username'],
                'role': user['role']
            }
        })
    except Exception as e:
        logger.error(f"Erreur lors de la connexion: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/", methods=["GET"])
def home():
    logger.info("Requête reçue sur l'endpoint /")
    return jsonify({"status": "API is running"})

@app.route("/get_prediction/<patient_id>", methods=["GET"])
@token_required
def get_prediction(current_user, patient_id):
    try:
        # Vérifier les permissions
        if current_user['role'] == 'patient' and current_user['username'] != patient_id:
            return jsonify({"error": "Accès non autorisé"}), 403

        prediction = predictions_collection.find_one({'patient_id': patient_id})
        if prediction:
            return jsonify({
                "patient_id": patient_id,
                "prediction": prediction['prediction'],
                "timestamp": prediction['timestamp']
            })
        return jsonify({"error": "Prediction not found"}), 404
    except Exception as e:
        logger.error(f"Erreur lors de la récupération de la prédiction: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/get_all_predictions", methods=["GET"])
@token_required
def get_all_predictions(current_user):
    try:
        logger.info("Requête reçue pour récupérer les prédictions")
        
        # Filtrer les prédictions selon le rôle
        query = {}
        if current_user['role'] == 'patient':
            query['patient_id'] = current_user['username']

        # Récupérer toutes les prédictions
        predictions = list(predictions_collection
            .find(query, {'_id': 0})
            .sort('timestamp', -1))

        logger.info(f"Récupération de {len(predictions)} prédictions")
        return jsonify(predictions)
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des prédictions: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/save_prediction", methods=["POST"])
@token_required
def save_prediction(current_user):
    try:
        data = request.get_json()
        if not data or 'patient_id' not in data or 'prediction' not in data:
            return jsonify({"error": "Missing required fields: patient_id and prediction"}), 400

        # Vérifier les permissions
        if current_user['role'] == 'patient' and current_user['username'] != data['patient_id']:
            return jsonify({"error": "Accès non autorisé"}), 403

        patient_id = data['patient_id']
        prediction = data['prediction']
        
        # Sauvegarder dans MongoDB
        prediction_doc = {
            'patient_id': patient_id,
            'prediction': prediction,
            'timestamp': time.time()
        }
        
        predictions_collection.insert_one(prediction_doc)
        
        return jsonify({
            "status": "success",
            "message": f"Prediction saved for patient {patient_id}"
        })
    except Exception as e:
        logger.error(f"Erreur lors de la sauvegarde de la prédiction: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/get_eeg_signal/<patient_id>", methods=["GET"])
@token_required
def get_eeg_signal(current_user, patient_id):
    try:
        # Vérifier les permissions
        if current_user['role'] == 'patient' and current_user['username'] != patient_id:
            return jsonify({"error": "Accès non autorisé"}), 403

        # Récupérer les 23 segments les plus récents pour ce patient (patient_id peut être str ou int)
        segments = list(predictions_collection.find(
            {'patient_id': patient_id},
            {'_id': 0, 'eeg_values': 1, 'timestamp': 1}
        ).sort('timestamp', -1).limit(23))
        if not segments:
            segments = list(predictions_collection.find(
                {'patient_id': int(patient_id)},
                {'_id': 0, 'eeg_values': 1, 'timestamp': 1}
            ).sort('timestamp', -1).limit(23))

        if not segments or len(segments) < 1:
            return jsonify({"error": "Aucun segment EEG trouvé pour ce patient"}), 404

        # Les trier du plus ancien au plus récent
        segments = sorted(segments, key=lambda x: x['timestamp'])

        # Concaténer les valeurs EEG
        eeg_signal = []
        for seg in segments:
            eeg_signal.extend(seg.get('eeg_values', []))

        return jsonify({
            'patient_id': patient_id,
            'eeg_signal': eeg_signal
        })
    except Exception as e:
        logger.error(f"Erreur lors de la récupération du signal EEG: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/get_last_crisis/<patient_id>", methods=["GET"])
@token_required
def get_last_crisis(current_user, patient_id):
    try:
        # Vérifier les permissions
        if current_user['role'] == 'patient' and current_user['username'] != patient_id:
            return jsonify({"error": "Accès non autorisé"}), 403

        # Chercher la dernière prédiction de crise (prediction == 1)
        crisis = predictions_collection.find_one(
            {'patient_id': patient_id, 'prediction': 1},
            sort=[('timestamp', -1)]
        )
        if not crisis:
            crisis = predictions_collection.find_one(
                {'patient_id': int(patient_id), 'prediction': 1},
                sort=[('timestamp', -1)]
            )
        if crisis:
            return jsonify({
                'patient_id': patient_id,
                'last_crisis': crisis['timestamp']
            })
        else:
            return jsonify({
                'patient_id': patient_id,
                'last_crisis': None
            })
    except Exception as e:
        logger.error(f"Erreur lors de la récupération de la dernière crise: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    logger.info("Démarrage du serveur Flask...")
    app.run(debug=True, host="0.0.0.0", port=5000)