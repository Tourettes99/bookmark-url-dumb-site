import React, { useState } from 'react';
import { TextField, Button, Grid, Chip, FormControlLabel, Switch } from '@mui/material';

export default function LinkForm({ onSave }) {
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('');
  const [hashtags, setHashtags] = useState([]);
  const [currentTag, setCurrentTag] = useState('');
  const [pinned, setPinned] = useState(false);

  const handleAddTag = () => {
    if (currentTag.trim()) {
      setHashtags([...hashtags, `#${currentTag.trim()}`]);
      setCurrentTag('');
    }
  };

  const handleSubmit = () => {
    onSave({
      url,
      category,
      hashtags,
      pinned,
      timestamp: new Date().toISOString()
    });
    setUrl('');
    setCategory('');
    setHashtags([]);
    setPinned(false);
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Enter URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TextField
            fullWidth
            label="Add Hashtag"
            value={currentTag}
            onChange={(e) => setCurrentTag(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
          />
          <Button variant="contained" color="secondary" onClick={handleAddTag}>
            Add
          </Button>
        </div>
        <div style={{ marginTop: '8px' }}>
          {hashtags.map((tag) => (
            <Chip key={tag} label={tag} style={{ margin: '2px' }} />
          ))}
        </div>
      </Grid>
      <Grid item xs={12} md={4}>
        <FormControlLabel
          control={<Switch checked={pinned} onChange={(e) => setPinned(e.target.checked)} />}
          label="Pin this link"
          sx={{ mt: 1 }}
        />
      </Grid>
      <Grid item xs={12}>
        <Button
          fullWidth
          variant="contained"
          color="primary"
          onClick={handleSubmit}
        >
          Save Link
        </Button>
      </Grid>
    </Grid>
  );
}
