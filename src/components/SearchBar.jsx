import React from 'react';
import { TextField, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

export default function SearchBar({ searchTerm, setSearchTerm }) {
  return (
    <TextField
      fullWidth
      variant="outlined"
      placeholder="Search by category, hashtag, or URL..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon color="secondary" />
          </InputAdornment>
        ),
        style: { color: '#e0e0e0' }
      }}
      sx={{ mb: 3 }}
    />
  );
}
