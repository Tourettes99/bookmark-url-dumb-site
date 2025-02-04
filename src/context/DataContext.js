import React, { createContext, useContext, useState, useEffect } from 'react';

const DataContext = createContext();

export function DataProvider({ children }) {
  const [token, setToken] = useState('');
  const [links, setLinks] = useState([]);

  const generateToken = async () => {
    const newToken = Math.random().toString(36).substr(2, 9);
    setToken(newToken);
    await syncLinks(newToken);
    return newToken;
  };

  const syncLinks = async (currentToken) => {
    try {
      const response = await fetch(
        `/.netlify/functions/sync_links?token=${currentToken}`
      );
      if (response.ok) {
        const data = await response.json();
        setLinks(data);
      }
    } catch (error) {
      console.error('Sync error:', error);
    }
  };

  const addLink = async (linkData) => {
    try {
      await fetch('/.netlify/functions/sync_links?token=' + token, {
        method: 'POST',
        body: JSON.stringify(linkData)
      });
      await syncLinks(token);
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  return (
    <DataContext.Provider value={{ token, links, generateToken, addLink, setToken, syncLinks }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
