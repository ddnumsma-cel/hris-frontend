// App entry. The website's code (../src/lib, shared as "@web/…") keeps its data in localStorage and reads
// it as soon as it loads, so the phone gets the browser features it relies on before anything else runs.
import 'expo-sqlite/localStorage/install'; // localStorage on the phone, saved in a small on-device database
import './src/web/polyfills';
import 'expo-router/entry';
