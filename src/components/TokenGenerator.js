import React, { useState } from 'react';
import { Box, Button, TextField, Paper } from '@mui/material';
import { v4 as uuidv4 } from 'uuid';

const TokenGenerator = ({ token, setToken }) => {
  const [syncToken, setSyncToken] = useState('');

  const generateNewToken = () => {
    const newToken = uuidv4();
    setToken(newToken);
  };

  const handleSync = () => {
    if (syncToken) {
      setToken(syncToken);
      setSyncToken('');
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={generateNewToken}
          fullWidth
        >
          Step 1: Generate Token
        </Button>
        
        {token && (
          <TextField
            label="Your Token"
            value={token}
            InputProps={{ readOnly: true }}
            fullWidth
          />
        )}

        <TextField
          label="Sync Token"
          value={syncToken}
          onChange={(e) => setSyncToken(e.target.value)}
          placeholder="Enter token to sync with another device"
          fullWidth
        />

        <Button
          variant="outlined"
          color="primary"
          onClick={handleSync}
          disabled={!syncToken}
          fullWidth
        >
          Sync Token
        </Button>
      </Box>
    </Paper>
  );
};

export default TokenGenerator;
