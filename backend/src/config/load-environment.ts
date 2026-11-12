import { config } from 'dotenv';

// Shell/deployment variables win; machine-specific secrets override .env defaults.
config({ path: ['.env.local', '.env'], quiet: true });
