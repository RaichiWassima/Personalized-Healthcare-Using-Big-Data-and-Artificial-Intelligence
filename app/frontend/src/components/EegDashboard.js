import React, { useEffect, useState } from 'react';
import { Box, Grid, Paper, Typography, Button, Card, CardContent, MenuItem, Select, FormControl, InputLabel, Alert } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const EegDashboard = () => {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState('');
  const [eegData, setEegData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Charger la liste des patients (uniques)
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const response = await axios.get('http://localhost:5000/get_all_predictions', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = response.data;
        // Extraire les patient_id uniques
        const uniquePatients = [...new Set(data.map(pred => pred.patient_id))];
        setPatients(uniquePatients);
      } catch (err) {
        setError("Impossible de charger la liste des patients");
      }
    };
    fetchPatients();
  }, []);

  // Charger le signal EEG du patient sélectionné
  useEffect(() => {
    if (!selectedPatient) return;
    setLoading(true);
    setError('');
    axios.get(`http://localhost:5000/get_eeg_signal/${selectedPatient}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => {
        const signal = res.data.eeg_signal || [];
        // Adapter le format pour recharts
        setEegData(signal.map((v, i) => ({ time: i, value: v })));
        setLoading(false);
      })
      .catch(err => {
        setEegData([]);
        setError(err.response?.data?.error || 'Erreur lors du chargement du signal EEG');
        setLoading(false);
      });
  }, [selectedPatient]);

  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh', p: 3 }}>
      <Button variant="outlined" onClick={() => navigate(-1)} sx={{ mb: 2 }}>
        Retour au Dashboard
      </Button>
      <FormControl sx={{ minWidth: 220, mb: 3 }}>
        <InputLabel id="select-patient-label">Sélectionner un patient</InputLabel>
        <Select
          labelId="select-patient-label"
          value={selectedPatient}
          label="Sélectionner un patient"
          onChange={e => setSelectedPatient(e.target.value)}
        >
          {patients.map(pid => (
            <MenuItem key={pid} value={pid}>Patient {pid}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Signal EEG (Canal 1)
            </Typography>
            {loading ? (
              <Typography>Chargement du signal EEG...</Typography>
            ) : error ? (
              <Alert severity="error">{error}</Alert>
            ) : eegData.length === 0 ? (
              <Alert severity="info">Aucun signal EEG à afficher pour ce patient.</Alert>
            ) : (
              <ResponsiveContainer width="100%" height="90%">
                <LineChart data={eegData}>
                  <CartesianGrid stroke="#eee" strokeDasharray="5 5" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="#1976d2" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: 400, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', p: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>État Actuel</Typography>
              <Button variant="contained" color="success" sx={{ mb: 2 }}>NORMAL</Button>
              <Typography>Patient : {selectedPatient || '-'}</Typography>
              {/* Ajoutez ici d'autres stats si besoin */}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EegDashboard; 