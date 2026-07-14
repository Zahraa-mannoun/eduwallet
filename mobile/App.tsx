import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import { paperTheme } from './src/theme/paperTheme';

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider
        theme={paperTheme}
        settings={{ icon: (props) => <MaterialCommunityIcons {...props} /> }}
      >
        <AuthProvider>
          <NotificationsProvider>
            <NavigationContainer>
              <AppNavigator />
              <StatusBar style="light" />
            </NavigationContainer>
          </NotificationsProvider>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
