import React, { useState } from 'react';
import { Button, TextField, Container, Box, Typography } from '@mui/material';
import { useData } from '../context/DataContext';

export default function TokenGeneration() {
  const { generateToken, token, setToken, syncLinks } = useData();
  const [inputToken, setInputToken] = useState('');

  const handleSync = async () => {
    if (inputToken) {
      setToken(inputToken);
      await syncLinks(inputToken);
    }
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Step 1: Generate or Sync Token
        </Typography>
        
        <Button
          variant="contained"
          onClick={generateToken}
          sx={{ mr: 2 }}
        >
          Generate New Token
        </Button>

        <TextField
          label="Existing Token"
          value={inputToken}
          onChange={(e) => setInputToken(e.target.value)}
          sx={{ width: '300px', mr: 2 }}
        />

        <Button
          variant="outlined"
          onClick={handleSync}
        >
          Sync Existing Token
        </Button>

        {token && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="body1">
              Your Sync Token: <strong>{token}</strong>
            </Typography>
          </Box>
        )}
      </Box>
    </Container>
  );
}
