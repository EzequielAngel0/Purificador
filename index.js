// index.js (raíz del proyecto)

// 1) Polyfill para URL – DEBE ir antes de cualquier import que use Supabase
import 'react-native-url-polyfill/auto';

import { AppRegistry } from 'react-native';
import App from './src/App';          // o './src/App' si así lo tienes
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
