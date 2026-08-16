import rateLimit from 'express-rate-limit';

// Generous limits for normal quiz play (answers fire roughly once per
// question), tight enough to blunt scripted abuse.
export const generalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

export const answerLimiter = rateLimit({
  windowMs: 10 * 1000,
  limit: 20, // well above what's humanly possible in 72s, but blocks scripted spam
  standardHeaders: true,
  legacyHeaders: false,
});

export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});
