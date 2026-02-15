import { useEffect } from 'react';
import { router } from 'expo-router';

export default function ModalScreen() {
  useEffect(() => {
    // Redirect to home if someone accidentally navigates here
    router.replace('/');
  }, []);
  
  return null;
}