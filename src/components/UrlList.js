import React, { useState } from 'react';
import {
  List,
  ListItem,
  ListItemText,
  IconButton,
  Paper,
  TextField,
  Box,
  Chip,
  Typography,
  ListItemAvatar,
  Avatar,
  ListItemSecondaryAction
} from '@mui/material';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';

const UrlList = ({ urls, setUrls, token }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const togglePin = async (id) => {
    const updatedUrls = urls.map(url => {
      if (url.id === id) {
        const updatedUrl = { ...url, pinned: !url.pinned };
        // Update in Excel through Netlify function
        fetch('/.netlify/functions/updateUrl', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token, urlData: updatedUrl }),
        });
        return updatedUrl;
      }
      return url;
    });

    setUrls(updatedUrls);
  };

  const filteredUrls = urls.filter(url => {
    const searchLower = searchTerm.toLowerCase();
    return (
      url.url.toLowerCase().includes(searchLower) ||
      url.category.toLowerCase().includes(searchLower) ||
      url.title?.toLowerCase().includes(searchLower) ||
      url.description?.toLowerCase().includes(searchLower) ||
      url.hashtags.some(tag => tag.toLowerCase().includes(searchLower))
    );
  });

  const sortedUrls = [...filteredUrls].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Step 3: Manage URLs
      </Typography>
      
      <TextField
        label="Search URLs, categories, or hashtags"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        fullWidth
        sx={{ mb: 2 }}
      />

      <List>
        {sortedUrls.map((item) => (
          <ListItem
            key={item.id}
            sx={{
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 1,
              mb: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: 2,
            }}
          >
            <Box sx={{ display: 'flex', width: '100%', mb: 1 }}>
              <ListItemAvatar>
                <Avatar 
                  src={item.favicon}
                  alt=""
                  sx={{ width: 24, height: 24, mr: 1 }}
                />
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ 
                        color: '#ff9b00',
                        textDecoration: 'none',
                        marginRight: '8px',
                        fontWeight: 'bold'
                      }}
                    >
                      {item.title || item.url}
                    </a>
                  </Box>
                }
                secondary={
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{ mt: 1, mb: 1 }}
                  >
                    {item.description}
                  </Typography>
                }
              />
              <ListItemSecondaryAction>
                <IconButton onClick={() => togglePin(item.id)} color="primary">
                  {item.pinned ? <PushPinIcon /> : <PushPinOutlinedIcon />}
                </IconButton>
              </ListItemSecondaryAction>
            </Box>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
              <Chip
                label={item.category}
                size="small"
                sx={{ mr: 1 }}
              />
              {item.hashtags.map((tag, index) => (
                <Chip
                  key={index}
                  label={tag}
                  size="small"
                  sx={{ mr: 1 }}
                />
              ))}
            </Box>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

export default UrlList;
