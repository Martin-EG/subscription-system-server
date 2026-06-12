import { createApp } from './app.js';
import { env } from './infrastructure/config/env.js';

const app = createApp();

app.listen(env.PORT, () => {
  console.info(`Subscription API listening on port ${env.PORT}`);
});
