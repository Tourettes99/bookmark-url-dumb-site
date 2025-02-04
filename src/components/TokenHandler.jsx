import React, { useState } from 'react';
import { Button, TextField, Box, Typography } from '@mui/material';

export default function TokenHandler({ onSetToken }) {
  const [token, setToken] = useState('');
  const [newToken, setNewToken] = useState('');

  const generateToken = () => {
    const randomToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    setNewToken(randomToken);
    onSetToken(randomToken);
  };

  return (
    <Box sx={{ p: 3, border: '2px solid', borderColor: 'secondary.main', borderRadius: 2 }}>
      <Typography variant="h6" gutterBottom color="textPrimary">
        Sync Token
      </Typography>
      
      {!newToken ? (
        <Button
          variant="contained"
          color="secondary"
          onClick={generateToken}
          fullWidth
        >
          Generate New Token
        </Button>
      ) : (
        <Box>
          <Typography variant="body1" color="textSecondary" gutterBottom>
            Your new sync token:
          </Typography>
          <Typography variant="body2" sx={{ wordBreak: 'break-all', mb: 2 }} color="secondary">
            {newToken}
          </Typography>
        </Box>
      )}

      <TextField
        fullWidth
        label="Enter Existing Token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        sx={{ mt: 2 }}
      />
      <Button
        variant="outlined"
        color="primary"
        onClick={() => onSetToken(token)}
        fullWidth
        sx={{ mt: 2 }}
      >
        Sync Existing Token
      </Button>
    </Box>
  );
}
