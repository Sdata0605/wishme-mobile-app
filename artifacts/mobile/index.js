// App entry point. `assistant-hook` MUST be imported first: it installs/wraps the React DevTools global hook
// before React Native's renderer is evaluated, so the voice assistant can capture the fiber root.
import './assistant-hook';
import 'expo-router/entry';
