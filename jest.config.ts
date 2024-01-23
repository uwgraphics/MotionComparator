import type {Config} from '@jest/types';
// Sync object
const config: Config.InitialOptions = {
  verbose: true,
  testPathIgnorePatterns: ["./urdf-loaders/*"],
  transform: {
  '^.+\\.tsx?$': 'ts-jest',
  },
};
export default config;