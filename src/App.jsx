import React, { useState, useEffect } from 'react';
import { Container, CssBaseline } from '@mui/material';
import Theme from './theme';
import TokenHandler from './components/TokenHandler';
import LinkForm from './components/LinkForm';
import LinkList from './components/LinkList';
import SearchBar from './components/SearchBar';

function App() {
  const [token, setToken] = useState('');
  const [links, setLinks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const syncData = async () => {
    try {
      const response = await fetch(`/.netlify/functions/syncData?token=${token}&action=get`);
      const data = await response.json();
      setLinks(data);
    } catch (error) {
      console.error('Sync error:', error);
    }
  };

  useEffect(() => {
    if (token) {
      syncData();
    }
  }, [token]);

  return (
    <Theme>
      <CssBaseline />
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography variant="h3" gutterBottom color="textPrimary" sx={{ fontWeight: 'bold' }}>
          Teach Mode Dumber
        </Typography>
        
        {!token ? (
          <TokenHandler onSetToken={setToken} />
        ) : (
          <>
            <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
            <LinkForm onSave={syncData} />
            <LinkList 
              links={links}
              onTogglePin={syncData}
              searchTerm={searchTerm}
            />
          </>
        )}
      </Container>
    </Theme>
  );
}

export default App;
