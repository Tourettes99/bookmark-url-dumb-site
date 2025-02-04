import React, { useState } from 'react';
import { Box, TextField, Button, Paper, Chip, CircularProgress } from '@mui/material';

const UrlForm = ({ token, urls, setUrls }) => {
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchMetadata = async (url) => {
    try {
      const response = await fetch('/.netlify/functions/fetchMetadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      
      if (!response.ok) throw new Error('Failed to fetch metadata');
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching metadata:', error);
      return {
        title: '',
        description: '',
        favicon: `https://www.google.com/s2/favicons?domain=${url}`
      };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      alert('Please generate or sync a token first');
      return;
    }

    if (!url || !category) {
      alert('Please fill in both URL and category');
      return;
    }

    setLoading(true);

    try {
      // Fetch metadata first
      const metadata = await fetchMetadata(url);

      const newUrl = {
        id: Date.now(),
        url,
        category,
        hashtags: hashtags.split(' ').filter(tag => tag.startsWith('#')),
        pinned: false,
        timestamp: new Date().toISOString(),
        title: metadata.title || url,
        description: metadata.description || '',
        favicon: metadata.favicon || `https://www.google.com/s2/favicons?domain=${url}`
      };

      // Call Netlify function to save to Excel
      const response = await fetch('/.netlify/functions/saveUrl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, urlData: newUrl }),
      });

      if (response.ok) {
        setUrls([...urls, newUrl]);
        setUrl('');
        setCategory('');
        setHashtags('');
      }
    } catch (error) {
      console.error('Error saving URL:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Step 2: Enter URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            fullWidth
            disabled={loading}
          />
          
          <TextField
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
            fullWidth
            disabled={loading}
          />

          <TextField
            label="Hashtags (space-separated)"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="e.g. #work #important #todo"
            fullWidth
            disabled={loading}
          />

          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={!token || loading}
            fullWidth
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : 'Add URL'}
          </Button>
        </Box>
      </form>
    </Paper>
  );
};

export default UrlForm;
