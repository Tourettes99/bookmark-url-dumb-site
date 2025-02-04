import React, { useState } from 'react';
import { TextField, Button, Box, CircularProgress, Alert } from '@mui/material';

function UrlForm({ token, urls, setUrls }) {
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setError('Please generate or enter a token first');
      return;
    }
    if (!url) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError(null);

    const urlData = {
      id: Date.now().toString(),
      url,
      category: category || 'Uncategorized',
      hashtags: hashtags ? hashtags.split(',').map(tag => tag.trim()) : [],
      pinned: false,
      dateAdded: new Date().toISOString()
    };

    try {
      // Try local server first
      try {
        const localResponse = await fetch('http://localhost:5000/api/urls', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token, urlData })
        });
        const localData = await localResponse.json();
        if (localData.success) {
          setUrls([...urls, urlData]);
          setUrl('');
          setCategory('');
          setHashtags('');
          setError(null);
          setLoading(false);
          return;
        }
      } catch (localError) {
        console.log('Local server not available');
      }

      // Fallback to Netlify function
      const response = await fetch('/.netlify/functions/saveUrl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, urlData })
      });
      
      const data = await response.json();
      
      if (data.isNetlify) {
        setError('Database server is offline. Please contact the site owner.');
      } else if (data.success) {
        setUrls([...urls, urlData]);
        setUrl('');
        setCategory('');
        setHashtags('');
        setError(null);
      } else {
        setError(data.error || 'Failed to save URL');
      }
    } catch (error) {
      console.error('Error saving URL:', error);
      setError('Failed to connect to the database server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 4 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <TextField
        fullWidth
        label="URL"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        margin="normal"
        disabled={loading}
      />
      
      <TextField
        fullWidth
        label="Category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        margin="normal"
        disabled={loading}
      />
      
      <TextField
        fullWidth
        label="Hashtags (comma-separated)"
        value={hashtags}
        onChange={(e) => setHashtags(e.target.value)}
        margin="normal"
        disabled={loading}
        helperText="Example: work, important, todo"
      />
      
      <Button
        type="submit"
        variant="contained"
        color="primary"
        disabled={loading}
        sx={{ mt: 2 }}
      >
        {loading ? <CircularProgress size={24} /> : 'Add URL'}
      </Button>
    </Box>
  );
}

export default UrlForm;
