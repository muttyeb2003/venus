import arcjet, { shield, detectBot, slidingWindow } from '@arcjet/node';

const aj = arcjet({
  key: process.env.ARCJET_KEY,
  rules: [
    // Shield protects your app from common attacks e.g. SQL injection
    shield({ mode: 'LIVE' }),
    // Create a bot detection rule
    detectBot({
      mode: 'LIVE', // Blocks requests. Use "DRY_RUN" to log only
      // Block all bots except the following
      allow: ['CATEGORY:SEARCH_ENGINE', 'CATEGORY:PREVIEW'],
    }),
    // Create a token bucket rate limit. Other algorithms are supported.
    slidingWindow({
      mode: 'LIVE',
      characteristics: ['ip.src'],
      interval: '2s',
      max: 5,
    }),
  ],
});

export default aj;
