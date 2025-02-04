import React from 'react';
import { Box, Typography, IconButton, Chip, Paper } from '@mui/material';
import PushPinIcon from '@mui/icons-material/PushPin';

export default function LinkList({ links, onTogglePin, searchTerm }) {
  const filteredLinks = links.filter(link => {
    const lowerTerm = searchTerm.toLowerCase();
    return (
      link.category.toLowerCase().includes(lowerTerm) ||
      link.url.toLowerCase().includes(lowerTerm) ||
      link.hashtags.some(tag => tag.toLowerCase().includes(lowerTerm))
    );
  });

  const pinnedLinks = filteredLinks.filter(link => link.pinned);
  const unpinnedLinks = filteredLinks.filter(link => !link.pinned);

  return (
    <Box sx={{ mt: 3 }}>
      {pinnedLinks.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" color="secondary" gutterBottom>
            Pinned Links
          </Typography>
          {pinnedLinks.map((link) => (
            <LinkItem key={link.timestamp} link={link} onTogglePin={onTogglePin} />
          ))}
        </Box>
      )}

      <Typography variant="h6" color="textSecondary" gutterBottom>
        All Links
      </Typography>
      {unpinnedLinks.map((link) => (
        <LinkItem key={link.timestamp} link={link} onTogglePin={onTogglePin} />
      ))}
    </Box>
  );
}

function LinkItem({ link, onTogglePin }) {
  return (
    <Paper sx={{ p: 2, mb: 2, position: 'relative' }} elevation={3}>
      <IconButton
        sx={{ position: 'absolute', right: 8, top: 8 }}
        onClick={() => onTogglePin(link.timestamp, !link.pinned)}
        color={link.pinned ? 'secondary' : 'default'}
      >
        <PushPinIcon />
      </IconButton>
      <Typography variant="body1">
        <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ color: '#e0e0e0' }}>
          {link.url}
        </a>
      </Typography>
      <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip label={link.category} color="primary" size="small" />
        {link.hashtags.map((tag) => (
          <Chip key={tag} label={tag} variant="outlined" size="small" />
        ))}
      </Box>
      <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
        Added: {new Date(link.timestamp).toLocaleString()}
      </Typography>
    </Paper>
  );
}
