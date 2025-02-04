import React, { useState } from 'react';
import { TextField, Button, Container, Box, Typography, Chip, Checkbox, FormControlLabel, Grid } from '@mui/material';
import { useData } from '../context/DataContext';

export default function LinkManagement() {
  const { links, addLink } = useData();
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pinned, setPinned] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    addLink({
      url,
      category,
      hashtags: hashtags.split(',').map(tag => tag.trim()),
      pinned
    });
    setUrl('');
    setCategory('');
    setHashtags('');
    setPinned(false);
  };

  const filteredLinks = links.filter(link => {
    const query = searchQuery.toLowerCase();
    return (
      link.url.toLowerCase().includes(query) ||
      link.category.toLowerCase().includes(query) ||
      link.hashtags.some(tag => tag.toLowerCase().includes(query))
    );
  });

  const exportToExcel = () => {
    // implement export to excel logic here
  };

  const syncWithExcel = (file) => {
    // implement sync with excel logic here
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Manage Links
        </Typography>

        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Hashtags (comma separated)"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControlLabel
                control={<Checkbox checked={pinned} onChange={(e) => setPinned(e.target.checked)} />}
                label="Pin this link"
              />
            </Grid>
            <Grid item xs={12}>
              <Button type="submit" variant="contained">
                Add Link
              </Button>
            </Grid>
          </Grid>
        </form>

        <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => exportToExcel()}
          >
            Export to Excel
          </Button>
          
          <input
            accept=".xlsx"
            style={{ display: 'none' }}
            id="excel-upload"
            type="file"
            onChange={(e) => {
              if (e.target.files[0]) syncWithExcel(e.target.files[0])
            }}
          />
          <label htmlFor="excel-upload">
            <Button variant="outlined" component="span">
              Import from Excel
            </Button>
          </label>
        </Box>

        <TextField
          fullWidth
          label="Search links"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ mt: 4, mb: 2 }}
        />

        {filteredLinks.map((link, index) => (
          <Box key={index} sx={{ 
            p: 2, 
            mb: 2, 
            borderRadius: 1, 
            bgcolor: 'background.paper',
            borderLeft: link.pinned ? '4px solid #ff4d00' : 'none'
          }}>
            <Typography variant="h6">
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                {link.url}
              </a>
            </Typography>
            <Box sx={{ mt: 1 }}>
              {link.category && <Chip label={link.category} sx={{ mr: 1 }} />}
              {link.hashtags.map((tag, i) => (
                <Chip key={i} label={`#${tag}`} variant="outlined" sx={{ mr: 1, mt: 1 }} />
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Container>
  );
}
