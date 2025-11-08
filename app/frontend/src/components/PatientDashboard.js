import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Button, Alert, Stack, Chip, Divider, List, ListItem, ListItemIcon, ListItemText, Avatar } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Scatter } from 'recharts';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';

const PatientDashboard = () => {
  const { user, logout } = useAuth();
  const [eegData, setEegData] = useState([]);
  const [allPredictions, setAllPredictions] = useState([]);
  const [state, setState] = useState('Chargement...');
  const [lastCrisis, setLastCrisis] = useState(null);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    crises: 0,
    normal: 0,
    daysWithoutCrisis: 0
  });
  const [profile, setProfile] = useState({});
  const navigate = useNavigate();

  // Déconnexion automatique à la fermeture de l'onglet ou du navigateur
  useEffect(() => {
    const handleUnload = () => {
      logout();
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [logout]);

  // Correction bouton de déconnexion
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    if (!user) return;
    // EEG
    axios.get(`http://localhost:5000/get_eeg_signal/${user.username}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => {
        const signal = res.data.eeg_signal || [];
        // Afficher seulement les 300 derniers points pour plus de lisibilité
        const limited = signal.slice(-300);
        setEegData(limited.map((v, i) => ({ time: i, value: v })));
      })
      .catch(() => setError('Aucun signal EEG à afficher pour ce patient.'));
    // Toutes les prédictions pour stats
    axios.get(`http://localhost:5000/get_all_predictions`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => {
        const preds = res.data.filter(p => p.patient_id === user.username || p.patient_id === parseInt(user.username));
        setAllPredictions(preds);
        // Statistiques
        const crises = preds.filter(p => p.prediction === 1);
        const total = preds.length;
        const crisesCount = crises.length;
        const normalCount = total - crisesCount;
        // Jours sans crise
        const crisisDates = new Set(crises.map(c => new Date(c.timestamp * 1000).toLocaleDateString()));
        const allDates = new Set(preds.map(c => new Date(c.timestamp * 1000).toLocaleDateString()));
        const daysWithoutCrisis = [...allDates].filter(d => !crisisDates.has(d)).length;
        setStats({ total, crises: crisesCount, normal: normalCount, daysWithoutCrisis });
        // État actuel et date de la dernière crise (gérer ISODate ou timestamp)
        if (crises.length > 0) {
          let ts = crises[0].timestamp;
          let dateStr = '-';
          if (typeof ts === 'string' && ts.includes('T')) {
            // ISODate
            dateStr = new Date(ts).toLocaleString('fr-FR');
          } else if (!isNaN(ts)) {
            // timestamp numérique (secondes ou ms)
            if (ts > 1e12) dateStr = new Date(ts).toLocaleString('fr-FR'); // ms
            else dateStr = new Date(ts * 1000).toLocaleString('fr-FR'); // s
          }
          setLastCrisis(dateStr);
          setState('Crise détectée');
        } else {
          setLastCrisis(null);
          setState('État normal');
        }
      });
    // Charger le profil (date d'inscription si dispo)
    axios.get('http://localhost:5000/get_profile', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => setProfile(res.data))
      .catch(() => setProfile({}));
  }, [user]);

  // Déconnexion automatique si le token expire (erreur 401)
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response && error.response.status === 401) {
          logout();
          navigate('/login');
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [logout, navigate]);

  // Préparer les points de crise pour le graphe
  const crisisPoints = allPredictions
    .filter(p => p.prediction === 1)
    .map((p, i) => ({ time: i, value: p.eeg_values ? p.eeg_values[0] : null }));

  // Header personnalisé
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bonjour";
    if (hour < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  // Formatage sûr de la date d'inscription
  const getProfileDate = (date) => {
    if (!date) return '-';
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return '-';
    }
  };

  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header coloré */}
      <Box sx={{ bgcolor: '#1976d2', color: 'white', py: 3, px: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 0, boxShadow: 2 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Avatar sx={{ bgcolor: 'white', color: '#1976d2', width: 56, height: 56, boxShadow: 1 }}>
            <PersonIcon sx={{ fontSize: 36 }} />
          </Avatar>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', letterSpacing: 1 }}>{getGreeting()}, {user?.username} !</Typography>
            <Typography variant="subtitle1" sx={{ opacity: 0.9, fontStyle: 'italic' }}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </Typography>
          </Box>
        </Stack>
        <Button
          variant="contained"
          color="error"
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          sx={{
            fontWeight: 'bold',
            borderRadius: 2,
            boxShadow: 1
          }}
        >
          Déconnexion
        </Button>
      </Box>
      <Box sx={{ p: { xs: 1, md: 4 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <Paper sx={{ p: 3, mb: 2, flex: 2, borderRadius: 3, boxShadow: 3, bgcolor: '#f7fafc' }}>
            <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold' }}>Mon Signal EEG (en temps réel)</Typography>
            {error ? (
              <Alert severity="info">{error}</Alert>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={eegData}>
                  <CartesianGrid stroke="#e3e3e3" strokeDasharray="5 5" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#1976d2" strokeWidth={2} dot={false} />
                  {/* Points rouges pour les crises */}
                  <Scatter data={crisisPoints} fill="#ff1744" shape="circle" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Paper>
          <Stack spacing={2} flex={1}>
            <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 3, bgcolor: '#f7fafc' }}>
              <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold' }}>Mon Profil</Typography>
              <Divider sx={{ my: 1 }} />
              <Typography>Identifiant : <b>{user?.username}</b></Typography>
              <Typography>Date d'inscription : <b>{getProfileDate(profile.created_at)}</b></Typography>
            </Paper>
            <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 3, bgcolor: '#f7fafc' }}>
              <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold' }}>État Actuel</Typography>
              <Chip
                icon={state === 'Crise détectée' ? <WarningIcon /> : <CheckCircleIcon />}
                label={state}
                color={state === 'Crise détectée' ? 'error' : 'success'}
                sx={{ mb: 1, fontWeight: 'bold', fontSize: 16 }}
              />
              <Typography>
                {lastCrisis
                  ? `Dernière crise détectée le : ${lastCrisis}`
                  : "Aucune crise détectée récemment."}
              </Typography>
            </Paper>
            <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 3, bgcolor: '#f7fafc' }}>
              <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold' }}>Statistiques personnelles</Typography>
              <Divider sx={{ my: 1 }} />
              <Typography>Nombre total de segments : <b>{stats.total}</b></Typography>
              <Typography>Nombre de crises : <b>{stats.crises}</b></Typography>
              <Typography>Nombre de segments normaux : <b>{stats.normal}</b></Typography>
              <Typography>Jours sans crise : <b>{stats.daysWithoutCrisis}</b></Typography>
              <Typography>Pourcentage segments normaux : <b>{stats.total > 0 ? ((stats.normal / stats.total) * 100).toFixed(1) : 0}%</b></Typography>
            </Paper>
            <Paper sx={{ p: 3, borderRadius: 3, boxShadow: 3, bgcolor: '#f7fafc' }}>
              <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 'bold' }}>Conseils personnalisés</Typography>
              <List>
                <ListItem>
                  <ListItemIcon><InfoIcon color="primary" /></ListItemIcon>
                  <ListItemText primary="Prenez régulièrement votre traitement." />
                </ListItem>
                <ListItem>
                  <ListItemIcon><InfoIcon color="primary" /></ListItemIcon>
                  <ListItemText primary="Évitez le stress et le manque de sommeil." />
                </ListItem>
                <ListItem>
                  <ListItemIcon><InfoIcon color="primary" /></ListItemIcon>
                  <ListItemText primary="Tenez un journal de vos crises pour en parler à votre médecin." />
                </ListItem>
              </List>
            </Paper>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
};

export default PatientDashboard; 