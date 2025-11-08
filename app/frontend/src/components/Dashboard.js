import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Container, 
  Grid, 
  Paper, 
  Typography, 
  Card, 
  CardContent,
  CircularProgress,
  Button,
  Alert,
  Snackbar,
  IconButton,
  TextField,
  InputAdornment,
  Divider,
  Avatar,
  Stack
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import WarningIcon from '@mui/icons-material/Warning';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AssessmentIcon from '@mui/icons-material/Assessment';
import LogoutIcon from '@mui/icons-material/Logout';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer
} from 'recharts';
import axios from 'axios';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    byPrediction: {}
  });
  const [alarmActive, setAlarmActive] = useState(false);
  const [alarmMessage, setAlarmMessage] = useState('');
  const [showAlarm, setShowAlarm] = useState(false);
  const alarmSound = useRef(new Audio('/alarm.mp3'));
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredPredictions, setFilteredPredictions] = useState([]);

  // Vérifier si l'utilisateur est connecté
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Fonction pour gérer l'alarme
  const handleAlarm = (prediction) => {
    if (prediction.prediction === 1 || prediction.prediction_class === 'Crise épileptique') {
      setAlarmActive(true);
      setAlarmMessage(`ALERTE : Crise épileptique détectée pour le patient ${prediction.patient_id}`);
      setShowAlarm(true);
      alarmSound.current.play();
    }
  };

  // Fonction pour arrêter l'alarme
  const handleCloseAlarm = () => {
    setShowAlarm(false);
    alarmSound.current.pause();
    alarmSound.current.currentTime = 0;
    setAlarmActive(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!user) return;

        console.log('Chargement des données...');
        const response = await axios.get(`http://localhost:5000/get_all_predictions`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        const data = response.data;
        
        if (!Array.isArray(data)) {
          throw new Error('Format de données invalide');
        }

        // Vérifier les nouvelles prédictions pour l'alarme
        if (predictions.length > 0) {
          const newPredictions = data.filter(
            newPred => !predictions.some(oldPred => 
              oldPred.timestamp === newPred.timestamp && 
              oldPred.patient_id === newPred.patient_id
            )
          );
          
          newPredictions.forEach(pred => handleAlarm(pred));
        }

        setPredictions(data);
        setStats({
          total: data.length,
          byPrediction: data.reduce((acc, pred) => {
            acc[pred.prediction] = (acc[pred.prediction] || 0) + 1;
            return acc;
          }, {})
        });
        setLoading(false);
        setError(null);
      } catch (err) {
        console.error('Erreur de chargement:', err);
        if (err.response?.status === 401) {
          // Token expiré ou invalide
          logout();
          navigate('/login');
        } else {
          setError(err.response?.data?.error || 'Erreur lors du chargement des données');
        }
        setLoading(false);
      }
    };

    fetchData();
    // Rafraîchir les données toutes les 10 secondes pour une meilleure réactivité
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [user, navigate, logout]);

  // Effet pour filtrer les prédictions quand la recherche change
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredPredictions(predictions);
    } else {
      const filtered = predictions.filter(pred => 
        pred.patient_id.toString().includes(searchTerm.trim())
      );
      setFilteredPredictions(filtered);
    }
  }, [searchTerm, predictions]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  // Fonction utilitaire pour afficher le label
  const getPredictionLabel = (pred) =>
    pred.prediction_class || (pred.prediction === 1 ? "Crise épileptique" : "Non-crise");

  // Préparer les données pour le graphique en temps réel
  const timeSeriesData = predictions.slice(-20).map(pred => ({
    patient_id: pred.patient_id,
    prediction: getPredictionLabel(pred),
    timestamp: new Date(pred.timestamp).toLocaleTimeString()
  }));

  // Préparer les données pour le graphique en camembert
  const pieStats = predictions.reduce((acc, pred) => {
    const label = getPredictionLabel(pred);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  const pieData = Object.entries(pieStats).map(([name, value]) => ({ name, value }));

  // Fonction pour obtenir le moment de la journée
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bonjour";
    if (hour < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh', pb: 4 }}>
      {/* En-tête personnalisé */}
      <Paper 
        elevation={0} 
        sx={{ 
          bgcolor: '#1976d2', 
          color: 'white', 
          py: 3, 
          mb: 4,
          borderRadius: 0
        }}
      >
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={2}>
              <Avatar sx={{ bgcolor: 'white', color: '#1976d2' }}>
                <PersonIcon />
              </Avatar>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  {getGreeting()}, Dr {user?.username}
                </Typography>
                <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
                  <AccessTimeIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                  {new Date().toLocaleDateString('fr-FR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </Typography>
              </Box>
            </Stack>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              sx={{
                borderColor: 'white',
                color: 'white',
                '&:hover': {
                  borderColor: 'white',
                  bgcolor: 'rgba(255,255,255,0.1)'
                }
              }}
            >
              Déconnexion
            </Button>
          </Stack>
        </Container>
      </Paper>

      <Container maxWidth="lg">
        {/* Alarme */}
        <Snackbar
          open={showAlarm}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          sx={{
            '& .MuiAlert-root': {
              backgroundColor: '#ff1744',
              color: 'white',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              width: '100%',
              maxWidth: '600px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
            }
          }}
        >
          <Alert
            severity="error"
            icon={<WarningIcon sx={{ fontSize: 40 }} />}
            action={
              <IconButton
                size="large"
                aria-label="close"
                color="inherit"
                onClick={handleCloseAlarm}
              >
                <CloseIcon />
              </IconButton>
            }
          >
            {alarmMessage}
          </Alert>
        </Snackbar>

        <Grid container spacing={3}>
          {/* Statistiques générales */}
          <Grid item xs={12} md={4}>
            <Card elevation={2} sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                  <AssessmentIcon color="primary" sx={{ fontSize: 40 }} />
                  <Box>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      Total des Prédictions
                    </Typography>
                    <Typography variant="h3" color="primary" sx={{ fontWeight: 'bold' }}>
                      {stats.total}
                    </Typography>
                  </Box>
                </Stack>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  Dernière mise à jour : {new Date().toLocaleTimeString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Graphique en temps réel */}
          <Grid item xs={12} md={8}>
            <Paper 
              elevation={2} 
              sx={{ 
                p: 3, 
                display: 'flex', 
                flexDirection: 'column', 
                height: 400,
                bgcolor: 'white'
              }}
            >
              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                Prédictions en Temps Réel
              </Typography>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={predictions.slice(-20).map((pred, i) => ({
                    ...pred,
                    label: getPredictionLabel(pred),
                    timestamp: new Date(pred.timestamp).toLocaleTimeString(),
                    index: i
                  }))}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="#666"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    allowDecimals={false} 
                    dataKey="label" 
                    type="category"
                    stroke="#666"
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white',
                      border: 'none',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                      borderRadius: 8
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="label" 
                    stroke="#1976d2"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Distribution des prédictions et Liste des prédictions côte à côte */}
          <Grid item xs={12} md={6}>
            <Paper 
              elevation={2} 
              sx={{ 
                p: 3, 
                display: 'flex', 
                flexDirection: 'column', 
                height: 600,
                bgcolor: 'white'
              }}
            >
              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                Distribution des Prédictions
              </Typography>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={150}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white',
                      border: 'none',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                      borderRadius: 8
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Liste des prédictions avec barre de recherche */}
          <Grid item xs={12} md={6}>
            <Paper 
              elevation={2} 
              sx={{ 
                p: 3, 
                display: 'flex', 
                flexDirection: 'column', 
                height: 600,
                bgcolor: 'white'
              }}
            >
              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                Toutes les Prédictions
              </Typography>
              
              {/* Barre de recherche */}
              <TextField
                fullWidth
                variant="outlined"
                placeholder="Rechercher un patient..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ 
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&:hover fieldset': {
                      borderColor: 'primary.main',
                    },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon color="primary" />
                    </InputAdornment>
                  ),
                }}
              />

              {/* Liste des prédictions */}
              <Box sx={{ 
                flex: 1, 
                overflow: 'auto',
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  background: '#f1f1f1',
                  borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: '#888',
                  borderRadius: '4px',
                  '&:hover': {
                    background: '#666',
                  },
                },
              }}>
                {filteredPredictions.map((pred, index) => (
                  <Box 
                    key={`${pred.patient_id}_${pred.timestamp}_${index}`}
                    sx={{ 
                      mb: 1.5, 
                      p: 2, 
                      bgcolor: pred.prediction === 1 ? 'error.light' : 'background.default',
                      borderRadius: 2,
                      transition: 'all 0.2s',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                          Patient {pred.patient_id}
                        </Typography>
                        <Typography variant="body2" color={pred.prediction === 1 ? 'error.main' : 'text.secondary'}>
                          {getPredictionLabel(pred)}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(pred.timestamp).toLocaleString()}
                      </Typography>
                    </Stack>
                  </Box>
                ))}
                {filteredPredictions.length === 0 && (
                  <Box sx={{ 
                    textAlign: 'center', 
                    py: 4,
                    color: 'text.secondary'
                  }}>
                    <SearchIcon sx={{ fontSize: 48, opacity: 0.5, mb: 2 }} />
                    <Typography variant="body1">
                      Aucune prédiction trouvée
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Dashboard; 